#!/usr/bin/env bash
#
# Git pre-push hook for apcm-pharma.
#
# Runs the backend (pytest) suite before every push.
# Push aborts if it fails.
#
# Bypass for a one-off: `git push --no-verify`.
# Install once per clone: `make install-hooks`.

set -e

# git invokes hooks from the repo root regardless of CWD, but be explicit.
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

printf "\n▸ backend tests (pytest)\n"
( cd backend && uv run pytest -q )

printf "\n✓ all tests green — proceeding with push\n"
