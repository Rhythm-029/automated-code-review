#!/usr/bin/env python3
"""
Dataset audit script — inspect CodeReviewer JSONL splits and report statistics.

Usage:
    python ml/audit_dataset.py [--dataset-dir DATASET_DIR] [--output REPORT_PATH]

This script NEVER modifies the original dataset files.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Allow running from any location
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.services.dataset_audit import audit_split, cross_split_overlap

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit the CodeReviewer dataset JSONL splits.")
    parser.add_argument(
        "--dataset-dir",
        default="dataset",
        help="Directory containing msg-train.jsonl, msg-valid.jsonl, msg-test.jsonl",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Path to write the JSON audit report (default: print to stdout only)",
    )
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir)
    splits = {
        "train": dataset_dir / "msg-train.jsonl",
        "valid": dataset_dir / "msg-valid.jsonl",
        "test": dataset_dir / "msg-test.jsonl",
    }

    print("\n" + "=" * 60)
    print("  AUTOMATED CODE REVIEW — DATASET AUDIT")
    print(f"  Dataset directory: {dataset_dir.resolve()}")
    print(f"  Timestamp: {datetime.utcnow().isoformat()}Z")
    print("=" * 60 + "\n")

    all_stats = []
    split_records: dict = {}

    for name, path in splits.items():
        print(f"── Split: {name} ({'✓ exists' if path.exists() else '✗ NOT FOUND'}) ──")
        if not path.exists():
            print(f"   Path: {path.resolve()}")
            print("   Skipping — file not found.\n")
            all_stats.append({"split": name, "path": str(path), "exists": False})
            split_records[name] = []
            continue

        stat, records = audit_split(name, str(path))
        split_records[name] = records
        d = stat.model_dump()

        print(f"   Records           : {d['record_count']:,}")
        print(f"   Missing fields    : {d['missing_fields'] or 'none'}")
        print(f"   Empty fields      : {d['empty_fields'] or 'none'}")
        print(f"   Duplicate IDs     : {d['duplicate_ids']}")
        print(f"   Exact dup records : {d['exact_duplicate_records']}")
        print(f"   Dup patch-comment : {d['duplicate_patch_comment_pairs']}")
        print(f"   Missing oldf      : {d['missing_oldf_count']}")
        print(f"   Label distribution: {d['label_distribution']}")
        print(f"   Comment length    : {d['comment_length_stats']}")
        if d.get("error"):
            print(f"   ⚠ Error: {d['error']}")
        print()
        all_stats.append(d)

    print("── Cross-split analysis: valid ↔ test ──")
    overlap = cross_split_overlap(split_records.get("valid", []), split_records.get("test", []))
    for k, v in overlap.items():
        print(f"   {k}: {v}")

    report = {
        "audit_timestamp": datetime.utcnow().isoformat() + "Z",
        "dataset_dir": str(dataset_dir.resolve()),
        "splits": all_stats,
        "cross_split_overlap": overlap,
        "notes": [
            "Original dataset files were NOT modified.",
            "Overlapping test/valid pairs indicate potential evaluation leakage.",
            "Empty oldf fields mean no original-file context is available for those examples.",
        ],
    }

    if args.output:
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\n✓ Report written to: {out.resolve()}")
    else:
        print("\n── JSON Report ──")
        print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
