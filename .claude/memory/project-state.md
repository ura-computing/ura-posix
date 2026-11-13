---
name: project-state
description: "Where PharmaGest stands — 2026-11-13: microservices split started (SERVICE env + gateway done); handoff in .claude/HANDOFF.md for the personal laptop"
metadata:
  node_type: memory
  type: project
---

As of 2026-11-13 (verify with `git log`, `git status`, `PLAN.md`). Full state + next steps: `.claude/HANDOFF.md` in the repo (written to move work to the user's personal laptop).


- Work on `dev`; PR dev → main with « Create a merge commit » (a squash once caused conflicts). Check the branch
  before any commit: after a re-clone the repo sat on `main` and a commit landed there (moved to dev, main reset).
- `/home/mhrima/Desktop/workspace/apcm-pharma` = symlink to `/goinfre/mhrima/workspace/apcm-pharma`. The user's
  autosync script commits leftovers on logout. The user runs `make frontend`, `make backend`, `make worker` (not `make dev`).
- Committed on dev up to `ccf1998` (2026-11-12): lock screen, Sobrus period bar / skipped years / email set once, closing
  rows in Gestion des imports, Sobrus page cleanup, E2E 20/23/25/26, docs up to date.
- 2026-11-13 handoff commit: microservices step 1 (`backend/app/core/services.py`, `SERVICE` env in `main.py`) + step 2
  (`backend/scripts/gateway_routes.py` → `gateway/Caddyfile`, `gateway/Dockerfile`), rate limit keyed on `do-connecting-ip`,
  `.claude/HANDOFF.md` + `.claude/memory/` + `.claude/plans/microservices.md` + `.claude/prod-errors.txt`. Next: step 3 (compose).
- Production (DigitalOcean): backend 2 GB / 2 vCPU (since 2026-11), managed Postgres 1 GB / 1 vCPU / 22 connections
  (a CPU spike stayed unexplained; `pg_stat_statements` advised). E2E limits stay 512 MB on purpose.
- Open decisions: what « Étiquette » / « Commander » (premium) actually do (PLAN §8).
- Screenshots on the dev app: scratchpad Playwright scripts run from `e2e/` (its node_modules), seed owner from
  `backend/scripts/seed.json`; check light + dark + phone width.

**Why:** next session picks up without re-deriving state. **How to apply:** check this, then `PLAN.md`; update
when state changes. Related: [[product-decisions]], [[user-profile]], [[tests-per-feature]], [[design-system-first]],
[[sobrus-worker-only]].
