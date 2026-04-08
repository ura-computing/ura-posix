# Tableau de bord — Owner/Employee (`/rapports`)

## Overview
- **Route:** `/rapports`
- **Roles:** Propriétaire, Employé
- **Theme:** Dynamic color — Mixte (cyan), Pharmacie (green), Parapharmacie (purple)
- **Layout:** Full width, sidebar, scrollable

---

## Sticky Filter Bar
- Date "Du" input (w-40) + Date "Au" input (w-40)
- "Réinitialiser" button (ghost, only when dates set)
- Right side: **Mixte** | **Pharmacie** (green) | **Parapharmacie** (purple) toggle buttons
- Excel download icon button

---

## Section 1 — Performance Banner
Single line: `Marge moyenne: XX.X% · Parapharmacie: XX.X% du CA · Marge brute: XXX MAD`

---

## Section 2 — KPI Cards (4 columns)

| Card | Style | Icon | Value | Formula |
|------|-------|------|-------|---------|
| Chiffre d'affaires | Primary filled | TrendingUp | XXX MAD | `PPV × qté vendue` |
| Achats totaux | Bordered | ShoppingCart | XXX MAD | — |
| Transactions ventes | Bordered | BarChart3 | N | — |
| Transactions achats | Bordered | Package | N | — |

---

## Section 3 — Advanced KPIs (6 cards, 3×2 grid)

| Card | Icon | Value | Sub-text |
|------|------|-------|----------|
| Ticket moyen | Receipt | XXX MAD | `CA ÷ nb transactions` |
| Vente moyenne / jour | BarChart3 | XXX MAD | — |
| Meilleure journée (DH) | CalendarCheck | XXX MAD | date |
| Meilleure journée (opé) | CalendarCheck | N opé | date |
| Moins bonne journée (DH) | CalendarX | XXX MAD | date (rose card) |
| Moins bonne journée (opé) | CalendarX | N opé | date (rose card) |

---

## Section 4 — Répartition & Santé financière (2 columns)

### Left: Donut Chart
- PieChart, innerRadius=50, outerRadius=76
- Colors: teal, purple, blue, amber, rose
- Legend + tooltip (MAD values)

### Right: Financial Health Grade
- Circle (h-28 w-28) with grade letter (A+/A/B+/B/C/D/F)
- Description + marge brute/nette values
- Scale: A+ >30%, A >25%, B+ >20%, B >15%, C >10%, D >5%, F ≤5%

| Grade | Color | Description |
|-------|-------|-------------|
| A+ | emerald | Excellente rentabilité |
| A | emerald | Très bonne rentabilité |
| B+ | blue | Bonne rentabilité |
| B | blue | Rentabilité correcte |
| C | amber | Rentabilité faible |
| D | orange | Rentabilité critique |
| F | red | Rentabilité insuffisante |

---

## Section 5 — Alertes Marges (4 colored cards)

| Card | Color | Condition | Content |
|------|-------|-----------|---------|
| Marge négative | Red | < 0% | count + total loss MAD + top 3 products |
| Marge 0% à 10% | Orange | 0–10% | count + CA + top 3 |
| Marge 60% à 89.9% | Amber | 60–90% | count + CA + top 3 |
| Marge ≥ 90% | Green | ≥ 90% | count + CA + top 3 |

---

## Section 6 — TVA (3 cards)

| Card | Style | Formula |
|------|-------|---------|
| TVA encaissée | Themed accent | `PPV × taux TVA` |
| TVA payée | Amber | `PU × taux TVA` |
| TVA à déclarer | Primary filled | `estimation` |

---

## Section 7 — Marge Summary (1 card, 3 cols with dividers)

| Col | Value |
|-----|-------|
| Marge % | XX.X% |
| Marge brute | XXX MAD |
| Marge nette | XXX MAD |

---

## Section 8 — Analyse de marge

### Mode buttons (7)
Produit | Catégorie | Fournisseur | BL | Labo | Opérateur | Mois

