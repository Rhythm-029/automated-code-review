# Model Strategy & Comparison Plan

## Overview

To determine the most effective approach for automated code review generation, the project plans a controlled comparison across **three distinct model comparison arms**. Each arm represents a different paradigm of model capacity, fine-tuning compute requirements, and deployment efficiency.

## Model Comparison Arms

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                 Comparison Arms                        │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
         ┌────────────────────────────────────────────────┼────────────────────────────────────────────────┐
         │                                                │                                                │
         ▼                                                ▼                                                ▼
┌────────────────────────────────┐              ┌────────────────────────────────┐              ┌────────────────────────────────┐
│   Arm 1: Zero-Shot Prompting   │              │ Arm 2: CodeT5-220M Fine-Tuning │              │   Arm 3: QLoRA LLM Fine-Tuning │
│  (Off-the-shelf LLM Baseline)  │              │  (Specialized Compact Baseline)│              │ (CodeLlama-7B / StarCoder2-3B) │
└────────────────────────────────┘              └────────────────────────────────┘              └────────────────────────────────┘
```

### Arm 1: Zero-Shot / Few-Shot Prompting Baseline
- **Description**: Prompting general-purpose off-the-shelf LLMs (such as GPT-3.5/GPT-4 API or open zero-shot models) directly with code diffs without parameter updates.
- **Rationale**: Establishes a zero-effort baseline to measure how well un-tuned models understand code diffs and review tasks out of the box using structured prompt engineering.

### Arm 2: CodeT5-220M Full Fine-Tuning Baseline
- **Description**: Full parameter fine-tuning of `CodeT5-220M` (an encoder-decoder architecture specialized for code) on the processed CodeReviewer dataset.
- **Rationale**: Serves as a lightweight, domain-specific baseline. Encoder-decoder models excel at sequence-to-sequence translation tasks (diff $\rightarrow$ comment) with minimal memory footprint during inference.

### Arm 3: Parameter-Efficient Fine-Tuning (QLoRA) on Open LLMs
- **Description**: Fine-tuning modern decoder-only code LLMs (`CodeLlama-7B` or `StarCoder2-3B`) using 4-bit Quantized Low-Rank Adaptation (QLoRA).
- **Rationale**: Evaluates whether larger generative models, when adapted via parameter-efficient techniques, achieve superior reasoning and natural phrasing while remaining trainable on consumer/free-tier GPUs (e.g., Google Colab / Kaggle T4).

## Why Compare All Three Arms?

1. **Performance vs. Resource Trade-off**: Zero-shot requires no training compute but may lack domain specificity. Full fine-tuning of CodeT5 provides high specificity at small scale. QLoRA provides modern LLM reasoning capacity with parameter efficiency.
2. **Hallucination Rate Analysis**: Comparing baseline zero-shot LLM output against domain fine-tuned models reveals whether fine-tuning inherently reduces hallucinations or if explicit screening remains essential.
3. **Deployment Feasibility**: Smaller fine-tuned models or quantized LLMs can be deployed locally via `llama.cpp` on low-cost CPU instances.
