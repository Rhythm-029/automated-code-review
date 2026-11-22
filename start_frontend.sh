#!/bin/bash
# start_frontend.sh — start the Vite dev server
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/frontend"

echo "Starting Automated Code Review frontend…"
echo "Frontend: http://localhost:5173"
echo ""

npm run dev
