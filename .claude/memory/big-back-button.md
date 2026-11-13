---
name: big-back-button
description: "Every detail page gets a big, obvious « Retour à la liste … » button, not only a breadcrumb"
metadata:
  node_type: memory
  type: feedback
---

A page opened from a list (product sheet, pharmacy detail…) shows a big button « Retour à la liste des … »
(ArrowLeft, h-11, text-base, bordered card look) above the title; the small breadcrumb stays next to it.

**Why:** the app's users barely know how to use a laptop; a small breadcrumb is not seen. The user was angry
(2026-10-16): « I already told you a million times that the users of the app are dumb people ».

**How to apply:** any new detail / sub page: add the visible back button in the same change, with an E2E click on
it. Think « would a first-time laptop user find the way out? » before calling a screen done. Related:
[[visible-disabled-actions]], [[forms-step-by-step]].
