"""
FastAPI application factory.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import settings
from .services.engines import build_engine
from .services.github_service import GitHubService
from .storage.review_store import ReviewStore

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting Automated Code Review backend (%s)", settings.APP_ENV)

    try:
        engine = build_engine(settings)
    except Exception as exc:
        logger.error("Failed to initialise review engine: %s", exc)
        from .services.engines import DemoEngine
        engine = DemoEngine()
        logger.warning("Falling back to DemoEngine due to error above.")

    app.state.engine = engine
    app.state.store = ReviewStore(settings.STORAGE_PATH)

    try:
        app.state.github = GitHubService(token=settings.GITHUB_TOKEN)
    except Exception as exc:
        logger.warning("GitHub service unavailable: %s", exc)
        app.state.github = None

    logger.info("Engine: %s | Mode: %s", engine.name, engine.mode)
    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Automated Code Review API",
        description=(
            "AI-powered code review backend for the BTech capstone project. "
            "Analyses Git diffs and generates structured review comments."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/api")

    return app


app = create_app()
