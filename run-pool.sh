#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed or not in PATH" >&2
  exit 1
fi

if [[ ! -f ".env" ]]; then
  echo "Error: .env not found in $ROOT_DIR" >&2
  echo "Create it from .env.example first:" >&2
  echo "  cp .env.example .env" >&2
  exit 1
fi

echo "Starting DigiByte solo pool..."
echo "  dir: $ROOT_DIR"
echo "  cmd: node src/index.js"

exec node src/index.js
