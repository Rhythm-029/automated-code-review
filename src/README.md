# Source Code (`src/`)

This directory will contain core Python modules for dataset processing, model fine-tuning, hallucination screening, and inference.

## Planned Module Structure
- `dataset/`: Parsers for PR diffs, tokenization scripts, and dataset cleaning routines.
- `models/`: Model wrappers, zero-shot prompt templates, CodeT5 fine-tuning, and QLoRA training modules.
- `screening/`: AST-based symbol grounding, DeBERTa-MNLI entailment inference, and confidence gate decision logic.
- `utils/`: Common logging, config loading, and metric evaluation helpers.
