#!/usr/bin/env python3
"""
Quick inference script — run the configured review engine on a patch from CLI.

Usage:
  python ml/infer.py --patch-file sample.diff
  echo "@@ -1,2 +1,3 @@ ..." | python ml/infer.py
  python ml/infer.py --patch "@@ -1,1 +1,3 @@\n def f(): pass"
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.config import settings
from backend.app.services.engines import build_engine


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the review engine on a patch.")
    parser.add_argument("--patch", default=None, help="Patch string")
    parser.add_argument("--patch-file", default=None, help="Path to a .diff file")
    parser.add_argument("--max-comments", type=int, default=5)
    args = parser.parse_args()

    if args.patch_file:
        patch = Path(args.patch_file).read_text(encoding="utf-8")
    elif args.patch:
        patch = args.patch
    elif not sys.stdin.isatty():
        patch = sys.stdin.read()
    else:
        parser.error("Provide --patch, --patch-file, or pipe a diff via stdin.")

    engine = build_engine(settings)
    print(f"Engine: {engine.name} | Mode: {engine.mode}\n")

    comments, raw = engine.generate_review(patch=patch, max_comments=args.max_comments)

    print("── Review Comments ──")
    for i, c in enumerate(comments, 1):
        print(f"\n{i}. [{c.severity.upper()}] {c.title}")
        print(f"   Category: {c.category}")
        print(f"   Body: {c.body[:300]}")
        if c.suggestion:
            print(f"   Suggestion: {c.suggestion}")


if __name__ == "__main__":
    main()
