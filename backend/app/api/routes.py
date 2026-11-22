"""
FastAPI routers.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..config import settings
from ..schemas import (
    Category,
    DashboardStats,
    DatasetAuditReport,
    DatasetSplitStats,
    EngineMode,
    GitHubReviewResponse,
    GitHubPRRequest,
    GitHubSkippedFile,
    GitHubTokenStatus,
    ModelStatus,
    ReviewComment,
    ReviewRequest,
    ReviewResponse,
    Severity,
    StoredReview,
)
from ..services.engines import DemoEngine, OllamaEngine

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Dependency helpers ─────────────────────────────────────────────────────────

def get_engine(request: Request):
    return request.app.state.engine


def get_store(request: Request):
    return request.app.state.store


def get_github_service(request: Request):
    return request.app.state.github


# ── Health ─────────────────────────────────────────────────────────────────────

@router.get("/health", tags=["system"])
async def health():
    ollama_ok = False
    try:
        with httpx.Client(timeout=2.0) as client:
            r = client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            ollama_ok = (r.status_code == 200)
    except Exception:
        pass

    return {
        "status": "ok",
        "service": "automated-code-review",
        "active_engine": settings.active_engine,
        "ollama_reachable": ollama_ok,
        "ollama_model": settings.OLLAMA_MODEL,
    }


@router.get("/health/ollama", tags=["system"])
async def health_ollama():
    """Confirms whether the backend can reach the local Ollama instance and find the required model."""
    try:
        with httpx.Client(timeout=4.0) as client:
            res = client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                has_target = any(settings.OLLAMA_MODEL in m for m in models)
                return {
                    "status": "ok" if has_target else "model_missing",
                    "ollama_reachable": True,
                    "base_url": settings.OLLAMA_BASE_URL,
                    "target_model": settings.OLLAMA_MODEL,
                    "target_model_installed": has_target,
                    "installed_models": models,
                }
            return {
                "status": "error",
                "ollama_reachable": False,
                "base_url": settings.OLLAMA_BASE_URL,
                "error": f"Ollama returned HTTP {res.status_code}",
            }
    except Exception as exc:
        return {
            "status": "error",
            "ollama_reachable": False,
            "base_url": settings.OLLAMA_BASE_URL,
            "target_model": settings.OLLAMA_MODEL,
            "error": str(exc),
            "help": f"Ensure Ollama is running locally (`ollama serve` or Ollama app) and accessible at {settings.OLLAMA_BASE_URL}.",
        }


# ── Model status ───────────────────────────────────────────────────────────────

@router.get("/model/status", response_model=ModelStatus, tags=["model"])
async def model_status(engine=Depends(get_engine)):
    errors: List[str] = []
    notes: List[str] = []
    active = settings.active_engine

    if settings.REVIEW_ENGINE.lower() != active:
        errors.append(
            f"Configured engine '{settings.REVIEW_ENGINE}' is not usable "
            f"(missing credentials). Falling back to '{active}'."
        )

    if active == "ollama":
        status_dict = engine.get_status() if hasattr(engine, "get_status") else {}
        is_reachable = status_dict.get("ollama_reachable", False)
        is_model_present = status_dict.get("model_present", False)
        checkpoint_loaded = is_reachable and is_model_present
        if not is_reachable:
            errors.append(
                f"Cannot connect to local Ollama at {settings.OLLAMA_BASE_URL}. "
                "Ensure Ollama is running (`ollama serve` or start Ollama app)."
            )
        elif not is_model_present:
            errors.append(
                f"Model '{settings.OLLAMA_MODEL}' was not found in local Ollama installation. "
                f"Run: ollama run {settings.OLLAMA_MODEL}"
            )
        else:
            notes.append(f"Connected to local Ollama at {settings.OLLAMA_BASE_URL} using '{settings.OLLAMA_MODEL}'.")
    elif active == "demo":
        checkpoint_loaded = False
        notes.append(
            "Running in DEMO MODE. No real model is configured. "
            "Set REVIEW_ENGINE=ollama in your .env to use local Ollama."
        )
    elif active == "finetuned":
        info = engine.get_status()
        notes.append(f"Fine-tuned checkpoint loaded from: {settings.FINETUNED_MODEL_PATH}")
        checkpoint_loaded = info.get("loaded", False)
    else:
        checkpoint_loaded = active != "demo"

    return ModelStatus(
        configured_engine=settings.REVIEW_ENGINE,
        active_engine=active,
        mode=EngineMode.demo if active == "demo" else EngineMode.real_model,
        model_identifier=_resolve_model_id(active),
        checkpoint_loaded=checkpoint_loaded,
        training_status="not_started",
        configuration_errors=errors,
        notes=notes,
    )


def _resolve_model_id(active: str) -> Optional[str]:
    if active == "ollama":
        return settings.OLLAMA_MODEL
    if active == "openai":
        return settings.OPENAI_MODEL
    if active == "anthropic":
        return settings.ANTHROPIC_MODEL
    if active == "finetuned":
        return settings.FINETUNED_MODEL_PATH
    return None


# ── Review ──────────────────────────────────────────────────────────────────────

@router.post("/review", response_model=ReviewResponse, tags=["review"])
async def create_review(req: ReviewRequest, engine=Depends(get_engine), store=Depends(get_store)):
    if len(req.patch) > settings.MAX_PATCH_CHARS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Patch exceeds maximum size of {settings.MAX_PATCH_CHARS} characters.",
        )

    # Resolve active engine based on request or default
    active_engine = engine
    if req.engine:
        req_eng = req.engine.lower()
        if req_eng == "demo":
            active_engine = DemoEngine()
        elif req_eng == "ollama":
            active_engine = (
                engine
                if engine.name == "ollama"
                else OllamaEngine(
                    base_url=settings.OLLAMA_BASE_URL,
                    model=settings.OLLAMA_MODEL,
                    timeout=settings.OLLAMA_TIMEOUT,
                )
            )

    t0 = time.perf_counter()
    try:
        comments, _raw = active_engine.generate_review(
            patch=req.patch,
            oldf=req.oldf,
            max_comments=req.max_comments,
        )
    except Exception as exc:
        logger.exception("Engine error during review generation")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{exc}",
        )
    duration_ms = int((time.perf_counter() - t0) * 1000)

    response = ReviewResponse(
        review_id=str(uuid.uuid4()),
        engine=active_engine.name,
        mode=active_engine.mode,
        duration_ms=duration_ms,
        patch_chars=len(req.patch),
        comments=comments,
    )

    try:
        store.save_review(response, req.patch)
    except Exception as exc:
        logger.warning("Could not save review to store: %s", exc)

    return response


# ── Review history ──────────────────────────────────────────────────────────────

@router.get("/reviews", response_model=List[StoredReview], tags=["reviews"])
async def list_reviews(store=Depends(get_store), limit: int = 50):
    return store.get_all(limit=min(limit, 100))


@router.get("/reviews/{review_id}", response_model=StoredReview, tags=["reviews"])
async def get_review(review_id: str, store=Depends(get_store)):
    review = store.get_by_id(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    return review


@router.delete("/reviews/{review_id}", tags=["reviews"])
async def delete_review(review_id: str, store=Depends(get_store)):
    deleted = store.delete_by_id(review_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Review not found.")
    return {"status": "deleted", "review_id": review_id}


# ── Dashboard stats ────────────────────────────────────────────────────────────

@router.get("/stats", response_model=DashboardStats, tags=["stats"])
async def dashboard_stats(engine=Depends(get_engine), store=Depends(get_store)):
    s = store.stats()
    recent = store.get_all(limit=5)
    active = settings.active_engine

    ms = ModelStatus(
        configured_engine=settings.REVIEW_ENGINE,
        active_engine=active,
        mode=EngineMode.demo if active == "demo" else EngineMode.real_model,
        model_identifier=_resolve_model_id(active),
        checkpoint_loaded=active != "demo",
        training_status="not_started",
    )

    dataset_present = (
        settings.dataset_train.exists()
        or settings.dataset_valid.exists()
        or settings.dataset_test.exists()
    )

    return DashboardStats(
        total_reviews=s["total_reviews"],
        total_comments=s["total_comments"],
        engine_breakdown=s["engine_breakdown"],
        recent_reviews=recent,
        model_status=ms,
        dataset_files_present=dataset_present,
    )


# ── GitHub Integration ─────────────────────────────────────────────────────────

@router.get("/github/status", response_model=GitHubTokenStatus, tags=["github"])
async def github_status(github=Depends(get_github_service)):
    """Check GitHub token validity and remaining API rate limit quota."""
    if github is None:
        return GitHubTokenStatus(
            configured=False,
            valid=False,
            error="GitHub service is unavailable.",
        )
    info = github.verify_token()
    return GitHubTokenStatus(
        configured=info.get("configured", False),
        valid=info.get("valid", False),
        username=info.get("username"),
        rate_limit_limit=info.get("rate_limit_limit"),
        rate_limit_remaining=info.get("rate_limit_remaining"),
        error=info.get("error"),
    )


@router.post("/github/pull-request", response_model=GitHubReviewResponse, tags=["github"])
async def review_github_pr(
    req: GitHubPRRequest,
    engine=Depends(get_engine),
    store=Depends(get_store),
    github=Depends(get_github_service),
):
    if github is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub integration service is not available.",
        )

    try:
        pr_info = github.fetch_pull_request(req.repo_url, req.pr_number)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("GitHub PR fetch failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub API error: {exc}",
        )

    # Determine review engine (default to configured engine e.g. ollama)
    active_engine = engine
    if req.engine:
        req_eng = req.engine.lower()
        if req_eng == "demo":
            active_engine = DemoEngine()
        elif req_eng == "ollama":
            active_engine = (
                engine
                if engine.name == "ollama"
                else OllamaEngine(
                    base_url=settings.OLLAMA_BASE_URL,
                    model=settings.OLLAMA_MODEL,
                    timeout=settings.OLLAMA_TIMEOUT,
                )
            )

    file_reviews: List[ReviewResponse] = []
    skipped_files: List[GitHubSkippedFile] = []

    # Categorize files
    reviewable_files = []
    for f in pr_info.files:
        if f.status == "removed":
            skipped_files.append(
                GitHubSkippedFile(filename=f.filename, status=f.status, reason="File removed/deleted in pull request")
            )
        elif not f.patch or not f.patch.strip():
            skipped_files.append(
                GitHubSkippedFile(
                    filename=f.filename,
                    status=f.status,
                    reason="Binary file or diff omitted by GitHub (>3000 lines or >1MB patch)",
                )
            )
        else:
            reviewable_files.append(f)

    # Apply file limit unless review_all_files is set or max_files is 0/None
    if req.review_all_files:
        files_to_review = reviewable_files
    elif req.max_files and req.max_files > 0:
        files_to_review = reviewable_files[:req.max_files]
        for f in reviewable_files[req.max_files:]:
            skipped_files.append(
                GitHubSkippedFile(
                    filename=f.filename,
                    status=f.status,
                    reason=f"Omitted by file limit ({req.max_files} of {len(reviewable_files)} reviewable files)",
                )
            )
    else:
        files_to_review = reviewable_files

    for pr_file in files_to_review:
        patch = pr_file.patch[:settings.MAX_PATCH_CHARS]
        t0 = time.perf_counter()
        try:
            comments, _ = active_engine.generate_review(
                patch=patch,
                max_comments=req.max_comments,
                filename=pr_file.filename,
            )
        except Exception as exc:
            logger.warning("Skipping file %s due to engine error: %s", pr_file.filename, exc)
            comments = [
                ReviewComment(
                    title=f"Review Skipped: {pr_file.filename}",
                    body=f"Review engine error: {exc}",
                    severity=Severity.info,
                    category=Category.general,
                    file_path=pr_file.filename,
                )
            ]
        duration_ms = int((time.perf_counter() - t0) * 1000)

        review_resp = ReviewResponse(
            review_id=str(uuid.uuid4()),
            engine=active_engine.name,
            mode=active_engine.mode,
            duration_ms=duration_ms,
            patch_chars=len(patch),
            comments=comments,
        )
        try:
            store.save_review(review_resp, patch)
        except Exception:
            pass
        file_reviews.append(review_resp)

    return GitHubReviewResponse(
        pr_info=pr_info,
        total_files_changed=pr_info.total_changed_files or len(pr_info.files),
        total_files_fetched=len(pr_info.files),
        total_files_reviewed=len(files_to_review),
        skipped_files=skipped_files,
        file_reviews=file_reviews,
        engine_used=active_engine.name,
        token_authenticated=github.is_authenticated,
    )


# ── Dataset audit ──────────────────────────────────────────────────────────────

@router.get("/dataset/audit", response_model=DatasetAuditReport, tags=["dataset"])
async def dataset_audit():
    """Run a lightweight dataset audit and return statistics."""
    from ..services.dataset_audit import audit_split, cross_split_overlap

    splits_info = [
        ("train", settings.dataset_train),
        ("valid", settings.dataset_valid),
        ("test", settings.dataset_test),
    ]

    split_stats = []
    split_data: dict = {}

    for name, path in splits_info:
        stat, records = audit_split(name, str(path))
        split_stats.append(stat)
        split_data[name] = records

    overlap = cross_split_overlap(
        split_data.get("valid", []),
        split_data.get("test", []),
    )

    return DatasetAuditReport(
        splits=split_stats,
        cross_split_patch_comment_overlaps=overlap,
        notes=[
            "Audit performed on raw dataset files without modification.",
            "Original files are never altered by this endpoint.",
        ],
    )
