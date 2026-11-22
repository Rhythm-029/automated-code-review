#!/usr/bin/env python3
"""
Fine-tuning pipeline for CodeT5-small on the CodeReviewer dataset.

Usage:
  # Smoke test (tiny subset, ~1 minute):
  python ml/train.py --smoke-test

  # Full training (requires dataset + GPU/large RAM):
  python ml/train.py --epochs 3 --batch-size 4 --max-samples 50000

WARNING: Full training on the complete dataset (117k records) requires
significant compute. Smoke-test mode uses 100 examples and runs only
1 epoch to verify the pipeline works without claiming real training results.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SEED = 42
random.seed(SEED)


def _set_seeds(seed: int = SEED) -> None:
    import numpy as np
    import torch
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _load_split(path: Path, max_samples: int | None = None) -> list[dict]:
    records = []
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")
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
                continue
            if max_samples and len(records) >= max_samples:
                break
    return records


def train(
    dataset_dir: str,
    output_dir: str,
    model_name: str = "Salesforce/codet5-small",
    epochs: int = 3,
    batch_size: int = 4,
    max_samples: int | None = None,
    smoke_test: bool = False,
    seed: int = SEED,
) -> None:
    try:
        import torch
        from transformers import (
            AutoTokenizer,
            AutoModelForSeq2SeqLM,
            Seq2SeqTrainer,
            Seq2SeqTrainingArguments,
            DataCollatorForSeq2Seq,
            EarlyStoppingCallback,
        )
        from datasets import Dataset  # type: ignore
    except ImportError as e:
        logger.error("Missing dependency: %s", e)
        logger.error("Install with: pip install transformers torch datasets")
        sys.exit(1)

    _set_seeds(seed)

    if smoke_test:
        logger.warning("=" * 60)
        logger.warning("SMOKE TEST MODE — training on tiny subset.")
        logger.warning("Results are NOT representative of a trained model.")
        logger.warning("=" * 60)
        max_samples = 100
        epochs = 1
        batch_size = 2

    dd = Path(dataset_dir)
    train_records = _load_split(dd / "msg-train.jsonl", max_samples)
    valid_records = _load_split(dd / "msg-valid.jsonl", min(1000, max_samples or 1000))

    logger.info("Train: %d | Valid: %d", len(train_records), len(valid_records))

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

    MAX_INPUT = 512
    MAX_TARGET = 128

    def tokenize_batch(examples):
        inputs = tokenizer(
            examples["patch"],
            max_length=MAX_INPUT,
            truncation=True,
            padding=False,
        )
        targets = tokenizer(
            examples["msg"],
            max_length=MAX_TARGET,
            truncation=True,
            padding=False,
        )
        inputs["labels"] = targets["input_ids"]
        return inputs

    def make_dataset(records):
        return Dataset.from_dict({
            "patch": [r["patch"] for r in records],
            "msg": [r["msg"] for r in records],
        }).map(tokenize_batch, batched=True, remove_columns=["patch", "msg"])

    train_ds = make_dataset(train_records)
    valid_ds = make_dataset(valid_records)

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    training_args = Seq2SeqTrainingArguments(
        output_dir=str(out),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        predict_with_generate=True,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        seed=seed,
        logging_steps=50,
        report_to="none",
        fp16=False,
    )

    collator = DataCollatorForSeq2Seq(tokenizer, model=model, padding=True)

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=valid_ds,
        tokenizer=tokenizer,
        data_collator=collator,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    logger.info("Starting training…")
    trainer.train()

    # Save final checkpoint
    final_dir = out / "final"
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))

    # Write metadata
    meta = {
        "model_name": model_name,
        "smoke_test": smoke_test,
        "epochs": epochs,
        "batch_size": batch_size,
        "train_samples": len(train_records),
        "valid_samples": len(valid_records),
        "seed": seed,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "output_dir": str(final_dir),
    }
    (out / "training_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    logger.info("Training complete. Checkpoint saved to: %s", final_dir)

    if smoke_test:
        logger.warning("SMOKE TEST COMPLETE — not a production model.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune CodeT5 on the CodeReviewer dataset.")
    parser.add_argument("--dataset-dir", default="dataset")
    parser.add_argument("--output-dir", default="models/codet5-finetuned")
    parser.add_argument("--model-name", default="Salesforce/codet5-small")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--max-samples", type=int, default=None)
    parser.add_argument("--smoke-test", action="store_true", help="Run a quick sanity check on 100 examples.")
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()

    train(
        dataset_dir=args.dataset_dir,
        output_dir=args.output_dir,
        model_name=args.model_name,
        epochs=args.epochs,
        batch_size=args.batch_size,
        max_samples=args.max_samples,
        smoke_test=args.smoke_test,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
