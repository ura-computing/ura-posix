#!/usr/bin/env bash
#
# Git pre-push hook for apcm-pharma.
#
# Runs the backend (pytest) and frontend (vitest) suites before every push.
# Push aborts on the first failing suite.
#
# Bypass for a one-off: `git push --no-verify`.
# Install once per clone: `make install-hooks`.

set -e

# git invokes hooks from the repo root regardless of CWD, but be explicit.
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

printf "\n▸ backend tests (pytest)\n"
( cd backend && uv run pytest -q )

printf "\n▸ frontend tests (vitest)\n"
( cd frontend && npm test --silent -- --run )

printf "\n✓ all tests green — proceeding with push\n"
