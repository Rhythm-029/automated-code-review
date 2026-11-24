"""
Application configuration loaded from environment variables / .env file.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    # ── Review engine ────────────────────────────────────────────────────────
    # Options: "groq" | "ollama" | "demo" | "openai" | "anthropic" | "finetuned"
    REVIEW_ENGINE: str = "groq"

    # ── Groq API ─────────────────────────────────────────────────────────────
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    GROQ_TIMEOUT: int = 60

    # ── Local Ollama ─────────────────────────────────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5-coder:7b"
    OLLAMA_TIMEOUT: int = 120

    # ── External LLM (optional) ──────────────────────────────────────────────
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-haiku-20240307"

    # ── Fine-tuned model ─────────────────────────────────────────────────────
    FINETUNED_MODEL_PATH: Optional[str] = None

    # ── GitHub ────────────────────────────────────────────────────────────────
    GITHUB_TOKEN: Optional[str] = None

    # ── Dataset ───────────────────────────────────────────────────────────────
    DATASET_DIR: str = str(BASE_DIR / "dataset")

    # ── Storage ───────────────────────────────────────────────────────────────
    STORAGE_PATH: str = str(BASE_DIR / "backend" / "reviews.json")

    # ── Limits ───────────────────────────────────────────────────────────────
    MAX_PATCH_CHARS: int = 50_000
    MAX_COMMENTS: int = 10

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def active_engine(self) -> str:
        """Return the actually configured engine, falling back cleanly."""
        engine = self.REVIEW_ENGINE.lower()
        if engine == "groq":
            return "groq" if self.GROQ_API_KEY else "demo"
        if engine == "ollama":
            return "ollama"
        if engine == "openai" and not self.OPENAI_API_KEY:
            return "demo"
        if engine == "anthropic" and not self.ANTHROPIC_API_KEY:
            return "demo"
        if engine == "finetuned" and not self.FINETUNED_MODEL_PATH:
            return "demo"
        return engine

    @property
    def dataset_train(self) -> Path:
        return Path(self.DATASET_DIR) / "msg-train.jsonl"

    @property
    def dataset_valid(self) -> Path:
        return Path(self.DATASET_DIR) / "msg-valid.jsonl"

    @property
    def dataset_test(self) -> Path:
        return Path(self.DATASET_DIR) / "msg-test.jsonl"


settings = Settings()
