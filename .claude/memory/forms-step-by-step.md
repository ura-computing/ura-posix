---
name: forms-step-by-step
description: "Long forms in PharmaGest are step-by-step like Gmail sign-up — one short question per screen, Suivant / Retour"
metadata:
  node_type: memory
  type: feedback
---

A form with more than ~3 fields becomes a wizard: one question per screen (1–2 fields), progress « Étape N sur M »,
« Retour » left, « Suivant » right (Enter = Suivant), errors stop on the screen of the bad field, password typed twice.
Example: `/auth/signup` (`frontend/src/pages/auth/signup/index.tsx`, 5 screens).

**Why:** user said a long stacked form is « very bad for user experience » and asked for Gmail-like steps (2026-10-04).

**How to apply:** new forms for end users; keep every field the user expects (see [[no-silent-removals]]) and follow
[[visible-disabled-actions]].
