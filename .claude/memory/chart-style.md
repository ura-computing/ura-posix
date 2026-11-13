---
name: chart-style
description: Charts in PharmaGest — every curve solid, one distinct color per curve, no dashed lines
metadata:
  type: feedback
---

Line charts (Rapport trend, product « Ventes et achats par mois »): every curve is drawn the same way (solid), each
curve gets its own color (`--chart-1…8`, order 1,3,2,5,4,8,7,6 so neighbours differ). No dashed lines, not even for
purchases.

**Why:** user (2026-10-07): « nooo in the curve each one should have a unique color » then « i don't like the dash,
rather keep them similar, just different in color ».
**How to apply:** any new chart: solid lines, distinct colors, legend with the series names; tests check unique
`stroke` per curve. Related: [[visible-disabled-actions]].
