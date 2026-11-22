# Project Lifecycle Framework

## Lifecycle Diagram

```text
Problem Understanding
→ Data Understanding
→ Data Preparation
→ Model Selection & Training
→ Evaluation
→ Deployment
→ Monitoring
→ Retraining
```

## Hybrid Methodology Integration

To ensure methodological rigor across data science, team engineering, and machine learning operations (MLOps), this project adopts a **hybrid lifecycle approach** combining three industry-standard methodologies:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              CRISP-DM                                  │
│  • Problem Understanding  • Data Understanding  • Data Preparation     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                                TDSP                                    │
│  • Team Roles  • Git Workflows  • Structured Repository Layout         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                        Google ML Life Cycle                            │
│  • Model Selection & Training  • Evaluation  • Quantized Deployment    │
│  • Monitoring  • Future Retraining                                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. CRISP-DM (Cross-Industry Standard Process for Data Mining)
- **Role**: Problem formulation, dataset analysis, cleaning, and ethical assessment.
- **Application**: Used during early phases to understand code diff formats, analyze pull request comment structures, define cleaning filters (e.g., removing bot comments and trivial approvals), and ensure privacy/license compliance.

### 2. TDSP (Team Data Science Process - Microsoft)
- **Role**: Team collaboration, role allocation, and structured project governance.
- **Application**: Used for repository organization (`data/`, `src/`, `experiments/`, `docs/`, `deployment/`), Git branching strategy, documentation conventions, and task management across team members.

### 3. Google ML Life Cycle Principles
- **Role**: Operational ML training, evaluation metrics, model serving, and continuous lifecycle maintenance.
- **Application**: Guides model fine-tuning (QLoRA), multi-metric evaluation (BLEU-4, ROUGE-L, BERTScore, human audit), GGUF quantization, CPU serving via `llama.cpp` / FastAPI, and continuous monitoring/retraining strategies.

## Current Project Status Statement

> **Current status: Project planning, dataset acquisition/planning and system architecture have started. Model training and production deployment are not yet claimed as completed.**
