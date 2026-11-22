# Microsoft CodeReviewer Dataset

This directory holds the JSON Lines (`.jsonl`) files for the code review comment generation task, adapted from Microsoft's [CodeReviewer benchmark](https://github.com/microsoft/CodeBERT/tree/master/CodeReviewer).

---

## Directory Structure

Place the raw or cleaned dataset splits directly in this folder:

```
dataset/
├── README.md              # This documentation
├── msg-train.jsonl        # Training split (~117,739 records)
├── msg-valid.jsonl        # Validation split (~10,319 records)
└── msg-test.jsonl         # Test split (~10,169 records)
```

> **Note**: Dataset files are excluded from Git tracking via `.gitignore` to prevent large binary blobs in repository history.

---

## Record Schema

Each line in the `.jsonl` files is a standalone JSON object representing a single review interaction:

```json
{
  "id": "torvalds/linux/pull/123#issuecomment-456789",
  "oldf": "int old_driver_init(void) {\n    return 0;\n}\n",
  "patch": "@@ -1,3 +1,4 @@\n int old_driver_init(void) {\n+    printk(KERN_INFO \"Initializing driver\\n\");\n     return 0;\n }",
  "msg": "Please avoid raw printk calls; use pr_info() or dev_info() instead.",
  "y": 1
}
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique or scoped identifier tracing back to the source repository and pull request comment. |
| `patch` | `string` | Yes | Unified git diff hunk containing line-level code modifications. Primary input for comment generation. |
| `msg` | `string` | Yes | Human-written reviewer comment left by a peer reviewer. Primary target sequence. |
| `oldf` | `string` | Optional | Full contents of the source file prior to patch application. Useful for broader scope context. |
| `y` | `int` | Optional | Task label from the upstream benchmark. (Typically `1` across comment generation splits). |

---

## Observed Dataset Characteristics & Gotchas

An exploratory audit of the raw dataset revealed several real-world engineering nuances:

1. **Missing File Context (`oldf`)**:
   - Approximately **2,754 training examples** contain empty or `null` values for `oldf`.
   - The ML pipeline treats `oldf` as strictly optional and relies on `patch` as the primary ground truth.

2. **Single-Class Label Distribution (`y = 1`)**:
   - In the comment generation subsets, `y` holds only the value `1` (indicating a comment is present).
   - This task is treated strictly as **conditional sequence-to-sequence generation** (`patch → msg`), not binary classification.

3. **Repeated IDs**:
   - Identical `id` strings recur when a single pull request discussion thread contains multiple review comments on distinct hunks. These are valid multi-turn records, not duplicate entries.

4. **Cross-Split Leakage**:
   - An initial cross-split scan identified **238 overlapping patch-comment pairs** between validation and test splits.
   - Run `ml/prepare_dataset.py` before final model evaluation to purge cross-split leakage into a sanitized evaluation manifest.

---

## Quickstart & Verification

### 1. Run the Dataset Audit
Verify file counts, schema integrity, duplicate hunks, and leakage:

```bash
python ml/audit_dataset.py --dataset-dir dataset
```

### 2. Produce Sanitized Evaluation Splits
Generate clean, deduplicated manifests without modifying the raw files:

```bash
python ml/prepare_dataset.py --input-dir dataset --output-dir dataset_clean
```

### 3. Verify ML Pipeline on a Tiny Slice
Run a 100-sample smoke test to check tokenizer alignment and loss calculation:

```bash
python ml/train.py --smoke-test
```

---

## Data Provenance & Ethics

- **Source**: Public GitHub repositories with permissive open-source licenses (Apache 2.0, MIT, BSD).
- **Redaction**: The training and inference pipelines include regex-based PII redaction to strip private email addresses and hardcoded authentication tokens before model ingestion.
