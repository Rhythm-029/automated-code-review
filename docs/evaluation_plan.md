# Evaluation Plan & Target Metrics

## Overview

Evaluating automated code review comments requires a combination of automated textual similarity metrics and rigorous human qualitative assessment. This document details the planned multi-tier evaluation framework and target benchmarks.

> **Status Notice**: All metrics, thresholds, and target values listed in this document represent **planned evaluation targets**. No empirical test scores are claimed until training and testing execution are completed.

## 1. Automatic Generation Metrics

The generated review comments will be compared against human ground-truth review comments using standard Natural Language Generation (NLG) metrics:

- **BLEU-4**: Measures n-gram precision (up to 4-grams) between generated comments and reference comments.
- **ROUGE-L**: Measures longest common subsequence recall to assess structural fluency.
- **BERTScore**: Computes contextual embedding similarity between candidate and reference tokens to capture semantic equivalence beyond exact n-gram matching.

## 2. Human Qualitative Evaluation

To evaluate practical utility, a sample of generated comments across all model comparison arms will undergo human review based on four qualitative axes (scored 1 to 5):

1. **Relevance**: Does the comment accurately address code changed in the diff hunk?
2. **Correctness**: Is the technical feedback sound and free of logical/syntax fallacies?
3. **Actionability**: Does the comment provide clear guidance on how to fix or improve the code?
4. **Tone**: Is the tone constructiveness-oriented, professional, and non-confrontational?

### Inter-Annotator Agreement
To ensure human evaluation consistency across multiple reviewers, **Cohen's kappa ($\kappa$)** will be calculated across paired human ratings.

## 3. Hallucination Audit & Target Thresholds

A dedicated hallucination audit will evaluate the performance of the Symbol Grounding + NLI screening pipeline on a manually annotated audit subset of diff-comment outputs.

### Target Performance Metrics

| Evaluation Metric | Target Benchmark / Threshold | Description |
| :--- | :--- | :--- |
| **Hallucination Flag Precision** | $\ge 0.80$ | At least $80\%$ of comments flagged as hallucinations by the screening gate must be true hallucinations upon manual audit. |
| **Residual Hallucination Target** | $\le 10\%$ | Among comments that pass the confidence gate and are emitted, no more than $10\%$ should contain ungrounded or hallucinated claims. |
| **Abstention Rate Target** | Balanced | The confidence threshold will be tuned to maintain high precision while avoiding excessive abstention on valid comments. |
