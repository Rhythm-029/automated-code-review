"""
GitHub integration service — read-only PR retrieval and diff extraction.
"""
from __future__ import annotations

import logging
import re
from typing import List, Optional, Tuple

import httpx

from ..schemas import GitHubPRFile, GitHubPRInfo

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


def _parse_repo_url(url: str) -> Tuple[str, str]:
    """
    Extract (owner, repo) from various GitHub URL formats:
    - https://github.com/owner/repo
    - https://github.com/owner/repo/pull/123
    - http://github.com/owner/repo/
    - git@github.com:owner/repo.git
    - owner/repo
    """
    clean = url.strip().rstrip("/")
    # Handle direct owner/repo format without protocol (e.g. facebook/react)
    if not clean.startswith("http") and not clean.startswith("git@") and clean.count("/") == 1:
        parts = clean.split("/")
        return parts[0].strip(), parts[1].strip().removesuffix(".git")

    # Match github.com/owner/repo
    match = re.search(r"github\.com[/:]([^/]+)/([^/\.]+)", clean)
    if not match:
        raise ValueError(
            f"Invalid GitHub repository URL: '{url}'. "
            "Expected format: https://github.com/owner/repo or owner/repo"
        )
    return match.group(1).strip(), match.group(2).strip().removesuffix(".git")


class GitHubService:
    parse_repo_url = staticmethod(_parse_repo_url)

    def __init__(self, token: Optional[str] = None) -> None:
        self._token = token.strip() if token and token.strip() else None
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Automated-Code-Review-App",
        }
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        self._client = httpx.Client(
            base_url=GITHUB_API,
            headers=headers,
            timeout=30.0,
            follow_redirects=True,
        )

    @property
    def is_authenticated(self) -> bool:
        return bool(self._token)

    def verify_token(self) -> dict:
        """
        Probe GitHub API to verify token validity, rate limits, and identity
        without logging the secret token itself.
        """
        if not self._token:
            # Unauthenticated: probe rate limit for public access
            try:
                r = self._client.get("/rate_limit")
                core = r.json().get("resources", {}).get("core", {}) if r.status_code == 200 else {}
                return {
                    "configured": False,
                    "valid": False,
                    "username": None,
                    "rate_limit_limit": core.get("limit", 60),
                    "rate_limit_remaining": core.get("remaining", 60),
                    "error": "No GITHUB_TOKEN configured in .env. Using unauthenticated public access (60 req/hr).",
                }
            except Exception as e:
                return {
                    "configured": False,
                    "valid": False,
                    "username": None,
                    "rate_limit_limit": 60,
                    "rate_limit_remaining": 0,
                    "error": f"Failed to check GitHub public status: {e}",
                }

        try:
            r_user = self._client.get("/user")
            r_rate = self._client.get("/rate_limit")

            if r_user.status_code == 401:
                return {
                    "configured": True,
                    "valid": False,
                    "username": None,
                    "error": "Personal Access Token is invalid or has expired.",
                }

            if r_user.status_code == 403:
                return {
                    "configured": True,
                    "valid": False,
                    "username": None,
                    "error": "GitHub API access forbidden: token may lack permissions or rate limit is exhausted.",
                }

            user_data = r_user.json() if r_user.status_code == 200 else {}
            rate_data = r_rate.json().get("resources", {}).get("core", {}) if r_rate.status_code == 200 else {}

            return {
                "configured": True,
                "valid": True,
                "username": user_data.get("login"),
                "rate_limit_limit": rate_data.get("limit", 5000),
                "rate_limit_remaining": rate_data.get("remaining", 5000),
                "error": None,
            }
        except Exception as exc:
            return {
                "configured": True,
                "valid": False,
                "username": None,
                "error": f"Connection to GitHub API failed: {exc}",
            }

    def _get(self, path: str) -> dict | list:
        try:
            resp = self._client.get(path)
        except httpx.ConnectError as err:
            raise RuntimeError(f"Network error connecting to GitHub API: {err}") from err
        except httpx.TimeoutException as err:
            raise RuntimeError("GitHub API request timed out after 30 seconds.") from err

        if resp.status_code == 401:
            raise PermissionError("GitHub token is invalid or expired. Check GITHUB_TOKEN in your .env.")
        if resp.status_code == 403:
            raise PermissionError("GitHub API rate limit exceeded or access forbidden. Check token permissions.")
        if resp.status_code == 404:
            raise FileNotFoundError(f"GitHub resource not found at '{path}'. Verify the repository and PR number.")
        resp.raise_for_status()
        return resp.json()

    def fetch_pull_request(self, repo_url: str, pr_number: int) -> GitHubPRInfo:
        owner, repo = _parse_repo_url(repo_url)

        pr_data: dict = self._get(f"/repos/{owner}/{repo}/pulls/{pr_number}")  # type: ignore
        total_changed = int(pr_data.get("changed_files", 0))

        # Paginate through all changed files (GitHub provides up to 100 per page, up to 3000 max)
        files_data: list = []
        page = 1
        per_page = 100
        while True:
            batch = self._get(f"/repos/{owner}/{repo}/pulls/{pr_number}/files?per_page={per_page}&page={page}")
            if not isinstance(batch, list) or not batch:
                break
            files_data.extend(batch)
            if len(batch) < per_page:
                break
            page += 1
            if page > 30:  # safety bound to prevent infinite loops (GitHub max 3,000 files)
                break

        files: List[GitHubPRFile] = []
        for f in files_data:
            files.append(
                GitHubPRFile(
                    filename=f.get("filename", ""),
                    status=f.get("status", ""),
                    additions=f.get("additions", 0),
                    deletions=f.get("deletions", 0),
                    patch=f.get("patch"),  # may be None for binary or large files
                )
            )

        return GitHubPRInfo(
            title=pr_data.get("title", ""),
            number=pr_number,
            state=pr_data.get("state", ""),
            author=pr_data.get("user", {}).get("login", "unknown"),
            base_branch=pr_data.get("base", {}).get("ref", ""),
            head_branch=pr_data.get("head", {}).get("ref", ""),
            files=files,
            total_changed_files=total_changed if total_changed > 0 else len(files),
            total_fetched_files=len(files),
            url=pr_data.get("html_url", ""),
        )
