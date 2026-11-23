---
name: stop-after-each-step
description: After each implemented step, stop and tell the user what to test in the UI; never touch or run tests until the whole batch is finished
metadata:
  type: feedback
---

After each step is implemented: stop, give the user a short UI test list (page, clicks, expected result), wait for his OK
before the next step. Tests (E2E edits, `make tests`, new test files) are not touched and not run until everything
in the batch is finished; then all tests are written / updated in one go and run.

**Why:** user (2026-11-23) « after each step you implement it you stop and tell me to test it in the UI; for tests don't
touch them until we finish everything; don't run tests ».
**How to apply:** my own checks per step stay (type-check, lint, ruff, screenshot); no Playwright E2E work mid-batch.
Related: [[tests-per-feature]], [[design-system-first]].
