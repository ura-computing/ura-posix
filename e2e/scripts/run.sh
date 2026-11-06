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

# The real Sobrus account (21-sobrus-live): e2e/tests.env (gitignored). Missing → asked once here and saved;
# no terminal (git pre-push) → no run at all.
if [ ! -f tests.env ] || ! grep -Eq '^EMAIL=.+' tests.env || ! grep -Eq '^PASSWORD=.+' tests.env; then
  if [ ! -t 0 ]; then
    echo "✗ e2e/tests.env missing (EMAIL, PASSWORD of a Sobrus account): run make tests once in a terminal" >&2
    exit 1
  fi
  echo "▸ A real Sobrus account for the live check (saved in e2e/tests.env, never committed)"
  sobrus_email="" sobrus_password=""
  while [ -z "$sobrus_email" ]; do read -r -p "Sobrus email: " sobrus_email; done
  while [ -z "$sobrus_password" ]; do read -r -s -p "Sobrus password (hidden): " sobrus_password; echo; done
  (umask 077 && printf 'EMAIL=%s\nPASSWORD=%s\n' "$sobrus_email" "$sobrus_password" > tests.env)
  unset sobrus_email sobrus_password
  echo "✓ e2e/tests.env saved"
fi

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
# DigitalOcean's limits (env/do/limits.yml): backend 512 MB, Postgres 1 GB / 22 connections + the DO gate.
if [ "$(ask "DigitalOcean limits (backend 512 MB, Postgres 1 GB, 22 connections)? (y/n)" y)" = y ]; then
  export E2E_DO=1
fi
args=()

if [ ${#SPECS[@]} -gt 0 ]; then         # files given on the command line
  for spec in "${SPECS[@]}"; do args+=("$(spec_file "$spec")"); done
  export E2E_PARTIAL=1                  # coverage + speed gates need the full suite: skipped
fi

if [ "$MODE" = ui ]; then
  # Every test in a real browser, slowed down (250 ms per action), one after the other — inside ONE window (Xephyr:
  # a screen in a window). It stays on the workspace where you put it: nothing pops up elsewhere, nothing takes the
  # focus. It opens once the stack is up, closes at the end. No Xephyr / no X11 desktop: the browser opens on the
  # desktop itself.
  export E2E_HEADED=1 E2E_SLOWMO=250
  args+=(--headed)
  if command -v Xephyr > /dev/null && command -v xdotool > /dev/null && [ -n "${DISPLAY:-}" ]; then
    # The window itself opens once every container is up, just before the first test (global-setup.ts), not while
    # the images build. Its size: the desktop's, minus room for the desktop's bars and the window title.
    read -r width height < <(xdotool getdisplaygeometry)
    export E2E_XEPHYR=1 E2E_SCREEN="$((width * 95 / 100))x$((height - 110))"
    # That window has none of the desktop's settings: the app's font (« system-ui ») would fall back to DejaVu (an old
    # look) → the desktop's own font (gsettings); the browser in French (on Linux: LANGUAGE), so it offers no translation.
    fonts="$(mktemp -d)"
    trap 'rm -rf "$fonts"' EXIT
    desktop_font="$(gsettings get org.gnome.desktop.interface font-name 2> /dev/null | tr -d "'" | sed 's/ [0-9.]*$//')" ||
      desktop_font="" # not GNOME: the system's fonts
    {
      echo '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>'
      echo '<include ignore_missing="yes">/etc/fonts/fonts.conf</include>'
      if [ -n "$desktop_font" ]; then
        for family in sans-serif Sans system-ui; do
          echo "<alias binding=\"strong\"><family>$family</family><prefer><family>$desktop_font</family></prefer></alias>"
        done
      fi
      echo '</fontconfig>'
    } > "$fonts/fonts.conf"
    export FONTCONFIG_FILE="$fonts/fonts.conf" LANGUAGE=fr
  fi
elif [ ${#SPECS[@]} -eq 0 ]; then
  if [ "$(ask "Only the tests that failed last time? (y/n)" n)" = y ]; then
    args+=(--last-failed)               # + the setup tests (01, 02) they depend on
    export E2E_PARTIAL=1                # coverage + speed gates need the full suite: skipped
  else
    [ "$(ask "Record a new speed baseline? (y/n)" n)" = y ] && export E2E_UPDATE_BASELINE=1
  fi
fi

npx playwright test ${args[@]+"${args[@]}"}
