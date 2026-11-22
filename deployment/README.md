# Deployment Directory

This directory contains configuration templates, API server code, and GitHub Action workflows for the planned deployment setup.

## Planned Deployment Artifacts
- `quantization/`: Model conversion scripts to convert PyTorch QLoRA models into 4-bit GGUF files for `llama.cpp`.
- `api/`: FastAPI web server implementation (`app.py`, endpoints, Pydantic schemas).
- `github_action/`: Workflow configuration file (`action.yml`) to invoke the automated review endpoint on PR events.

*Status: Deployment specifications are documented in `docs/deployment_plan.md`; implementation files will be added upon completion of model training.*
