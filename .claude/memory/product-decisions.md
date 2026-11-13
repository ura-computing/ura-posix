---
name: product-decisions
description: "Client / owner decisions for PharmaGest that the code alone doesn't explain (privacy, sign-up, formulas, scope)"
metadata:
  node_type: memory
  type: project
---

Decisions (dates = when decided):

- **Pharmacy privacy (2026-10-04):** the client doesn't want anyone to learn which pharmacies he works with. No
  public list of pharmacies; join only by typing a code (`CAS0001`); public answers never reveal whether a code or
  an email exists (sign-up always answers « Demande envoyée », forgot-password always 200).
- **Sign-up (2026-10-04, changed 2026-10-16):** admin accepts every new account; before that the account logs in
  but sees an empty menu + 404 (« attend l'accord de l'administrateur »), `users.status = 'pending'`. Owner = new pharmacy (name + city)
  or joins an existing one by code; employee = joins by code. Accept/refuse both send an email.
- **Formulas (2026-10-04, user said « you choose »):** CA = qty × PPV on every screen (G2); supplier tabs split a
  product's sales by units bought from each supplier (G3); average PU counts lines with a price and qty > 0, PU 0
  (free units) counts (Q1). Real files: half the products have 2+ suppliers, 352 lines at PU 0, none without price.
- **Scope:** currency MAD only for now (per-pharmacy currency = Later); « today » = Casablanca time (per-user tz =
  Later); `pg_stat_statements` = Later; T3 (« Comptabilité bug when excluding produits spéciaux ») dropped —
  never reproduced, E2E green.
- **Imports:** hand-edited Sobrus files (Excel re-save) are real (resources/les-joyeux 2026-01/02 files): dates
  day-first `23/1/26`; impossible dates → line skipped and counted.

**Why:** these were spoken decisions; code shows the result, not the reason. **How to apply:** don't re-ask; respect
the privacy rule in any new public page or error message. Related: [[project-state]], [[user-profile]].
