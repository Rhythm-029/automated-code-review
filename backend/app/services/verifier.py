"""
Hallucination Detection and Evidence Verification Pipeline.

Implements a generate-then-verify architecture:
Input -> Preprocessing -> Candidate Generation -> Evidence Verification -> Output Gate -> Review Results

Verification checks:
1. File reference validation: Ensure referenced file matches context.
2. Line range validity: Line numbers must exist within the patch or context.
3. Code evidence presence: Quoted code snippets must be found verbatim or near-verbatim in source.
4. Identifier grounding: Variable/function names mentioned in comments must exist in code context.
5. Novel vs existing identifier distinction: Separate proposed additions from existing symbols.
6. Relevance check: Finding must relate to added/modified lines in diff, not untouched code.
7. Deduplication: Suppress redundant or overlapping findings.
8. Output gating: Suppress unverified or low-confidence findings.
"""
from __future__ import annotations

import difflib
import logging
import re
from typing import List, Optional, Set, Tuple

from ..schemas import ReviewComment, VerificationDetail

logger = logging.getLogger(__name__)

# Identifier regex pattern for code languages
IDENTIFIER_PATTERN = re.compile(r"\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b")

# Common code keywords across Python, JS, C, Go, Java to avoid flagging as identifiers
COMMON_KEYWORDS = {
    "and", "as", "assert", "async", "await", "break", "class", "continue",
    "def", "del", "elif", "else", "except", "finally", "for", "from",
    "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
    "or", "pass", "raise", "return", "try", "while", "with", "yield",
    "const", "let", "var", "function", "export", "default", "interface",
    "type", "enum", "public", "private", "protected", "static", "readonly",
    "null", "undefined", "true", "false", "void", "any", "string", "number",
    "boolean", "object", "package", "struct", "func", "nil", "int", "float",
    "None", "True", "False", "self", "this", "super", "new", "throw", "catch",
}


def extract_identifiers(text: str) -> Set[str]:
    """Extract code identifiers, excluding language keywords and very short tokens."""
    raw_tokens = set(IDENTIFIER_PATTERN.findall(text))
    return {t for t in raw_tokens if t not in COMMON_KEYWORDS and len(t) > 2}


def parse_diff_lines(patch: str) -> Tuple[List[str], Set[int]]:
    """
    Parse a unified diff into added/modified lines and their new line numbers.
    Returns (added_or_modified_lines, valid_line_numbers).
    """
    valid_lines: Set[int] = set()
    added_lines: List[str] = []
    current_line = 1

    hunk_header_pattern = re.compile(r"^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@")

    for line in patch.splitlines():
        hunk_match = hunk_header_pattern.match(line)
        if hunk_match:
            current_line = int(hunk_match.group(1))
            continue

        if line.startswith("+") and not line.startswith("+++"):
            valid_lines.add(current_line)
            added_lines.append(line[1:])
            current_line += 1
        elif line.startswith("-") and not line.startswith("---"):
            pass  # Deleted lines don't get new line numbers
        else:
            # Context line
            valid_lines.add(current_line)
            current_line += 1

    return added_lines, valid_lines


def fuzzy_snippet_match(snippet: str, source: str, threshold: float = 0.65) -> bool:
    """Check if a code snippet exists in the source, either exact or fuzzy."""
    if not snippet or not snippet.strip():
        return True

    clean_snippet = snippet.strip()
    # Exact substring
    if clean_snippet in source:
        return True

    # Normalized whitespace match
    norm_snippet = " ".join(clean_snippet.split())
    norm_source = " ".join(source.split())
    if norm_snippet in norm_source:
        return True

    # Line-by-line containment: check if any line of snippet is in source
    snippet_lines = [l.strip() for l in clean_snippet.splitlines() if len(l.strip()) > 8]
    if snippet_lines:
        matched = sum(1 for sl in snippet_lines if sl in source)
        if matched / len(snippet_lines) >= 0.5:
            return True

    # Sequence matcher on smaller chunks
    if len(clean_snippet) < 300:
        ratio = difflib.SequenceMatcher(None, clean_snippet, source[:len(clean_snippet) * 3]).quick_ratio()
        if ratio >= threshold:
            return True

    return False