### KPI summary (3 cards)
- Total ventes (MAD + unités)
- Marge moyenne (% with min/max) — formula: `(1 − PU÷PPV) × 100`
- Marge moy/unité (MAD with min/max) — formula: `PPV − PU`

### Table columns per mode

**Produit:** Produit, Catégorie, TVA, PPV, Prix max/min/moy, Marge %, Marge DH, Qté, CA
**Catégorie:** Catégorie, Prix max/min/moy, Marge % moy, Marge DH moy, Qté, CA
**Fournisseur:** Fournisseur, Prix max/min/moy, Qté, CA
**BL:** Référence BL, Fournisseur, Date livraison, Nb produits, Quantité, Total achats
**Laboratoire:** Laboratoire, Prix max/min/moy, Qté, CA
**Opérateur:** Opérateur/Client, Transactions, Qté, CA
**Mois:** Mois, Transactions, Qté, CA

### Simulation dialog (modal)
- Search + checkbox list + select all/deselect
- Live KPIs: CA, Qty, Marge %, Marge DH
- Export CSV button

---

## Section 9 — Monthly Trend (BarChart)
- Ventes (teal) + Achats (purple) bars
- 12 months, compact Y axis (1k, 1M)

---

## Section 10 — Tendance cumulée + Répartition (2 cols)
- Left: AreaChart (gradient fills)
- Right: PieChart (category breakdown)

---

## Section 11 — Top catégories
- Horizontal progress bars, colored dots
- Category name + MAD amount

---

## Color Theming

| Filter | Primary card | Borders | Icon hex |
|--------|-------------|---------|----------|
| Mixte | bg-primary | emerald | #14b8a6 |
| Pharmacie | bg-green-600 | green | #22c55e |
| Parapharmacie | bg-purple-600 | purple | #a855f7 |

---

## API Endpoints

| Hook | Endpoint | Params |
|------|----------|--------|
| usePharmacyStats | GET /stats | date_from, date_to, category_type |
| useAnalyseMarge | GET /stats/analyse-marge | + mode |
| useMarginAlerts | GET /stats/margin-alerts | date_from, date_to, category_type |
| exportExcel | GET /stats/export-excel | date_from, date_to, category_type |

---

## Data Shapes

```json
// StatsResponse
{
  "kpis": { "ventes_total": 810000, "achats_total": 640000, "ventes_count": 14569, "achats_count": 12500 },
  "advanced_kpis": { "ticket_moyen": 55.6, "vente_moyenne_par_jour": 2700, "best_day_dh": { "date": "2026-03-15", "total": 15000 }, "worst_day_dh": { "date": "2026-03-02", "total": 800 }, "best_day_count": { "date": "2026-03-15", "count": 346 }, "worst_day_count": { "date": "2026-03-02", "count": 23 } },
  "tva": { "tva_encaissee": 94800, "tva_payee": 42761, "tva_a_declarer": 52039 },
  "marge": { "marge_pct": 30.9, "marge_brute_dh": 240318, "marge_nette_dh": 147097 },
  "type_breakdown": { "pharmacie": { "ventes_total": 350000 }, "parapharmacie": { "ventes_total": 460000 } },
  "monthly_trend": [{ "month": "2026-01", "ventes": 65000, "achats": 48000 }],
  "top_categories": [{ "category": "Medicament", "total": 350000 }]
}

// MarginAlertsResponse
{
  "negative": { "count": 7, "total_ca": 28400, "total_margin_dh": -38569, "products": [{ "product": "Aspirin", "marge_pct": -5.2, "ca": 4200 }] },
  "low": { "count": 23, "total_ca": 12539, "total_margin_dh": 600, "products": [] },
  "high": { "count": 41, "total_ca": 86790, "total_margin_dh": 69800, "products": [] },
  "very_high": { "count": 12, "total_ca": 42000, "total_margin_dh": 38000, "products": [] }
}
```
