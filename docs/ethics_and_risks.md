# Ethics, Risk Analysis & Mitigation Strategies

## Overview

Deploying Large Language Models in software engineering workflows introduces technical, ethical, and operational risks. This document outlines identified risk factors and their corresponding mitigation strategies.

## Risk Matrix & Mitigation Strategies

### 1. Hallucinated Review Comments
- **Risk**: Generated comments may suggest incorrect bug fixes, cite non-existent functions, or hallucinate syntax rules, leading to developer confusion or incorrect code modifications.
- **Mitigation Strategy**:
  - Implement a dual-stage screening pipeline combining Symbol Grounding and NLI.
  - Enforce a strict Confidence Gate that favors *abstention* over uncertain generation.
  - Require explicit AI attribution labels on all emitted comments.

### 2. License & Data Provenance Issues
- **Risk**: Public open-source code datasets (such as GitHub PRs) may include code with restrictive licenses (e.g., GPL, copyleft) or accidentally leaked credentials/secrets.
- **Mitigation Strategy**:
  - Restrict dataset sources to repositories with permissive open-source licenses (e.g., MIT, Apache 2.0).
  - Apply automated PII, secret, and API token scrubbing prior to dataset ingestion.

### 3. Reviewer Over-Reliance (Automation Bias)
- **Risk**: Human code reviewers might blindly accept AI-generated draft comments without critical verification, passing subtle bugs into production.
- **Mitigation Strategy**:
  - Frame the tool strictly as an *assistant* generating initial draft suggestions.
  - Design the GitHub Action to post draft suggestions that require explicit human approval before blocking or approving a pull request.

### 4. Hardware & Free-Tier GPU Limitations
- **Risk**: Fine-tuning open LLMs (e.g., CodeLlama-7B / StarCoder2-3B) requires significant VRAM, exceeding standard consumer compute or free-tier cloud limits.
- **Mitigation Strategy**:
  - Adopt Parameter-Efficient Fine-Tuning via 4-bit Quantized LoRA (QLoRA) to reduce VRAM requirements.
  - Quantize models to 4-bit GGUF format for CPU-based serving via `llama.cpp`.

### 5. Limitations of Symbol Grounding + NLI Screening
- **Risk**: Symbol grounding verifies identifier presence but cannot fully validate complex logical reasoning; NLI models (like DeBERTa-MNLI) trained on natural text may exhibit domain transfer gaps when reasoning over code diffs.
- **Mitigation Strategy**:
  - Acknowledge screening limitations transparently in project documentation.
  - Conduct a dedicated human hallucination audit to measure residual hallucination rates and continuously tune the confidence gate threshold.
