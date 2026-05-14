# Changelog

## 1.1.0 — 2026-05-11

### Added
- **Pharmacy code & city** — every new pharmacy now requires a city; backend auto-generates a `BOU0001`-style code (3-letter city prefix + 4-digit counter, accent-stripped).
- **Invite-by-email** — owners can invite employees from `/owner/employees`; admin equivalent under `POST /admin/users/invite`. Invitees receive a 7-day reset-password link to set their initial password.
- **Year-over-year CA comparison** — `compute_previous_kpis` rewritten to subtract a full year (was "previous period of equal length"). CA card on `/rapports` shows previous-year MAD value explicitly, plus a `↑/↓ X% vs an dernier` badge.
- **Calendar-aligned ABCD window on `/stock`** — Jan-Jun shows the full previous calendar year; Jul-Dec shows a rolling Jul-Jun window. Backend `stock_abcd_window()` mirrored by frontend `stockAbcdWindow()`.
- **`/stock` status filter + server-side sort** — new Statut select (négatif / sous-stock / OK / sur-stock); class + status + sort flow to backend so pagination is correct across the whole dataset.
- **Alert dialogs** — clicking any `/rapports` Alertes Marges card jumps to `/alertes`, whose `AlertCard`s now open `AlertDetailDialog` (full product table with sortable headers). Tables export to **XLSX or PDF** via a dropdown.
- **`/comptabilite` filters** — toggle for "Avec / Sans produits spéciaux" (flows through to KPIs, ventes list, and the Excel export). Excel export in Mixte now emits **two sections** (Pharmacie + Parapharmacie) and one Produits sheet per section.
- **`/analyse` Année pivot mode** — new mode renders rows = years, columns = Jan…Déc CA.
- **`/analyse` table CSV export** respects the active search filter (was: needed an explicit selection).
- **Auto-applied produit-spéciaux** — owner-flagged products skip admin approval; the request is logged as `APPROVED` for audit and `PharmacyMedicamentStatus` is updated immediately.
- **Multi-token search + fuzzy match + barcode lookup** — `tokenize_search` splits on whitespace and `*` (Google/GitHub-style). Each token can match product name, PID, barcode1/barcode2, or supplier (where applicable). 4+ char tokens also match via PostgreSQL `pg_trgm` `word_similarity > 0.5` so `TRANSPAENT` matches `TRANSPARENT`.
- **Wildcard syntax** — `*anthe`, `*roche*posay`, `la roche posay anthe` all work and are AND-joined.
- **Dark mode** — `next-themes` wired up; toggle in the header offers Clair / Sombre / Système, persisted to `localStorage`.
- **Segmented date input + DateRangePicker** — typing `02062026` auto-advances DD → MM → YYYY; opens a 2-month range calendar with quick-pick presets (Mois actuel, Mois antérieur, Trimestre antérieur, Année antérieur).
- **Default date = current month** across 8 page-level filters.
- **Three-section import history** — `/parametres → Zone de danger` now lists Achats / Ventes / Stock separately. Stock uploads now create an `ImportBatch` row.
- **Server-side sort across paginated tables** — `/ventes`, `/achat`, `/admin/catalog`, `/comptabilite`, `/stock` all send `sort_by` / `sort_order` to the backend (fixes the "sort only sorts the visible page" bug).
- **Equation tagline under every KPI card** — `text-[10px] opacity-50 font-mono` line below the value (e.g. "PPV × qté vendue", "encaissée − payée", "(OK ÷ total) × 100").
- **`/rapports` first section collapsible** — Performance banner is collapsed by default; state persisted per user.
- **Export Ventes surveillance table** — separate "Exporter" button next to the surveillance tab chips; honours the active surveillance filter.
- **"Tout sélectionner" + fournisseur search** in the Produits Spéciaux dialog.

### Changed
- **Locale `fr-MA` → `fr-FR`** in `utils/format.ts` so thousand separators render as NBSP (`3 753`) instead of dot (`3.753`).
- **Integer formatter `fmtInt`** — counts/quantities (`Unités disponibles`, `Total références`, etc.) now render without trailing `,00`.
- **`/alertes` cards** — clickable buttons that open per-bracket detail dialogs.
- **`/rapports` Alertes Marges cards** — products list removed; cards redirect to `/alertes`.
- **CSV mojibake fix** — `fix_mojibake()` runs at CSV ingest to repair double-encoded UTF-8 → MacRoman → UTF-8 artefacts (`Cat√©gorie` → `Catégorie`, `HELIOCARE 360¬∞` → `HELIOCARE 360°`).
- **N-1 wording dropped** — replaced everywhere with plain French ("Année précédente", "vs an dernier", "Comparé à la même période l'année dernière").

### Fixed
- Pharmacy-code backfill on startup flushes after each assignment so rows sharing a 3-letter prefix get distinct codes (was crashing the boot with `UniqueViolation` on `ix_pharmacies_code`).
- `_compute_excel_section` applies the category filter to KPIs (was always pharmacy-wide regardless of filter).
- Rate-limit interference in tests disabled in `conftest.py`.
- pg_trgm extension created at startup; safe on every boot.

## 1.0.0
Initial release.
