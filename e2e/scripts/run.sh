#!/usr/bin/env bash
# Single entry point of the E2E suite (make e2e-tests / make e2e-ui).
# Asks for its inputs — Enter keeps the default. No terminal (git pre-push)
# → defaults, no questions. First run installs Playwright by itself.
set -euo pipefail

MODE="${1:-tests}"                      # tests | ui
cd "$(dirname "$0")/.."                 # e2e/

ask() {                                 # ask "question" default → answer
  local answer=""
  if [ -t 0 ]; then read -r -p "$1 [$2]: " answer || true; fi
  echo "${answer:-$2}"
}

if [ ! -d node_modules/@playwright/test ] || [ ! -d node_modules/xlsx ]; then
  echo "▸ Installing the E2E packages…"
  npm install --silent
  npx playwright install chromium
fi

# Below 1000 lines the generated data is too thin for some scenarios (e.g. a
# product both sold and bought for the exclusions test) → ask again.
export E2E_ROWS
while :; do
  E2E_ROWS="$(ask "Vente rows to generate (min 1000)" 100000)"
  [[ "$E2E_ROWS" =~ ^[0-9]+$ ]] && [ "$E2E_ROWS" -ge 1000 ] && break
  echo "✗ a whole number ≥ 1000, please"
done
args=()

if [ "$MODE" = ui ]; then
  spec="$(ask "Test file (e.g. 06 or ventes; all = every test)" all)"
  if [ "$spec" != all ]; then
    match="$(ls tests/*"$spec"*.spec.ts 2>/dev/null | head -1 || true)"
    [ -z "$match" ] && { echo "✗ no test file matches \"$spec\""; ls tests; exit 1; }
    args+=("$match")
  fi
  args+=(--ui)                          # Playwright UI mode: one window, live view, step through
else
  [ "$(ask "Record a new speed baseline? (y/n)" n)" = y ] && export E2E_UPDATE_BASELINE=1
fi

exec npx playwright test ${args[@]+"${args[@]}"}
