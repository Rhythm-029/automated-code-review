# Deployment Plan & Technical Architecture

## Planned Deployment Path

The project defines a cost-effective, CPU-accessible deployment pathway aimed at integrating automated code review assistance directly into GitHub pull request workflows.

```text
QLoRA Fine-Tuned Model (PyTorch Checkpoint)
       │
       ▼
4-bit Quantization (GGUF Format)
       │
       ▼
llama.cpp Runtime Engine (CPU-Optimized Inference)
       │
       ▼
FastAPI Service Wrapper (REST API Endpoints)
       │
       ▼
GitHub Action Runner (Triggered on PR Event)
       │
       ▼
AI-Generated Draft PR Comment
       │
       ▼
Human Reviewer (Final Review & Approval)
```

## Step-by-Step Architecture Overview

1. **Model Optimization**: The fine-tuned QLoRA weights are merged into the base model and quantized to **4-bit precision** into `GGUF` format to reduce disk footprint and RAM consumption.
2. **Inference Engine**: `llama.cpp` acts as the execution backend, enabling fast LLM token generation on standard CPU server instances without requiring high-cost GPUs.
3. **API Web Server**: A lightweight `FastAPI` server exposes endpoints:
   - `/review`: Receives diff context, executes generation, runs hallucination screening, and returns draft comment or abstention status.
   - `/health`: Endpoint for container readiness and liveness checks.
4. **CI/CD Action Integration**: A custom `GitHub Action` workflow triggers whenever a pull request is opened or updated. It fetches the PR git diff, calls the FastAPI endpoint, and posts emitted comments as draft inline PR reviews.
5. **Human Oversight**: Generated comments are explicitly flagged with AI attribution banners. Human reviewers decide whether to accept, edit, or delete the comment.

## Implementation Status Statement

> **Important**: The deployment architecture detailed above represents the **planned deployment blueprint**. CPU deployment, FastAPI server implementation, and GitHub Action workflows are currently in design status and **must not be marked as fully implemented** until the backend services and workflow YAMLs are created and validated in the codebase.
