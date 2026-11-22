# System Requirements Specification

## 1. Functional Requirements (FR)

- **FR-1: Input Ingestion**
  The system must accept a Git pull request code diff along with optional surrounding context (file path, hunk lines, target language).

- **FR-2: Candidate Comment Generation**
  The system must process input code diffs using a Large Language Model to generate candidate code review comments targeting bug detection, logic flaws, or code quality improvements.

- **FR-3: Hallucination Screening**
  Every generated candidate comment must pass through a two-step hallucination screening module:
  - *Symbol Grounding*: Verify if code identifier references (variables, functions, types) exist in the diff or context.
  - *Natural Language Inference (NLI)*: Check whether the statement in the comment is premise-supported by the diff context using DeBERTa-MNLI.

- **FR-4: Confidence Gate & Abstention**
  The system must include a configurable confidence gate. If the candidate comment score falls below the required threshold, the system must abstain from emitting a comment rather than risking a hallucinated suggestion.

- **FR-5: AI Draft Attribution Labeling**
  All emitted comments must be explicitly labeled as "AI-Generated Draft Comment" to ensure transparency.

- **FR-6: Human Final Authority**
  The system must operate purely as an assistant. The final authority to submit, edit, or reject comments rests exclusively with the human reviewer.

## 2. Non-Functional Requirements (NFR)

- **NFR-1: Target Latency**
  End-to-end inference and hallucination screening pipeline latency should target $\le 20\text{ seconds}$ per pull request diff hunk on standard host hardware.

- **NFR-2: Resource Efficiency**
  Deployment must support lightweight host environments (e.g., standard CPU environments) via GGUF quantization and `llama.cpp` serving.

- **NFR-3: Reliability & Abstention Preference**
  In cases of uncertainty, the system prioritizes high precision over high recall—preferring abstention over emitting potentially false or confusing feedback.

- **NFR-4: Maintainability & Reproducibility**
  Code structure must follow modular TDSP guidelines separating dataset processing, model inference, screening logic, and API deployment.

## 3. Safety & Evaluation Requirements (SR)

- **SR-1: Safety & PII Filtering**
  Input parsing and output emission pipelines must filter out proprietary tokens, secrets, or personally identifiable information (PII).

- **SR-2: Evaluation Standards**
  The model outputs must be quantitatively evaluated across BLEU-4, ROUGE-L, BERTScore, and human qualitative criteria (relevance, correctness, actionability, tone).
