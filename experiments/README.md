# Experiments Directory

This directory tracks experiment configurations, prompt iterations, fine-tuning scripts, and evaluation logs across model comparison arms.

## Structure
- `prompts/`: Versioned prompt templates for zero-shot and few-shot baselines.
- `configs/`: DeepSpeed, QLoRA, and HuggingFace training YAML/JSON configurations.
- `results/`: CSV/JSON logs containing automated metric outputs (BLEU-4, ROUGE-L, BERTScore) and human audit annotations.
