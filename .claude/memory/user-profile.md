---
name: user-profile
description: "Who drives PharmaGest work, how they work, and their visual taste"
metadata:
  node_type: memory
  type: user
---

Developer building PharmaGest (Sobrus-import pharmacy dashboard) for a client who runs a pharmacy group; pharmacies
are in Morocco, possibly Spain / France. End users barely know a laptop.

- Drives with short messages (« next », « go », « what's next ? »), often typos; wants terse answers (caveman style),
  one command per reply, tables + short examples.
- Runs `make tests` / `make tests NN` himself and pastes failures; has a dev stack running (`make dev`, :5173 / :8000)
  that I can screenshot to check UI.
- An « autosync on logout » script commits and pushes the working tree to `dev` by itself (message « autosync on
  logout ») — work can land on GitHub untested.
- Taste: dislikes grey and rose UI colors, ok with indigo / violet, hates the generic AI look; wants UI that matches
  the app's existing components. Gets angry when I don't apply the « users are not tech-savvy » rule.

Related: [[visible-disabled-actions]], [[no-silent-removals]], [[forms-step-by-step]], [[clickup-tickets]].

- Dev run (2026-11-06): 3 terminals `make frontend`, `make backend`, `make worker` (not `make dev`). Backend reloads, frontend HMR; after a worker code change say « restart `make worker` ».
