---
name: no-silent-removals
description: "Never drop fields, steps or features the user didn't ask to remove; when simplifying a screen, rearrange first and ask before removing anything"
metadata:
  node_type: memory
  type: feedback
---

When the user asks to simplify a screen (e.g. « too many inputs under each other »), split or rearrange it, but do
not remove fields on my own. Ask first if removing seems useful.

**Why:** on the sign-up wizard (2026-10-04) I removed « Confirmer le mot de passe » and the address without being
asked; the user had to ask for the confirmation back and felt I was not listening.

**How to apply:** list any removal in the plan and get a yes before coding it. Related: [[visible-disabled-actions]].
