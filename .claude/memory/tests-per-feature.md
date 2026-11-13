---
name: tests-per-feature
description: "Every feature ships with E2E (roles, feature OFF, rules) — but written at the END of a ticket batch, not per step"
metadata:
  node_type: memory
  type: feedback
---

Every feature delivered must come with its E2E tests, runnable by `make tests` and `make tests-ui <n>`
(both run the same Playwright specs; new `NN-*.spec.ts` files are picked up automatically).
Cover more than the happy path: each role that can use it (owner AND employee), feature OFF → no menu entry + 404 in
the layout, each data rule (e.g. duplicate barcode → most photos wins), and UI regressions found while building.

Timing (2026-11-06): implement every ticket of the batch first, tests last. Do not edit specs or run the check stack
between UI iterations; the user reviews the UI first.

**Why:** user asked (2026-10-07) « make sure every feature done have tests »; then (2026-11-06) « keep the tickets
first, implement everything needed, tests are at end ».
**How to apply:** build all tickets → user validates UI → then specs for every rule/role → user runs `make tests`.
Related: [[project-state]].
