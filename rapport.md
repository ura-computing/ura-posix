# Session Report — APCM PharmaGest

_Date: 15/07/2026_

This document summarizes **all the work delivered** during the session, followed by **one item
that needs a business decision** (VAT on Medicines) and **what remains to be done**. Each item
includes a concrete **example** so it's easy to follow.

---

## 1. Work delivered (done and verified)

### 1.1 Product search bar — fixed
- **The problem:** the search returned **wrong results**. Example — typing `rino` suggested
  *ROGE CAVAILLES SANS **RIN**CAGE*, *LUMI**NO** RESIST*, *BEBE CONFORT DOMI**NO***… — products
  that **don't contain** "rino". The cause was an "approximate" (fuzzy) matcher that was far too
  loose: it scored *SANS RINCAGE* at 0.600 (accepted) while the only real match,
  *DIA**RINO**VA*, scored only 0.400 — so the correct product was almost rejected and junk was
  let in.
- **The fix:** search is now a **strict "contains" match**, **case- and accent-insensitive**.
  - Example: typing `complement` now finds `PURESSENTIEL ANTI-CHUTE **COMPLÉMENT**` (with the
    accented É) — before, the accent broke the match.
  - Example: typing `rino` now returns **only** real matches: *RINOCLENIL*, *DIARINOVA*,
    *URINOIR*, *FLORINOV* — the junk is gone.
- **New wildcard characters** using `*`:

  | You type | Meaning | Real example result |
  |---|---|---|
  | `cin`  | **contains** "cin"            | any product with CIN inside |
  | `cin*` | **starts with** "cin"        | CINABAC, CINET, CINQ SUR CINQ |
  | `*cin` | **ends with** "cin"          | …VAC**CIN** (all vaccines) |
  | `c*a`  | starts with C **and** ends with A | CARDINOR CO … SEC**A** |

- Multiple words separated by spaces are **all required** (Google-style). Example:
  `doliprane 1000` matches only products containing **both** "doliprane" and "1000".
- Applies everywhere: **Purchases (Achats), Sales (Ventes)** search + suggestions, admin catalog,
  and special products.

### 1.2 Loading skeletons — added everywhere
- While data loads, the app now shows **animated placeholder rows/cards** (instead of a blank
  screen or a spinner), then the real values appear.
- **Example:** opening the Sales page, you immediately see the table shape with shimmering grey
  rows, then it fills with real transactions — no more "empty then sudden jump".
- Covers **all tables**, **KPI cards**, and **gauges** (Purchases, Sales, Analysis).

### 1.3 Dashboard — KPI card layout
- The **TOTAL PURCHASES** card is now **full-width**, so a large amount like
  `44 714 530,64 MAD` no longer gets cut off after we moved to 2 decimals.
- Below it, **AVERAGE GROSS MARGIN** and **TRANSACTIONS** sit **side by side**. The **Revenue**
  card stays the main tile on the left with its mini trend chart.

### 1.4 Margins — consistent figures
- **Gross margin** now reconciles with **its own percentage everywhere**.
  - **Example of the old bug:** a card could show a gross margin of *X* MAD and a margin of
    *31 %* that didn't multiply back to the revenue. Now the dirham amount and the percentage
    match exactly.
- **Accounting page:** the misleading **"Balance (Revenue − Purchases)"** indicator was replaced
  by **"Result (gross margin)"**.
  - **Why:** in a month with heavy restocking you buy more than you sell that month (the rest
    goes to stock), so "Revenue − Purchases" showed a **fake loss** (e.g. −7,4 M MAD) even on a
    profitable business. "Result (gross margin)" = revenue − cost of goods **actually sold**,
    which is the real profit.

### 1.5 French number & currency formats
- **Percentages: 3 decimals** everywhere (e.g. `31,039 %`).
- **Currency (MAD): 2 decimals** with a **thousands separator**, on Purchases, Sales, Report and
  Stock. **No k/M abbreviations** — full numbers in French format.
  - **Example:** an amount shows as `95 649,13 MAD`, never `95.6k` or `95649,13`.
- On import, amounts are stored as **currency values** (not rounded to integers).
  - **Example:** a unit price of `12,45 MAD` stays `12,45`, not `12`.

### 1.6 Charts
- The **monthly trend** chart was rebuilt: **interactive** (hover to read exact values), a
  **Y axis** was added, numbers in **French format**, and it now displays correctly **even for a
  single month**.
  - **Example of the old bug:** selecting 01/06/2026 → 30/06/2026 (one month) showed an **empty**
    chart because a single point can't draw a line; now a dot with its value is shown on hover.
- **Revenue breakdown** by category: a donut **plus a table**, including a **margin (%)** column.

### 1.7 Stock
- Default date range is now **the last 2 years up to today** (instead of empty).
  - **Example:** opening Stock today defaults to 15/07/2024 → 15/07/2026.
- The **status filter** was moved **above the table** as a selector — quicker to reach than
  inside the filter panel.