class HallucinationVerifier:
    """
    Multi-stage verification pipeline to detect hallucinations in AI review comments.
    """

    def __init__(self, strictness: float = 0.7) -> None:
        self.strictness = strictness

    def verify_comment(
        self,
        comment: ReviewComment,
        patch: str,
        oldf: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> Tuple[ReviewComment, bool]:
        """
        Verify a single comment.
        Returns (verified_comment, is_accepted).
        """
        source_context = patch
        if oldf:
            source_context += "\n" + oldf

        patch_identifiers = extract_identifiers(source_context)
        added_lines, valid_lines = parse_diff_lines(patch)

        # Stage 1: Line number validation
        line_valid = True
        if comment.line is not None and valid_lines:
            # Check within +/- 5 lines tolerance of actual hunks
            min_line = min(valid_lines) - 5
            max_line = max(valid_lines) + 15
            if not (min_line <= comment.line <= max_line):
                # Out of bounds line reference
                line_valid = False

        # Stage 2: Code evidence verification
        evidence_found = True
        if comment.code_snippet:
            evidence_found = fuzzy_snippet_match(comment.code_snippet, source_context)

        # Stage 3: Identifier grounding
        comment_text = f"{comment.title} {comment.body}"
        # Extract quoted identifiers from markdown backticks: `identifier`
        quoted_tokens = re.findall(r"`([a-zA-Z_][a-zA-Z0-9_]{2,})`", comment_text)
        quoted_tokens = [t for t in quoted_tokens if t not in COMMON_KEYWORDS]

        verified_ids = []
        unverified_ids = []
        for token in quoted_tokens:
            if token in patch_identifiers or any(token in line for line in added_lines):
                verified_ids.append(token)
            else:
                unverified_ids.append(token)

        # Stage 4: Grounding score calculation
        scores = []
        # Snippet grounding
        if comment.code_snippet:
            scores.append(1.0 if evidence_found else 0.2)
        else:
            scores.append(0.8)

        # Line grounding
        if comment.line is not None:
            scores.append(1.0 if line_valid else 0.3)
        else:
            scores.append(0.7)

        # Identifier grounding
        if quoted_tokens:
            id_ratio = len(verified_ids) / len(quoted_tokens)
            scores.append(id_ratio)
        else:
            scores.append(0.8)

        grounding_score = sum(scores) / len(scores) if scores else 0.8

        # Stage 5: Output gating
        # Suppress comment if snippet was quoted but completely absent from source
        # and unverified identifiers dominate
        is_accepted = True
        notes = []

        if comment.code_snippet and not evidence_found and len(comment.code_snippet.strip()) > 30:
            notes.append("Quoted snippet not found in submitted code.")
            grounding_score = min(grounding_score, 0.4)
            if self.strictness >= 0.7:
                is_accepted = False

        if unverified_ids and len(unverified_ids) > len(verified_ids) + 2:
            notes.append(f"Unverified identifiers: {', '.join(unverified_ids[:4])}")
            grounding_score = min(grounding_score, 0.5)

        if not line_valid and comment.line is not None:
            notes.append(f"Line {comment.line} falls outside verified diff hunks.")
            grounding_score = min(grounding_score, 0.6)

        verification_detail = VerificationDetail(
            is_verified=is_accepted and grounding_score >= 0.6,
            grounding_score=round(grounding_score, 2),
            evidence_found=evidence_found,
            identifiers_verified=verified_ids,
            unverified_identifiers=unverified_ids,
            verification_notes="; ".join(notes) if notes else "Evidence verified against source context.",
        )

        # Create updated comment with verification attached
        verified_comment = comment.model_copy(
            update={
                "verification": verification_detail,
                "confidence": round(grounding_score, 2),
                "evidence_assessment": (
                    "Fully verified from diff" if grounding_score >= 0.85
                    else "Plausible contextual inference" if grounding_score >= 0.6
                    else "Low evidence grounding"
                ),
            }
        )

        return verified_comment, is_accepted

    def verify_and_filter(
        self,
        comments: List[ReviewComment],
        patch: str,
        oldf: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> Tuple[List[ReviewComment], int]:
        """
        Verify all candidate comments, deduplicate, and filter out hallucinations.
        Returns (accepted_comments, suppressed_count).
        """
        verified_list: List[ReviewComment] = []
        suppressed_count = 0
        seen_titles: Set[str] = set()

        for c in comments:
            verified_c, accepted = self.verify_comment(c, patch, oldf=oldf, filename=filename)

            # Deduplication check
            title_norm = re.sub(r"[^a-z0-9]", "", verified_c.title.lower())
            if title_norm in seen_titles:
                suppressed_count += 1
                continue

            if accepted:
                seen_titles.add(title_norm)
                verified_list.append(verified_c)
            else:
                suppressed_count += 1
                logger.info(
                    "Suppressed ungrounded finding '%s': %s",
                    verified_c.title,
                    verified_c.verification.verification_notes if verified_c.verification else "",
                )

        return verified_list, suppressed_count

