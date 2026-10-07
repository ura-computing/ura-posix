#!/usr/bin/env bash
# Single entry point of the E2E suite (make tests / make tests-ui).
# Asks for its inputs — Enter keeps the default. No terminal (git pre-push)
# → defaults, no questions. First run installs Playwright by itself.
# Test files can also be given after the mode: `run.sh tests 06 15` (make tests 06 15).
set -euo pipefail

MODE="${1:-tests}"                      # tests | ui
shift || true
SPECS=("$@")                            # test files: number (06) or part of the name (ventes)
cd "$(dirname "$0")/.."                 # e2e/

spec_file() {                           # "06" / "ventes" → tests/06-ventes.spec.ts
  local match
  if [[ "$1" =~ ^[0-9]+$ ]]; then match="$(ls tests/"$(printf '%02d' "$((10#$1))")"-*.spec.ts 2>/dev/null | head -1 || true)"
  else match="$(ls tests/*"$1"*.spec.ts 2>/dev/null | head -1 || true)"; fi
  [ -z "$match" ] && { echo "✗ no test file matches \"$1\"" >&2; ls tests >&2; exit 1; }
  echo "$match"
}

ask() {                                 # ask "question" default → answer
  local answer=""
  if [ -t 0 ]; then read -r -p "$1 [$2]: " answer || true; fi
  echo "${answer:-$2}"
}

if [ ! -d node_modules/@playwright/test ] || [ ! -d node_modules/xlsx ]; then
  echo "▸ Installing the E2E packages…"
  npm install --silent
fi
# The browser too, every run: packages can be there without it (npm install run by hand,
# fresh clone). Nothing to download when it is already installed.
npx playwright install chromium

# Below 1000 lines the generated data is too thin for some scenarios (e.g. a
# product both sold and bought for the exclusions test) → ask again.
export E2E_ROWS
while :; do
  E2E_ROWS="$(ask "Vente rows to generate (min 1000)" 100000)"
  [[ "$E2E_ROWS" =~ ^[0-9]+$ ]] && [ "$E2E_ROWS" -ge 1000 ] && break
  echo "✗ a whole number ≥ 1000, please"
done
args=()

if [ ${#SPECS[@]} -gt 0 ]; then         # files given on the command line
  for spec in "${SPECS[@]}"; do args+=("$(spec_file "$spec")"); done
  export E2E_PARTIAL=1                  # coverage + speed gates need the full suite: skipped
fi

if [ "$MODE" = ui ]; then
  if [ ${#SPECS[@]} -eq 0 ]; then
    spec="$(ask "Test file (e.g. 06 or ventes; all = every test)" all)"
    [ "$spec" != all ] && args+=("$(spec_file "$spec")")
  fi
  export E2E_HEADED=1 E2E_SLOWMO=250
  args+=(--headed)
elif [ ${#SPECS[@]} -eq 0 ]; then
  if [ "$(ask "Only the tests that failed last time? (y/n)" n)" = y ]; then
    args+=(--last-failed)               # + the setup tests (01, 02) they depend on
    export E2E_PARTIAL=1                # coverage + speed gates need the full suite: skipped
  else
    [ "$(ask "Record a new speed baseline? (y/n)" n)" = y ] && export E2E_UPDATE_BASELINE=1
  fi
fi

exec npx playwright test ${args[@]+"${args[@]}"}
