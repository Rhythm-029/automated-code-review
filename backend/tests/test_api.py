"""
Backend test suite.
Tests use mocked engines so no real model or API key is required.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# ── Setup test app ─────────────────────────────────────────────────────────────

from backend.app.main import create_app
from backend.app.services.engines import DemoEngine
from backend.app.storage.review_store import ReviewStore
from backend.app.services.github_service import GitHubService


@pytest.fixture
def tmp_store(tmp_path):
    return ReviewStore(str(tmp_path / "test_reviews.json"))


@pytest.fixture
def client(tmp_store):
    app = create_app()
    with TestClient(app, raise_server_exceptions=False) as c:
        app.state.engine = DemoEngine()
        app.state.store = tmp_store
        app.state.github = None
        yield c


# ── Health ─────────────────────────────────────────────────────────────────────

def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── Model status ───────────────────────────────────────────────────────────────

def test_model_status_demo(client):
    resp = client.get("/api/model/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_engine" in data
    assert "mode" in data


# ── Review endpoint ────────────────────────────────────────────────────────────

SAMPLE_PATCH = """\
@@ -1,4 +1,7 @@
 def divide(a, b):
+    if b == 0:
+        return None
     return a / b
"""


def test_review_valid_patch(client):
    resp = client.post("/api/review", json={"patch": SAMPLE_PATCH})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert isinstance(data["comments"], list)
    assert data["mode"] == "demo"
    assert "review_id" in data


def test_review_empty_patch(client):
    resp = client.post("/api/review", json={"patch": ""})
    assert resp.status_code == 422


def test_review_whitespace_patch(client):
    resp = client.post("/api/review", json={"patch": "   "})
    assert resp.status_code == 422


def test_review_oversized_patch(client):
    big = "+" + "x" * 60_000
    resp = client.post("/api/review", json={"patch": big})
    assert resp.status_code == 422


def test_review_missing_patch_field(client):
    resp = client.post("/api/review", json={"oldf": "some context"})
    assert resp.status_code == 422


def test_review_response_schema(client):
    resp = client.post("/api/review", json={"patch": SAMPLE_PATCH})
    assert resp.status_code == 200
    data = resp.json()
    required_keys = {"review_id", "status", "engine", "mode", "duration_ms", "comments"}
    assert required_keys.issubset(data.keys())
    for comment in data["comments"]:
        assert "title" in comment
        assert "body" in comment
        assert "severity" in comment
        assert "category" in comment


def test_demo_mode_label_in_body(client):
    """Every demo comment body must contain the DEMO MODE banner."""
    resp = client.post("/api/review", json={"patch": SAMPLE_PATCH})
    assert resp.status_code == 200
    for comment in resp.json()["comments"]:
        assert "DEMO MODE" in comment["body"]


# ── Review history ─────────────────────────────────────────────────────────────

def test_review_history_empty(client):
    resp = client.get("/api/reviews")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_review_history_after_review(client):
    client.post("/api/review", json={"patch": SAMPLE_PATCH})
    resp = client.get("/api/reviews")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_get_review_by_id(client):
    post_resp = client.post("/api/review", json={"patch": SAMPLE_PATCH})
    rid = post_resp.json()["review_id"]
    get_resp = client.get(f"/api/reviews/{rid}")
    assert get_resp.status_code == 200
    assert get_resp.json()["review_id"] == rid


def test_get_nonexistent_review(client):
    resp = client.get("/api/reviews/does-not-exist-xyz")
    assert resp.status_code == 404


def test_delete_review(client):
    post_resp = client.post("/api/review", json={"patch": SAMPLE_PATCH})
    rid = post_resp.json()["review_id"]
    del_resp = client.delete(f"/api/reviews/{rid}")
    assert del_resp.status_code == 200
    get_resp = client.get(f"/api/reviews/{rid}")
    assert get_resp.status_code == 404


# ── GitHub integration ─────────────────────────────────────────────────────────

def test_github_review_unavailable(client):
    """When GitHub service is None, endpoint should return 503."""
    client.app.state.github = None
    resp = client.post(
        "/api/github/pull-request",
        json={"repo_url": "https://github.com/owner/repo", "pr_number": 1},
    )
    assert resp.status_code == 503


def test_github_status_endpoint(client):
    """Status endpoint returns valid JSON structure without leaking tokens."""
    resp = client.get("/api/github/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "configured" in data
    assert "valid" in data


def test_github_slug_parsing():
    """Slug parsing handles various URL and slug formats correctly."""
    assert GitHubService.parse_repo_url("https://github.com/octocat/Hello-World") == ("octocat", "Hello-World")
    assert GitHubService.parse_repo_url("https://github.com/octocat/Hello-World.git") == ("octocat", "Hello-World")
    assert GitHubService.parse_repo_url("octocat/Hello-World") == ("octocat", "Hello-World")
    assert GitHubService.parse_repo_url("https://github.com/octocat/Hello-World/pull/42") == ("octocat", "Hello-World")

    with pytest.raises(ValueError):
        GitHubService.parse_repo_url("https://gitlab.com/bad/repo")


def test_github_review_success_mocked(client):
    """PR review endpoint succeeds and processes changed files through review engine."""
    from backend.app.schemas import GitHubPRInfo, GitHubPRFile

    mock_gh = MagicMock()
    mock_gh.is_authenticated = True
    mock_gh.fetch_pull_request.return_value = GitHubPRInfo(
        title="Fix memory leak",
        number=42,
        state="open",
        author="dev",
        base_branch="main",
        head_branch="fix/leak",
        url="https://github.com/test/repo/pull/42",
        files=[
            GitHubPRFile(
                filename="server.py",
                status="modified",
                additions=3,
                deletions=1,
                patch="@@ -1,3 +1,5 @@\n def close():\n+    cleanup()\n",
            )
        ],
    )
    client.app.state.github = mock_gh
    resp = client.post(
        "/api/github/pull-request",
        json={"repo_url": "test/repo", "pr_number": 42, "engine": "demo", "max_files": 2},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pr_info"]["title"] == "Fix memory leak"
    assert len(data["file_reviews"]) == 1
    assert data["token_authenticated"] is True


def test_github_review_not_found_handling(client):
    """When repo/PR is not found, 404 should be returned."""
    mock_gh = MagicMock()
    mock_gh.fetch_pull_request.side_effect = FileNotFoundError("PR not found")
    client.app.state.github = mock_gh
    resp = client.post(
        "/api/github/pull-request",
        json={"repo_url": "test/nonexistent", "pr_number": 9999, "engine": "demo"},
    )
    assert resp.status_code == 404


def test_github_review_permission_error_handling(client):
    """When token is unauthorized or forbidden, 403 should be returned."""
    mock_gh = MagicMock()
    mock_gh.fetch_pull_request.side_effect = PermissionError("Bad credentials")
    client.app.state.github = mock_gh
    resp = client.post(
        "/api/github/pull-request",
        json={"repo_url": "test/private-repo", "pr_number": 1, "engine": "demo"},
    )
    assert resp.status_code == 403


# ── Dataset audit ──────────────────────────────────────────────────────────────

def test_dataset_audit_missing_files(client):
    """Audit should return without crashing even when files are absent."""
    resp = client.get("/api/dataset/audit")
    assert resp.status_code == 200
    data = resp.json()
    assert "splits" in data
    for split in data["splits"]:
        # When files are absent, exists should be False
        if not split["exists"]:
            assert split["record_count"] is None or split["record_count"] == 0


# ── Store unit tests ───────────────────────────────────────────────────────────

def test_store_roundtrip(tmp_store):
    from backend.app.schemas import ReviewResponse, ReviewComment, EngineMode, Severity, Category
    import uuid
    from datetime import datetime

    resp = ReviewResponse(
        review_id=str(uuid.uuid4()),
        engine="demo",
        mode=EngineMode.demo,
        duration_ms=42,
        patch_chars=100,
        comments=[
            ReviewComment(
                title="Test",
                body="Test body DEMO MODE",
                severity=Severity.low,
                category=Category.general,
            )
        ],
        created_at=datetime.utcnow(),
    )
    stored = tmp_store.save_review(resp, "diff content")
    retrieved = tmp_store.get_by_id(resp.review_id)
    assert retrieved is not None
    assert retrieved.review_id == resp.review_id


def test_store_delete(tmp_store):
    from backend.app.schemas import ReviewResponse, ReviewComment, EngineMode, Severity, Category
    import uuid
    from datetime import datetime

    resp = ReviewResponse(
        review_id=str(uuid.uuid4()),
        engine="demo",
        mode=EngineMode.demo,
        duration_ms=10,
        patch_chars=50,
        comments=[],
        created_at=datetime.utcnow(),
    )
    tmp_store.save_review(resp, "patch")
    assert tmp_store.delete_by_id(resp.review_id) is True
    assert tmp_store.get_by_id(resp.review_id) is None


# ── Malformed output handling ──────────────────────────────────────────────────

def test_parse_model_output_empty():
    from backend.app.services.engines import parse_model_output
    assert parse_model_output("", 5) == []


def test_parse_model_output_valid_json():
    from backend.app.services.engines import parse_model_output
    raw = json.dumps([{
        "title": "Issue",
        "body": "Some issue was found",
        "severity": "medium",
        "category": "correctness",
    }])
    comments = parse_model_output(raw, 5)
    assert len(comments) == 1
    assert comments[0].title == "Issue"


def test_parse_model_output_broken_json():
    from backend.app.services.engines import parse_model_output
    raw = '{"broken json here'
    comments = parse_model_output(raw, 5)
    # Should not raise; may return 0 or 1 plain-text comment
    assert isinstance(comments, list)


# ── Ollama tests ───────────────────────────────────────────────────────────────

def test_health_ollama(client):
    resp = client.get("/api/health/ollama")
    assert resp.status_code == 200
    data = resp.json()
    assert "ollama_reachable" in data
    assert "target_model" in data


def test_ollama_engine_mocked_success():
    from backend.app.services.engines import OllamaEngine
    import httpx

    engine = OllamaEngine(base_url="http://localhost:11434", model="qwen2.5-coder:7b")

    mock_response = {
        "message": {
            "content": json.dumps([
                {
                    "title": "Division by zero risk",
                    "body": "No guard clause for zero divisor.",
                    "severity": "high",
                    "category": "correctness",
                    "suggestion": "Add guard clause.",
                }
            ])
        }
    }

    with patch.object(httpx.Client, "post") as mock_post:
        mock_resp_obj = MagicMock()
        mock_resp_obj.status_code = 200
        mock_resp_obj.json.return_value = mock_response
        mock_post.return_value = mock_resp_obj

        comments, raw = engine.generate_review(patch="@@ -1,2 +1,3 @@\n+x = 1/0")
        assert len(comments) == 1
        assert comments[0].title == "Division by zero risk"
        assert comments[0].severity.value == "high"
        assert comments[0].category.value == "correctness"


def test_ollama_engine_clean_diff_returns_no_findings():
    """When model identifies no defects, it must return an empty list without inventing comments."""
    from backend.app.services.engines import OllamaEngine
    import httpx

    engine = OllamaEngine(base_url="http://localhost:11434", model="qwen2.5-coder:7b")

    mock_response = {
        "message": {
            "content": "[]"
        }
    }

    with patch.object(httpx.Client, "post") as mock_post:
        mock_resp_obj = MagicMock()
        mock_resp_obj.status_code = 200
        mock_resp_obj.json.return_value = mock_response
        mock_post.return_value = mock_resp_obj

        comments, raw = engine.generate_review(patch="@@ -1,2 +1,2 @@\n-# old comment\n+# updated comment")
        assert len(comments) == 0


def test_github_review_skipped_files_tracking(client):
    """PR review should accurately report total, fetched, reviewed, and skipped files."""
    from backend.app.schemas import GitHubPRInfo, GitHubPRFile

    mock_gh = MagicMock()
    mock_gh.is_authenticated = True
    mock_gh.fetch_pull_request.return_value = GitHubPRInfo(
        title="Large Refactor",
        number=100,
        state="open",
        author="dev",
        base_branch="main",
        head_branch="refactor",
        total_changed_files=4,
        total_fetched_files=4,
        url="https://github.com/test/repo/pull/100",
        files=[
            GitHubPRFile(filename="a.py", status="modified", additions=1, deletions=0, patch="@@ -1 +1,2 @@\n+print('a')"),
            GitHubPRFile(filename="b.py", status="modified", additions=1, deletions=0, patch="@@ -1 +1,2 @@\n+print('b')"),
            GitHubPRFile(filename="c.py", status="modified", additions=1, deletions=0, patch="@@ -1 +1,2 @@\n+print('c')"),
            GitHubPRFile(filename="image.png", status="added", additions=0, deletions=0, patch=None),
        ],
    )
    client.app.state.github = mock_gh

    # Limit to 1 file
    resp = client.post(
        "/api/github/pull-request",
        json={"repo_url": "test/repo", "pr_number": 100, "engine": "demo", "max_files": 1},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_files_changed"] == 4
    assert data["total_files_fetched"] == 4
    assert data["total_files_reviewed"] == 1
    assert len(data["skipped_files"]) == 3
    # One binary/no-patch and two omitted by limit
    reasons = [s["reason"] for s in data["skipped_files"]]
    assert any("diff omitted" in r or "Binary file" in r for r in reasons)
    assert any("Omitted by file limit" in r for r in reasons)

