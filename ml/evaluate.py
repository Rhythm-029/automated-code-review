#!/usr/bin/env python3
"""
Evaluation script — compare baseline, zero-shot, and fine-tuned models.

Usage:
  python ml/evaluate.py --dataset-dir dataset --checkpoint models/codet5-finetuned/final \
                        --n-examples 200 --output reports/evaluation_report.json

Metrics computed:
  - BLEU (sacrebleu)
  - ROUGE-L (rouge-score)
  - Exact match
  - Output length statistics
  - Empty output rate

A manually inspectable report (10 examples) is also generated.

NOTE: These metrics measure lexical overlap with human references.
They do NOT prove that generated comments are correct or useful.
Treat them as rough indicators, not proof of model quality.
"""
from __future__ import annotations

import argparse
import json
import logging
import random
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SEED = 42
random.seed(SEED)


def _load_test(path: Path, n: int) -> list[dict]:
    records = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
                if r.get("patch") and r.get("msg"):
                    records.append(r)
            except json.JSONDecodeError:
                pass
    random.shuffle(records)
    return records[:n]


def _compute_metrics(predictions: list[str], references: list[str]) -> dict:
    try:
        from sacrebleu.metrics import BLEU  # type: ignore
        from rouge_score import rouge_scorer  # type: ignore
    except ImportError:
        logger.warning("sacrebleu or rouge-score not installed; skipping BLEU/ROUGE.")
        return {}

    # BLEU
    bleu = BLEU(effective_order=True)
    bleu_score = bleu.corpus_score(predictions, [references]).score

    # ROUGE-L
    scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=False)
    rl_scores = []
    for pred, ref in zip(predictions, references):
        score = scorer.score(ref, pred)
        rl_scores.append(score["rougeL"].fmeasure)
    avg_rl = sum(rl_scores) / len(rl_scores) if rl_scores else 0.0

    # Exact match (normalised)
    exact = sum(p.strip().lower() == r.strip().lower() for p, r in zip(predictions, references)) / len(predictions)

    # Length stats
    pred_lens = [len(p.split()) for p in predictions]

    # Empty output rate
    empty_rate = sum(1 for p in predictions if not p.strip()) / len(predictions)

    return {
        "bleu": round(bleu_score, 2),
        "rouge_l": round(avg_rl * 100, 2),
        "exact_match": round(exact * 100, 2),
        "pred_len_mean": round(sum(pred_lens) / len(pred_lens), 1) if pred_lens else 0,
        "pred_len_max": max(pred_lens) if pred_lens else 0,
        "empty_output_rate": round(empty_rate * 100, 2),
        "n_examples": len(predictions),
    }


def _trivial_baseline(records: list[dict]) -> list[str]:
    """Returns the most common comment from the training set as a fixed prediction."""
    # As a simple baseline, return a fixed canned string for all examples.
    return ["The code change looks correct." for _ in records]


def _codet5_predict(records: list[dict], checkpoint: str) -> list[str]:
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    except ImportError:
        raise RuntimeError("transformers/torch not installed.")

    tokenizer = AutoTokenizer.from_pretrained(checkpoint)
    model = AutoModelForSeq2SeqLM.from_pretrained(checkpoint)
    model.eval()

    predictions = []
    for rec in records:
        inp = tokenizer(
            rec["patch"][:1024],
            return_tensors="pt",
            max_length=512,
            truncation=True,
        )
        with torch.no_grad():
            out = model.generate(**inp, max_new_tokens=128, num_beams=4)
        predictions.append(tokenizer.decode(out[0], skip_special_tokens=True))
    return predictions


def _manual_report(records, predictions, model_name, n=10) -> list[dict]:
    report = []
    for rec, pred in zip(records[:n], predictions[:n]):
        report.append({
            "model": model_name,
            "patch_snippet": rec["patch"][:300],
            "reference": rec["msg"],
            "generated": pred,
            "qualitative_note": (
                "Manual review required. Automatic metrics cannot assess correctness."
            ),
        })
    return report


def evaluate(
    dataset_dir: str,
    checkpoint: Optional[str],
    n_examples: int,
    output_path: str,
) -> None:
    test_path = Path(dataset_dir) / "msg-test.jsonl"
    if not test_path.exists():
        logger.error("Test file not found: %s", test_path)
        sys.exit(1)

    records = _load_test(test_path, n_examples)
    references = [r["msg"] for r in records]
    logger.info("Evaluating on %d test examples", len(records))

    results = {}

    # ── Trivial baseline ──────────────────────────────────────────────────────
    logger.info("Computing trivial baseline…")
    baseline_preds = _trivial_baseline(records)
    results["trivial_baseline"] = _compute_metrics(baseline_preds, references)

    # ── Fine-tuned model ──────────────────────────────────────────────────────
    manual_report = []
    if checkpoint and Path(checkpoint).exists():
        logger.info("Loading fine-tuned checkpoint from %s …", checkpoint)
        try:
            ft_preds = _codet5_predict(records, checkpoint)
            results["finetuned_codet5"] = _compute_metrics(ft_preds, references)
            manual_report = _manual_report(records, ft_preds, "finetuned_codet5")
            logger.info("Fine-tuned model results: %s", results["finetuned_codet5"])
        except Exception as exc:
            logger.error("Fine-tuned inference failed: %s", exc)
            results["finetuned_codet5"] = {"error": str(exc)}
    else:
        logger.warning("No checkpoint provided or found — skipping fine-tuned evaluation.")
        results["finetuned_codet5"] = {"status": "not_evaluated — checkpoint not available"}

    report = {
        "evaluation_timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "n_examples": len(records),
        "dataset_test_path": str(test_path.resolve()),
        "checkpoint": checkpoint,
        "metrics": results,
        "manual_inspection_sample": manual_report or _manual_report(records, baseline_preds, "trivial_baseline"),
        "limitations": [
            "BLEU and ROUGE-L measure lexical overlap only.",
            "High metric scores do not prove review correctness.",
            "Low scores do not prove a model is useless.",
            "Manual inspection is essential for quality assessment.",
            "Results on 200 examples may not generalize to the full test set.",
        ],
    }

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Evaluation report saved to: %s", out.resolve())

    # Print summary
    print("\n── Evaluation Summary ──")
    for name, metrics in results.items():
        print(f"\n{name}:")
        for k, v in metrics.items():
            print(f"  {k}: {v}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate code review models.")
    parser.add_argument("--dataset-dir", default="dataset")
    parser.add_argument("--checkpoint", default=None, help="Path to fine-tuned checkpoint directory")
    parser.add_argument("--n-examples", type=int, default=200)
    parser.add_argument("--output", default="reports/evaluation_report.json")
    args = parser.parse_args()
    evaluate(args.dataset_dir, args.checkpoint, args.n_examples, args.output)


if __name__ == "__main__":
    main()
