"""
Pydantic schemas for request validation and response serialisation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum

from pydantic import BaseModel, Field, field_validator


# ── Enums ─────────────────────────────────────────────────────────────────────

class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class Category(str, Enum):
    correctness = "correctness"
    bug_risk = "bug_risk"
    security = "security"
    performance = "performance"
    readability = "readability"
    maintainability = "maintainability"
    testing = "testing"
    general = "general"


class EngineMode(str, Enum):
    real_model = "real_model"
    demo = "demo"


# ── Verification Detail ───────────────────────────────────────────────────────

class VerificationDetail(BaseModel):
    is_verified: bool = True
    grounding_score: float = 1.0
    evidence_found: bool = True
    identifiers_verified: List[str] = Field(default_factory=list)
    unverified_identifiers: List[str] = Field(default_factory=list)
    verification_notes: Optional[str] = None


# ── Review request ─────────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    patch: str = Field(..., description="Git diff / patch to review")
    oldf: Optional[str] = Field(None, description="Optional original source file for context")
    engine: Optional[str] = Field(None, description="Override the configured engine")
    max_comments: int = Field(5, ge=1, le=10, description="Maximum number of comments to return")
    language: Optional[str] = Field(None, description="Optional programming language of the snippet")
    verify_hallucinations: bool = Field(True, description="Run hallucination and grounding verification")

    @field_validator("patch")
    @classmethod
    def patch_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("patch must not be empty")
        return v


# ── Comment ────────────────────────────────────────────────────────────────────

class ReviewComment(BaseModel):
    title: str
    body: str
    severity: Severity = Severity.info
    category: Category = Category.general
    suggestion: Optional[str] = None
    line: Optional[int] = None
    end_line: Optional[int] = None
    file_path: Optional[str] = None
    code_snippet: Optional[str] = None
    confidence: Optional[float] = None
    evidence_assessment: Optional[str] = None
    verification: Optional[VerificationDetail] = None


# ── Review response ────────────────────────────────────────────────────────────

class ReviewResponse(BaseModel):
    review_id: str
    status: str = "success"
    summary: Optional[str] = None
    language: Optional[str] = None
    engine: str
    mode: EngineMode
    duration_ms: int
    patch_chars: int
    files_analyzed: int = 1
    files_skipped: int = 0
    lines_analyzed: int = 0
    comments: List[ReviewComment]
    suppressed_findings: int = 0
    severity_counts: Dict[str, int] = Field(default_factory=lambda: {
        "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0
    })
    coverage: Dict[str, Any] = Field(default_factory=dict)
    verification: Dict[str, Any] = Field(default_factory=dict)
    limitations: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── Stored review ──────────────────────────────────────────────────────────────

class StoredReview(BaseModel):
    review_id: str
    engine: str
    mode: EngineMode
    duration_ms: int
    patch_chars: int
    patch_preview: str          # first 300 chars of the patch
    summary: Optional[str] = None
    comments: List[ReviewComment]
    comment_count: int
    suppressed_count: int = 0
    severity_counts: Dict[str, int] = Field(default_factory=dict)
    created_at: datetime


# ── Model status ───────────────────────────────────────────────────────────────

class ModelStatus(BaseModel):
    configured_engine: str
    active_engine: str
    mode: EngineMode
    model_identifier: Optional[str] = None
    checkpoint_loaded: bool = False
    training_status: str = "not_started"
    configuration_errors: List[str] = []
    notes: List[str] = []
    groq_status: Optional[Dict[str, Any]] = None


# ── GitHub PR ──────────────────────────────────────────────────────────────────

class GitHubTokenStatus(BaseModel):
    configured: bool
    valid: bool
    username: Optional[str] = None
    rate_limit_limit: Optional[int] = None
    rate_limit_remaining: Optional[int] = None
    error: Optional[str] = None


class GitHubPRRequest(BaseModel):
    pr_url: Optional[str] = Field(None, description="Full GitHub PR URL (e.g. https://github.com/owner/repo/pull/123)")
    repo_url: Optional[str] = Field(None, description="GitHub repository URL or owner/repo format")
    pr_number: Optional[int] = Field(None, ge=1)
    engine: Optional[str] = None
    max_comments: int = Field(5, ge=1, le=10)
    max_files: Optional[int] = Field(5, ge=1, le=100, description="Max changed files to review")
    review_all_files: bool = Field(False, description="If true, review all supported files ignoring max_files")

    @field_validator("repo_url", mode="before")
    @classmethod
    def validate_repo_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            return v.strip().rstrip("/")
        return v


class GitHubPRFile(BaseModel):
    filename: str
    status: str
    additions: int
    deletions: int
    patch: Optional[str] = None


class GitHubSkippedFile(BaseModel):
    filename: str
    status: str = "unknown"
    reason: str


class GitHubPRInfo(BaseModel):
    title: str
    number: int
    state: str
    author: str
    base_branch: str
    head_branch: str
    base_sha: Optional[str] = None
    head_sha: Optional[str] = None
    description: Optional[str] = None
    files: List[GitHubPRFile]
    total_changed_files: int = 0
    total_fetched_files: int = 0
    url: str


class GitHubReviewResponse(BaseModel):
    pr_info: GitHubPRInfo
    summary: Optional[str] = None
    total_files_changed: int
    total_files_fetched: int
    total_files_reviewed: int
    skipped_files: List[GitHubSkippedFile] = Field(default_factory=list)
    file_reviews: List[ReviewResponse]
    severity_counts: Dict[str, int] = Field(default_factory=lambda: {
        "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0
    })
    total_suppressed_findings: int = 0
    engine_used: str = "groq"
    token_authenticated: bool = False


# ── Dataset audit ──────────────────────────────────────────────────────────────

class DatasetSplitStats(BaseModel):
    split: str
    path: str
    exists: bool
    record_count: Optional[int] = None
    missing_fields: Optional[dict] = None
    empty_fields: Optional[dict] = None
    duplicate_ids: Optional[int] = None
    exact_duplicate_records: Optional[int] = None
    duplicate_patch_comment_pairs: Optional[int] = None
    missing_oldf_count: Optional[int] = None
    label_distribution: Optional[dict] = None
    comment_length_stats: Optional[dict] = None
    error: Optional[str] = None


class DatasetAuditReport(BaseModel):
    audit_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    splits: List[DatasetSplitStats]
    cross_split_patch_comment_overlaps: Optional[dict] = None
    notes: List[str] = []


# ── Stats ──────────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_reviews: int
    total_comments: int
    total_suppressed: int = 0
    avg_processing_time_ms: int = 0
    engine_breakdown: dict
    recent_reviews: List[StoredReview]
    model_status: ModelStatus
    dataset_files_present: bool
