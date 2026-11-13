---
name: tests-ui-watch
description: "make tests-ui must run every test by itself in a real browser the user watches, inside one Xephyr window — not Playwright UI mode"
metadata:
  node_type: memory
  type: feedback
---

`make tests-ui` = all tests run on their own, headed, slowMo 250, the user watches every click — inside ONE Xephyr
window (« PharmaGest — tests », e2e/scripts/run.sh) so no browser window pops up on other workspaces or takes focus.

**Why:** 2026-11-04 the user rejected Playwright's `--ui` mode (« i should click each test one by one? I want the same
experience as before »), and before that rejected plain `--headed` (windows popping up, following across workspaces).
UI mode also shows only the first project and skips the `setup` dependency → everything failed.

**How to apply:** keep headed + Xephyr; never switch tests-ui to `--ui` again. Test any change to it in the scratchpad
sandbox first (a fake 2-project config), not on the user's run. Related: [[user-profile]], [[short-visual-answers]].
