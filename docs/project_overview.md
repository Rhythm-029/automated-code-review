# Project Overview

## Title
**Automated Code Review Comment Generation Using Large Language Models**

## Executive Summary
This BTech capstone project investigates the application of Large Language Models (LLMs) for generating automated, context-aware review comments on pull request (PR) code diffs. Manual code review is an essential but resource-intensive software engineering practice. While LLMs offer promising capabilities in code understanding and generation, standard off-the-shelf models are prone to generating non-existent code references or ungrounded claims (hallucinations).

This project addresses these challenges by developing a dual-stage architecture:
1. **Candidate Comment Generation**: Leveraging fine-tuned code LLMs to produce review comments tailored to pull request code diffs.
2. **Hallucination Screening & Gating**: Applying symbol grounding and Natural Language Inference (NLI) to filter out hallucinated feedback before it reaches developers.

## Problem Statement
Software development teams dedicate significant time to code reviews to detect defects, enforce standards, and improve maintainability. However:
- Developer fatigue can lead to superficial or missed code reviews.
- Standard generative models often hallucinate non-existent variables, functions, or language APIs when commenting on code diffs.
- Unreliable AI review comments decrease developer trust and waste time during review iterations.

## Core Objectives
1. **Model Exploration & Comparison**: Evaluate zero-shot LLM prompting, compact fine-tuned baselines (CodeT5-220M), and parameter-efficient fine-tuning of open LLMs (CodeLlama-7B / StarCoder2-3B via QLoRA).
2. **Hallucination Reduction**: Implement a lightweight screening mechanism using Symbol Grounding and NLI (DeBERTa-MNLI) to evaluate entity existence and logical entailment.
3. **Abstention Gating**: Establish a confidence threshold permitting the model to abstain from commenting when certainty is low.
4. **Human-Centric Assistance**: Design the workflow as an assistant where generated drafts are clearly attributed to AI, leaving final authority with human reviewers.

## System Pipeline Overview

```text
[PR Code Diff + Context] ──► [LLM Candidate Generator] ──► [Symbol Grounding & NLI Screening]
                                                                     │
[Human Reviewer] ◄── [Draft Comment Emission] ◄── [Confidence Gate] ◄┘ (or Abstain)
```

## Target Audience
- Software developers seeking preliminary feedback prior to peer review.
- Peer reviewers aiming to automate checks for common code smells and bug patterns.
- Tech leads and maintainers interested in maintaining repository quality standards.
