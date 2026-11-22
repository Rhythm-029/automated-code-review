"""
Dataset audit utilities.
"""
from __future__ import annotations

import json
import logging
import statistics
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..schemas import DatasetSplitStats

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {"oldf", "patch", "msg", "id", "y"}


def _load_jsonl(path: str) -> Tuple[List[dict], Optional[str]]:
    p = Path(path)
    if not p.exists():
        return [], f"File not found: {path}"
    records = []
    error = None
    try:
        with open(p, encoding="utf-8", errors="replace") as fh:
            for i, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    logger.warning("JSONL parse error at line %d in %s: %s", i, path, exc)
    except OSError as exc:
        error = str(exc)
    return records, error


def audit_split(split: str, path: str) -> Tuple[DatasetSplitStats, List[dict]]:
    records, error = _load_jsonl(path)

    if error and not records:
        return (
            DatasetSplitStats(split=split, path=path, exists=False, error=error),
            [],
        )

    n = len(records)
    p = Path(path)

    # Missing and empty fields
    missing: Dict[str, int] = {f: 0 for f in REQUIRED_FIELDS}
    empty: Dict[str, int] = {f: 0 for f in REQUIRED_FIELDS}
    missing_oldf = 0

    msg_lengths: List[int] = []
    label_dist: Dict[str, int] = {}
    ids: List[Any] = []
    exact_set: set = set()
    exact_dups = 0
    pair_set: set = set()
    pair_dups = 0

    for rec in records:
        for f in REQUIRED_FIELDS:
            if f not in rec:
                missing[f] += 1
            elif rec[f] is None or rec[f] == "":
                empty[f] += 1

        oldf_val = rec.get("oldf", None)
        if oldf_val is None or oldf_val == "":
            missing_oldf += 1

        msg_val = str(rec.get("msg", ""))
        msg_lengths.append(len(msg_val))

        y_val = str(rec.get("y", ""))
        label_dist[y_val] = label_dist.get(y_val, 0) + 1

        ids.append(rec.get("id"))

        key = (rec.get("patch", ""), rec.get("msg", ""))
        if key in exact_set:
            exact_dups += 1
        else:
            exact_set.add(key)

        pair_key = (str(rec.get("patch", ""))[:500], str(rec.get("msg", ""))[:200])
        if pair_key in pair_set:
            pair_dups += 1
        else:
            pair_set.add(pair_key)

    dup_ids = n - len(set(str(i) for i in ids))

    length_stats: Dict[str, float] = {}
    if msg_lengths:
        length_stats = {
            "min": min(msg_lengths),
            "max": max(msg_lengths),
            "mean": round(statistics.mean(msg_lengths), 1),
            "median": statistics.median(msg_lengths),
            "p95": sorted(msg_lengths)[int(0.95 * len(msg_lengths))],
        }

    stat = DatasetSplitStats(
        split=split,
        path=path,
        exists=p.exists(),
        record_count=n,
        missing_fields={k: v for k, v in missing.items() if v > 0},
        empty_fields={k: v for k, v in empty.items() if v > 0},
        duplicate_ids=dup_ids,
        exact_duplicate_records=exact_dups,
        duplicate_patch_comment_pairs=pair_dups,
        missing_oldf_count=missing_oldf,
        label_distribution=label_dist,
        comment_length_stats=length_stats,
        error=error,
    )
    return stat, records


def cross_split_overlap(valid_records: List[dict], test_records: List[dict]) -> dict:
    """Find patch-comment pairs that appear in both valid and test splits."""
    valid_pairs = {
        (str(r.get("patch", ""))[:500], str(r.get("msg", ""))[:200])
        for r in valid_records
    }
    test_pairs = {
        (str(r.get("patch", ""))[:500], str(r.get("msg", ""))[:200])
        for r in test_records
    }
    overlap = valid_pairs & test_pairs
    return {
        "valid_unique_pairs": len(valid_pairs),
        "test_unique_pairs": len(test_pairs),
        "overlapping_pairs": len(overlap),
        "note": (
            "Overlapping pairs indicate potential data leakage between validation and test splits. "
            "Review and remove overlapping test examples before evaluating models."
        ),
    }