### 1.8 Miscellaneous
- Fixed the **blank white screen** that sometimes appeared at the end of an import — a clear
  message is now shown instead.
- Sobrus source files (`resources/Sobrus*`) are excluded from the repository (`.gitignore`).

---

## 2. Business decision needed — wrong VAT on "Medicines"

> **This part needs a decision from you (business / PO).**

### 2.1 One-sentence summary
Some products classified as **"Medicine" (Médicament)** carry a **20 % VAT**, whereas a medicine
must be **VAT-exempt (0 %)**. We need to decide, **product by product**, whether each is a real
medicine (→ set VAT to 0 %) or a mis-classified supplement/cosmetic (→ change the category and
keep 20 %).

### 2.2 The problem
- In Morocco, a medicine is **VAT-exempt (0 %)**.
- In the catalog, **1,084 products** in the "Medicine" category have a **20 % VAT**.
- Confirmed examples:
  - **THEALOSE COLLYRE 10ML** (code 63318) — Medicine, but VAT 20 %
  - **RELAXIUM B6 CO 375MG B30 GÉLULES** (code 105898) — Medicine, but VAT 20 %
- **Consequence:** collected VAT, VAT to declare, and the displayed margins are **wrong** for
  these products.

### 2.3 Why it happens
- The **category** and **VAT** are imported **as-is from Sobrus**. If Sobrus has the wrong VAT,
  the app copies it exactly.
- In reality, many of these 1,084 products are **creams, gels, capsules, food supplements**
  wrongly filed as "Medicine". For those, 20 % VAT is correct — it's the **category** that's
  wrong.

### 2.4 Decision required
For **each product** in the attached list, pick one of two options:

| Case | Decision | Effect |
|---|---|---|
| **Real medicine** | `medicament` | Set **VAT to 0 % (Exempt)** |
| **Mis-classified supplement/cosmetic** | `reclasser` | **Change the category** (keeps 20 %) |

👉 **File to complete:** `medicaments_tva20_a_corriger.csv` (attached / on the Desktop) —
**1,084 rows**. Columns:

| Column | Meaning |
|---|---|
| `pid` | product code (internal code or barcode) |
| `produit` | product name |
| `categorie_actuelle` | current category (e.g. `Médicament (30.000%)`) |
| `tva_actuelle` | current VAT (e.g. `TVA (20.00%)`) |
| `ppv` | public sale price — *for context, helps decide* |
| `pph` | pharmacy purchase price — *for context, helps decide* |
| **`DECISION (medicament \| reclasser)`** | **← to fill:** `medicament` or `reclasser` |
| **`NOUVELLE_CATEGORIE (si reclasser)`** | **← to fill** only if `reclasser` (e.g. `Complément`) |

For each row, fill the **`DECISION`** column with `medicament` (real medicine → VAT set to 0 %)
or `reclasser` (mis-classified → keep 20 %, and put the correct category in
**`NOUVELLE_CATEGORIE`**). Once completed, we apply everything in one pass.

> Note: the same product can appear twice (Sobrus stores an internal code **and** a barcode) —
> this is normal; each row is handled. Example above: `3D VIT 10ML` appears with code `86110`
> and with barcode `2356898754210`.

### 2.5 Already in place
- ✅ The **full list** of the 1,084 products to review is ready (file above).
- ✅ A **safeguard** was added: when manually saving a "Medicine" with a VAT ≠ 0 %, a
  **warning appears and asks for confirmation** — to stop the problem recurring on future manual
  entries.
  - **Example:** an operator sets category "Médicament" and VAT 20 % → a dialog warns
    "A medicine should be VAT-exempt (0 %). Confirm anyway?".

### 2.6 Point of attention — recurrence
The data comes from **Sobrus**. A fix made **only in the app** can be **overwritten if the
catalog is re-imported** from Sobrus.
- **Sales / purchases** imports are fine (they don't overwrite the category).
- But a **catalog re-import** would bring back the old VAT.

➡️ **Recommendation:** also fix **at the source in Sobrus** (ideal), or enable an automatic
correction at import time on the app side (to be validated).

### 2.7 Note (out of scope for now)
There are also **317 products** in "Medicine" with a **7 % VAT**. The reduced 7 % rate can be
**valid** for some medicines, so they are **not** included in this correction — **unless you
decide otherwise**.

---

## 3. Quality / verification
- **Automated tests:** **334** back-end tests and **142** front-end tests **pass**.
- Front-end type check (`tsc`): **OK**.
- Search behavior verified against the real database (the examples in §1.1 are actual results).

---

## 4. Remaining work (after your decision)
1. **Medicine VAT:** apply the bulk corrections (VAT 0 % or category change), based on the
   completed file.
2. **Duplicate categories:** merge "Medicament" (no accent) and "Médicament" (with accent) into
   a **single** category.
3. **Recurrence:** decide between fixing at the source (Sobrus) and/or automatic normalization
   at import.
