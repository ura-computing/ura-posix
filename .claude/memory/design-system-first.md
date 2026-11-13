---
name: design-system-first
description: ALWAYS build UI from the existing design system, reuse/extract components, and screenshot-check each new screen against an existing one before saying done
metadata:
  node_type: memory
  type: feedback
---

Every new screen must look like it was always part of the app. Mock-ups are inspiration only.

- Find the closest existing screen first and copy its shape: lock screen → login page (`_components/templates/AuthLayout`);
  a settings form in « Mon compte » → the « Mot de passe » tab; an on/off setting → `SwitchCard` (admin features);
  a reset dialog → `ResetPasswordDialog` (`kind="pin"`); fields → `TextField` / `PasswordField` / `FormField`.
- Reuse, don't re-draw: if a look exists inline, extract it into a molecule/template and use it in both places.
  No one-off big custom inputs, centered cards or loose layouts.
- UX: controls react at once (a switch moves when clicked, even if a form must follow); no needless steps or fields
  (e.g. no « Mot de passe actuel » to set a lock code — user rejected it).
- Before reporting done: screenshot the new screen next to the existing one it imitates, on the dev app, and click
  through its states.

**Why:** user (2026-11-06) « keep it consistent, use the existing design system »; (2026-11-12) « the UI looks ugly,
it should follow the design system always, make components reusable, focus on the user experience », « the design
should always be consistent », « you are making lots of mistakes today ».
**How to apply:** map each element to an existing component; build; then visual check before any « done ». Related:
[[visible-disabled-actions]], [[chart-style]], [[big-back-button]], [[forms-step-by-step]].
