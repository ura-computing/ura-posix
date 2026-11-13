---
name: sobrus-worker-only
description: "Every Sobrus API call runs in the robot worker (sync.py run modes), never in the web API process"
metadata:
  node_type: memory
  type: feedback
---

Anything that hits Sobrus (login, exports, reports like cashdeskclosing, product lists) runs in the worker
(`backend/app/sobrus/worker.py` → `sync.execute`), as a queued `SobrusRun` mode. The API only queues the run
(`launcher.wake`) and reads what the worker stored.

**Why:** user (2026-11-06): « for all parts that require hitting Sobrus API, move them to the worker ».
**How to apply:** new Sobrus feature = new run mode in `sync.py` + table for its result + API GET of stored data.
Never `SobrusClient` in a router/service. Related: [[project-state]].
