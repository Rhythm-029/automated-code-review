# Hallucination Screening & Confidence Gating

## Overview

Large Language Models frequently suffer from hallucinations—generating statements that sound plausible but refer to non-existent code entities, incorrect logic, or unsupported assumptions. In automated code review, an erroneous review comment wastes developer time and undermines trust.

To mitigate this issue, this project incorporates a dedicated **Hallucination Screening & Confidence Gating Pipeline**.

## Screening Pipeline Architecture

```text
Candidate Review Comment
       │
       ▼
[Stage 1: Symbol Grounding] ────► Verifies variable/function/type presence in code context
       │
       ▼
[Stage 2: Natural Language Inference] ──► DeBERTa-MNLI checks if diff context entails comment premise
       │
       ▼
[Stage 3: Confidence Gate] ────► Combines scores; decides whether to Emit or Abstain
       │
  ┌────┴────────────────────┐
  ▼                         ▼
Emit Draft Comment       Abstain (No Comment)
```

## Detailed Screening Components

### 1. Symbol Grounding
- **Purpose**: Checks whether code entities (variable names, function identifiers, class names, file paths, parameters) referenced in the generated comment actually exist within the provided pull request diff or file context.
- **Mechanism**: Extracts code identifiers from the generated comment using Tree-Sitter AST parsing and regex patterns, then matches them against the symbol table of the diff hunk. Unresolved symbols lower the grounding score.

### 2. Natural Language Inference (NLI)
- **Purpose**: Evaluates whether the claims made in the generated comment are premise-supported by the code diff context.
- **Model**: Utilizes a pre-trained NLI model (e.g., `DeBERTa-v3-MNLI`).
- **Mechanism**: The code diff (formatted as text/pseudo-code) acts as the *premise*, and the generated review comment acts as the *hypothesis*. The NLI classifier calculates probabilities for Entailment, Contradiction, and Neutral relationships.

### 3. Confidence Gate & Decision Rule
- A aggregate confidence score is calculated based on symbol grounding resolution and NLI entailment probability.
- **Decision Policy**:
  - If $\text{Score} \ge \tau$ (Confidence Threshold): **Emit** candidate comment as an AI-generated draft.
  - If $\text{Score} < \tau$: **Abstain** (suppress emission to prevent hallucination exposure).

## Critical Safety Notice

> **Important**: The hallucination screening pipeline is designed to detect ungrounded code references and unsupported premises to significantly reduce false suggestions. **It does NOT completely eliminate hallucinations.** Complex semantic misunderstandings or subtle logical flaws may still pass screening. Therefore, human reviewer verification remains mandatory.
