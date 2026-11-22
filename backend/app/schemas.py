"""
Pydantic schemas for request validation and response serialisation.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
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


# ── Review request ─────────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    patch: str = Field(..., description="Git diff / patch to review")
    oldf: Optional[str] = Field(None, description="Optional original source file for context")
    engine: Optional[str] = Field(None, description="Override the configured engine")
    max_comments: int = Field(5, ge=1, le=10, description="Maximum number of comments to return")

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
    file_path: Optional[str] = None
    code_snippet: Optional[str] = None
    confidence: Optional[float] = None


# ── Review response ────────────────────────────────────────────────────────────

class ReviewResponse(BaseModel):
    review_id: str
    status: str = "success"
    engine: str
    mode: EngineMode
    duration_ms: int
    patch_chars: int
    comments: List[ReviewComment]
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── Stored review ──────────────────────────────────────────────────────────────

class StoredReview(BaseModel):
    review_id: str
    engine: str
    mode: EngineMode
    duration_ms: int
    patch_chars: int
    patch_preview: str          # first 300 chars of the patch
    comments: List[ReviewComment]
    comment_count: int
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


# ── GitHub PR ──────────────────────────────────────────────────────────────────

class GitHubTokenStatus(BaseModel):
    configured: bool
    valid: bool
    username: Optional[str] = None
    rate_limit_limit: Optional[int] = None
    rate_limit_remaining: Optional[int] = None
    error: Optional[str] = None


class GitHubPRRequest(BaseModel):
    repo_url: str = Field(..., description="GitHub repository URL or owner/repo format")
    pr_number: int = Field(..., ge=1)
    engine: Optional[str] = None
    max_comments: int = Field(5, ge=1, le=10)
    max_files: Optional[int] = Field(3, ge=1, le=100, description="Max changed files to review (or None/0 for all)")
    review_all_files: bool = Field(False, description="If true, review all supported files ignoring max_files")

    @field_validator("repo_url")
    @classmethod
    def validate_repo_url(cls, v: str) -> str:
        s = v.strip().rstrip("/")
        # Allow owner/repo format (e.g. facebook/react) or full URLs
        if "/" not in s:
            raise ValueError("repo_url must be a GitHub URL or 'owner/repo' format")
        return s


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
    files: List[GitHubPRFile]
    total_changed_files: int = 0
    total_fetched_files: int = 0
    url: str


class GitHubReviewResponse(BaseModel):
    pr_info: GitHubPRInfo
    total_files_changed: int
    total_files_fetched: int
    total_files_reviewed: int
    skipped_files: List[GitHubSkippedFile] = Field(default_factory=list)
    file_reviews: List[ReviewResponse]
    engine_used: str = "ollama"
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
    audit_timestamp: datetime = Field(default_factory=datetime.utcnow)
    splits: List[DatasetSplitStats]
    cross_split_patch_comment_overlaps: Optional[dict] = None
    notes: List[str] = []


# ── Stats ──────────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_reviews: int
    total_comments: int
    engine_breakdown: dict
    recent_reviews: List[StoredReview]
    model_status: ModelStatus
    dataset_files_present: bool
