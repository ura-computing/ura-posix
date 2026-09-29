# Backend review: moving the heavy parts to microservices

Scope: the **import** of big files and the **Rapport** calculations. Reviewed on 2026-09-29. Line numbers are from that date.

---

## 1. How it works today

### Import
```
Browser: parses the CSV → splits it into 500-row chunks → POSTs one chunk at a time
   └─ POST /v1/uploads/{achat|vente|stock}-json      (frontend/src/contexts/UploadContext.tsx:31)
        └─ _insert_transactions / _insert_stock      (backend/routers/uploads.py:300, 367)
             ├─ auth + permissions                    ~6–8 queries
             ├─ find products by PID + by name        2 queries
             ├─ load existing rows for dedup          1 query
             └─ bulk INSERT + COMMIT
```
Each chunk costs about 12–16 queries. A 20,000-row file makes 40 chunks, which is about 600 queries.

### Rapport
```
GET /v1/stats → build_stats_payload (routers/stats.py:148)
   ├─ trend           2 queries
   ├─ KPIs            2
   ├─ extra stats     6  (days, TVA ×2, marge, pharmacie/parapharmacie)
   ├─ previous year   3
   └─ top categories  1
+ GET /v1/stats/margin-alerts
+ GET /v1/stats/stock-summary
```
The `/stats` call alone runs about 14 aggregate queries, one after another.

**Good news:** the calculations are pure functions that take `(db, filters)` and return a `dict`. They live in `stats_queries.py`, `analyse_queries.py` and `stock_queries.py`, so they can move into a worker without being rewritten.

---

## 2. Blockers for a split

| # | Problem | Where |
|---|---------|-------|
| B1 | One shared DB | every module |
| B2 | Auth needs the DB | `security.py:59` |
| B3 | In-memory rate limit | `rate_limit.py:15` |
| B4 | Single process + blocking uploads | `database.py:10`, `uploads.py:452-479` |
| B5 | Race when a new product is inserted | `uploads.py:277` |
| B6 | Wrong batch status | `uploads.py:351` |
| B7 | Totals depend on the current price | `stats_queries.py:299` |
| B8 | Dates stored as text | `models.py` (Achat, Vente) |
| B9 | Server timezone | `date.today()` in `*_queries.py` |

**B1 — One shared DB.** Import and stats both read `medicaments` and the exclusion tables.
→ Start with workers that use the **same DB and the same models**. Don't split the database.

**B2 — Auth needs the DB.** Every request loads the user, the session row, and 3 layers of permissions.
→ A new service needs the same `JWT_SECRET` plus DB access, or a gateway that checks auth once.

**B3 — In-memory rate limit.**
```
1 instance : login limit = 5/min
2 instances: login limit = 10/min  (each instance counts on its own)
```
→ Use Redis as the shared store: `Limiter(storage_uri="redis://...")`.

**B4 — Single process + blocking uploads.** `upload_achat` is `async def` but runs sync SQLAlchemy.
```
Pharmacy A uploads a 50 MB CSV → the event loop is blocked
Pharmacy B opens /rapport       → waits until A's upload finishes
```
→ Change these endpoints to plain `def`, or move the work to a worker.

**B5 — Race when a new product is inserted.**
```
worker 1: PID 12345 not found → INSERT
worker 2: PID 12345 not found → INSERT → UniqueViolation → 500
```
→ `INSERT ... ON CONFLICT (pid) DO NOTHING`, then re-select.

**B6 — Wrong batch status.** The batch is set to `"success"` after **every** chunk.
```
chunk 1/40 done → status "success"
browser closes  → the batch stays "success" with only 500 of 20,000 rows
```
→ Add an explicit finalize step. The status stays `in_progress` until the last chunk.

**B7 — Totals depend on the current price.** Sales total (CA) = `qty × Medicament.ppv`, and `ppv` is **global and mutable**.
```
Jan: DOLIPRANE sold 100 × 15.00 → CA 1,500
Jun: any pharmacy imports DOLIPRANE ppv 16.50
     → January's CA becomes 1,650 for every pharmacy
```
→ Any cache must be cleared on every import, catalog edit and exclusion change.

**B8 — Dates stored as text.** `Vente.date` and `Achat.delivery_date` are VARCHAR. The trend, mois and année queries run `cast(date as Date)`.
```
cast(...) → the index can't be used → full scan
"15/01/2024" (bad format) → cast error → 500
```
→ Migrate these columns to real `DATE` columns.

**B9 — Server timezone.** `date.today()` uses the server's timezone.
```
Server in UTC, pharmacy in Casablanca, 00:30 local → "today" is still yesterday
```
→ Pin `TZ=Africa/Casablanca` in every service.

---

## 3. Bugs found

| # | Bug | Example |
|---|-----|---------|
| G1 | `uploads.py:337-342` dedup key = (BL, product) | BL-123 has DOLIPRANE lot A ×10 and lot B ×5 → the second line is skipped → 10 stored instead of 15 |
| G2 | `analyse_queries.py:184` row CA = `Vente.total`, but KPI CA = `qty × PPV` | 10 × 20 DH with a 10 % discount → row shows 180, KPI shows 200 |
| G3 | `analyse_queries.py:378` sales joined once per supplier | product X bought from GROSSISTE A and LABO B, 100 sold → counted 100 in both rows |
| G4 | `analyse_queries.py:658` loads the **whole** catalog and runs substring loops | a 200-item list × a 30k-product catalog → about 6M comparisons per request |
| G5 | `uploads.py:22` docstring is out of date | it says "10 MB" and mentions a stock multipart endpoint; the code allows 100 MB and has no such endpoint |

---

## 4. Suggested order

1. **Cheap fixes needed for any split:** B3, B4, B5.
2. **Import worker:**
   ```
   API: validate + queue the chunk → return batch_id right away
   Worker: _insert_transactions(chunk) → last chunk → finalize (B6)
   ```
3. **Stats:** cache the `/stats` payload by key:
   ```
   key = (pharmacy_id, date_from, date_to, category_type, include_non_declared)
   clear on: import · catalog edit · exclusion change   (because of B7)
   ```
   Option: add a precomputed `daily_sales(pharmacy_id, date, medicament_id, qty, ca)` table, refreshed after each import.
