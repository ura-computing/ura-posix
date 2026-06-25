#!/usr/bin/env bash
#
# Install git hooks for apcm-pharma. Run once per fresh clone:
#   make install-hooks
#
# The pre-push hook symlinks to scripts/pre-push.sh so updates to the
# tracked script flow through without re-running this installer.

set -e

ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$ROOT/.git/hooks"
SRC="$ROOT/scripts/pre-push.sh"

if [ ! -d "$HOOK_DIR" ]; then
  echo "✗ .git/hooks not found — are you inside a clone?" >&2
  exit 1
fi

chmod +x "$SRC"
ln -sfn "$SRC" "$HOOK_DIR/pre-push"

echo "✓ pre-push hook installed → $HOOK_DIR/pre-push"
echo "  bypass with: git push --no-verify"
