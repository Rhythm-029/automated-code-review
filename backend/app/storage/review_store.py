"""
Persistent JSON-based review history store.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import List, Optional

from ..schemas import StoredReview, ReviewResponse, EngineMode

logger = logging.getLogger(__name__)

_lock = Lock()


class ReviewStore:
    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._path.write_text("[]", encoding="utf-8")

    def _load(self) -> List[dict]:
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.error("Could not load review store: %s", exc)
            return []

    def _save(self, records: List[dict]) -> None:
        self._path.write_text(
            json.dumps(records, ensure_ascii=False, default=str, indent=2),
            encoding="utf-8",
        )

    def save_review(self, response: ReviewResponse, patch: str) -> StoredReview:
        stored = StoredReview(
            review_id=response.review_id,
            engine=response.engine,
            mode=response.mode,
            duration_ms=response.duration_ms,
            patch_chars=response.patch_chars,
            patch_preview=patch[:300],
            summary=response.summary,
            comments=response.comments,
            comment_count=len(response.comments),
            suppressed_count=response.suppressed_findings,
            severity_counts=response.severity_counts,
            created_at=response.created_at,
        )
        with _lock:
            records = self._load()
            records.insert(0, json.loads(stored.model_dump_json()))
            self._save(records[:500])
        return stored

    def get_all(self, limit: int = 50) -> List[StoredReview]:
        with _lock:
            records = self._load()
        results = []
        for r in records[:limit]:
            try:
                results.append(StoredReview(**r))
            except Exception as exc:
                logger.warning("Skipping malformed review record: %s", exc)
        return results

    def get_by_id(self, review_id: str) -> Optional[StoredReview]:
        with _lock:
            records = self._load()
        for r in records:
            if r.get("review_id") == review_id:
                try:
                    return StoredReview(**r)
                except Exception:
                    return None
        return None

    def delete_by_id(self, review_id: str) -> bool:
        with _lock:
            records = self._load()
            before = len(records)
            records = [r for r in records if r.get("review_id") != review_id]
            if len(records) == before:
                return False
            self._save(records)
        return True

    def stats(self) -> dict:
        with _lock:
            records = self._load()
        total_comments = sum(r.get("comment_count", 0) for r in records)
        total_suppressed = sum(r.get("suppressed_count", 0) for r in records)
        durations = [r.get("duration_ms", 0) for r in records if r.get("duration_ms")]
        avg_duration = int(sum(durations) / len(durations)) if durations else 0

        engine_counts: dict = {}
        for r in records:
            e = r.get("engine", "unknown")
            engine_counts[e] = engine_counts.get(e, 0) + 1
        return {
            "total_reviews": len(records),
            "total_comments": total_comments,
            "total_suppressed": total_suppressed,
            "avg_processing_time_ms": avg_duration,
            "engine_breakdown": engine_counts,
        }
