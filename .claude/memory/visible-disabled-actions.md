---
name: visible-disabled-actions
description: UI actions stay visible and get disabled (with a hint) instead of appearing/disappearing; custom controls must match the app look
metadata:
  node_type: memory
  type: feedback
---

Main action buttons are always on screen. When they can't be used yet, show them disabled with a short hint
(e.g. « Supprimer la sélection (0) » disabled + « Cochez les imports à supprimer. »), never hide them until a
condition is met. New controls (checkboxes, etc.) use the app's own styled components / tokens, never the
browser's native look.

**Why:** the app's users barely know how to use a laptop; a button that appears only after a click is not found,
and native widgets look out of place (user was angry about both, 2026-10-04).

**How to apply:** any new list action, toolbar or form control — check the screenshot in light and dark before
saying it's done. Related: [[readme-last]].
