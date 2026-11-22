#!/bin/bash
# start_backend.sh — start the FastAPI backend
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Automated Code Review backend…"
echo "Backend API: http://localhost:8000"
echo "API docs:    http://localhost:8000/docs"
echo ""

if [ ! -f ".env" ]; then
  echo "⚠  No .env file found. Copying .env.example → .env (demo mode)"
  cp .env.example .env
fi

uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
