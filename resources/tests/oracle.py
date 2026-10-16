"""Oracle v2: every value the app returns for the generated data, field by field.

It pins TODAY'S app behavior (backend/app/analytics/stats_queries.py, analyse_queries.py,
stock_queries.py, routers/transactions.py) so the refactor can't change any
number silently. It never imports app code: the formulas are re-written here in
plain Python from the generated rows. Where today's behavior breaks a business
rule, the E2E suite has a separate `test.fail` naming the bug.

Output shape (written by generate.py into expected.json) — see `build()`.
"""
from __future__ import annotations

import calendar
import re
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from itertools import product as cartesian


CATEGORY_TYPES = ("all", "pharmacie", "parapharmacie")
MARGIN_BRACKETS = [("negative", None, 0), ("low", 0, 10), ("medium", 10, 60),
                   ("high", 60, 90), ("very_high", 90, None)]
FR_MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"]
MONTH_KEYS = [f"m{i:02d}" for i in range(1, 13)]
PCT_SUFFIX = re.compile(r"\s*\(\d+(?:\.\d+)?%\)")
ANALYSE_MODES = ("produit", "categorie", "laboratoire", "grossiste", "operateur", "mois", "annee")

# Search / suggestion queries replayed by the E2E suite (typed in the search box).
VENTE_QUERIES = ["00042", "client 00", "fac-1234*", "*042", "00*42"]
ACHAT_QUERIES = ["00042", "grossiste s", "10012*", "*042", "00*42"]
# /analyses search box (client-side, Produit × Mixte): `00*42` = one word, `médicament`
# matches the category column. Année mode sends the box text as `product` (ILIKE %x%).
ANALYSE_QUERIES = ["00*42", "médicament"]
ANNEE_PRODUCT = "PRODUIT 0004"

# /produits search box (e2e/tests/18-produits.spec.ts): one word with `*`, a PID part.
PRODUCT_QUERIES = ["00*42", "90010"]

# Produits spéciaux scenario (e2e/tests/10-exclusions.spec.ts).
EXCLUDED_SUPPLIER = "Laboratoire WELEDA"
SUPPLIER_QUERY = "weleda"


# ─── Small helpers ───────────────────────────────────────────────────────────

def r2(x: float) -> float: return round(x, 2)
def r3(x: float) -> float: return round(x, 3)
def r4(x: float) -> float: return round(x, 4)


def strip_pct(s: str | None) -> str:
    return PCT_SUFFIX.sub("", s).strip() if s else (s or "")


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def subtract_year(d: date) -> date:
    y = d.year - 1
    return date(y, d.month, min(d.day, calendar.monthrange(y, d.month)[1]))


def months_back(d: date, n: int) -> date:
    """Same day n months before, cut to the month's length (frontend utils/dateRange monthsAgo)."""
    y, m = divmod(d.year * 12 + d.month - 1 - n, 12)
    return date(y, m + 1, min(d.day, calendar.monthrange(y, m + 1)[1]))


def month_start(d: date) -> date:
    return d.replace(day=1)


def next_month(d: date) -> date:
    return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)


def name_has(p, product: str | None) -> bool:
    """Backend `Medicament.product ILIKE %product%` (case-insensitive substring)."""
    return not product or product.strip().lower() in p.name.lower()


def cat_ok(p, ct: str) -> bool:
    return ct == "all" or (ct == "pharmacie") == p.pharma


def ca(v) -> float:
    """CA = qty × coalesce(Medicament.ppv, Vente.unit_price) — PPV always set here."""
    return v.qty * v.p.ppv


def avg_pu(achats) -> dict[str, float]:
    """Weighted purchase price per product: Σ(PU × qty) / Σ qty (qty > 0)."""
    num: dict[str, float] = defaultdict(float)
    den: dict[str, float] = defaultdict(float)
    for a in achats:
        if a.qty > 0:
            num[a.p.pid] += a.unit * a.qty
            den[a.p.pid] += a.qty
    return {pid: num[pid] / den[pid] for pid in num if den[pid]}


def mean(xs: list[float]) -> float | None:
    return sum(xs) / len(xs) if xs else None


def bracket(marge_pct: float) -> str | None:
    for key, lo, hi in MARGIN_BRACKETS:
        if (lo is None or marge_pct >= lo) and (hi is None or marge_pct < hi):
            return key
    return None


def abcd_class(units: int, units_4m: int, units_before: int) -> str:
    if units >= 300: return "A"
    if units >= 250: return "A-"
    if units >= 200: return "B+"
    if units >= 48:  return "B"
    if units >= 6:   return "C"
    if 1 <= units <= 5:
        return "C-N" if units_before == 0 and units_4m >= 1 else "C-"
    return "D"


def coverage_status(stock: int | None, units_12m: int) -> str:
    if stock is None: return "inconnu"
    if stock < 0: return "negatif"
    if units_12m <= 0: return "inconnu"
    days = stock * 365.0 / units_12m
    if days <= 45: return "sous-stock"
    if days <= 60: return "ideal"
    if days <= 99: return "a-surveiller"
    return "sur-stock"


def default_abcd_window(today: date) -> tuple[date, date]:
    if today.month <= 6:
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31)
    return date(today.year - 1, 7, 1), date(today.year, 6, 30)


# ── Search grammar (backend/app/core/search.py) ──────────────────────────────────────

def tokenize(query: str) -> list[str]:
    seen: list[str] = []
    for raw in query.strip().split():
        tok = raw.strip().lower()
        if tok and tok not in seen:
            seen.append(tok)
    return seen


def token_match(value: str | None, token: str, *, unaccent: bool) -> bool:
    if value is None:
        return False
    v = strip_accents(value).lower() if unaccent else value.lower()
    tok = strip_accents(token).lower() if unaccent else token.lower()
    parts = [p for p in tok.split("*") if p]
    if not parts:
        return True
    if len(parts) >= 2:                                        # infix: within ONE word (\m…\M)
        inner = r"\S*".join(re.escape(p) for p in parts)
        return re.search(r"(?<!\w)" + inner + r"(?!\w)", v) is not None
    if tok.endswith("*") and not tok.startswith("*"):
        return v.startswith(parts[0])
    return parts[0] in v


def product_match(p, token: str) -> bool:
    """Name, PID, or the barcode the stock file gave it (« Code barre 1 »: products in that file)."""
    return (token_match(p.name, token, unaccent=True) or token_match(p.pid, token, unaccent=False)
            or (p.stock is not None and token_match(p.barcode, token, unaccent=False)))


def is_grossiste(supplier: str) -> bool:
    return supplier.upper().startswith("GROSSISTE")


# ─── The oracle ──────────────────────────────────────────────────────────────

class Oracle:
    def __init__(self, products, ventes, achats, today: date, df: date, dt: date):
        self.products, self.ventes, self.achats = products, ventes, achats
        self.today, self.df, self.dt = today, df, dt
        self.vw = [v for v in ventes if df <= v.day <= dt]
        self.aw = [a for a in achats if df <= a.day <= dt]
        self.pu_window = avg_pu(self.aw)
        self.pu_alltime = avg_pu(achats)
        self.stocked = [p for p in products if p.stock is not None]

    # ── Rapport /stats ──────────────────────────────────────────────────────

    def marge(self, ventes, pus: dict[str, float]) -> dict:
        groups: dict[float, list[float]] = defaultdict(lambda: [0.0, 0.0])
        for v in ventes:
            pu = pus.get(v.p.pid)
            if pu is not None:
                g = groups[v.p.tva]
                g[0] += v.qty * v.p.ppv
                g[1] += v.qty * pu
        s_ppv = sum(g[0] for g in groups.values())
        s_pu = sum(g[1] for g in groups.values())
        return {
            "marge_pct": r3((1 - s_pu / s_ppv) * 100 if s_ppv else 0),
            "marge_brute_dh": r2(s_ppv - s_pu),
            "marge_nette_dh": r2(sum((g[0] - g[1]) / (1 + tva / 100) for tva, g in groups.items())),
        }

    @staticmethod
    def reconcile(m: dict, total_ca: float) -> dict:
        ratio = m["marge_nette_dh"] / m["marge_brute_dh"] if m["marge_brute_dh"] else 0.0
        brute = r2(total_ca * m["marge_pct"] / 100)
        return {"marge_pct": m["marge_pct"], "marge_brute_dh": brute, "marge_nette_dh": r2(brute * ratio)}

    def top_categories(self, vw) -> list[dict]:
        raw: dict[str, dict] = {}
        for v in vw:
            g = raw.setdefault(v.p.category, {"total": 0.0, "qty": 0.0, "pu": [], "ppv": []})
            g["total"] += ca(v)
            g["qty"] += v.qty
            pu = self.pu_alltime.get(v.p.pid)                   # no date filter in _top_categories
            if pu is not None:
                g["pu"].append(pu)
            g["ppv"].append(v.p.ppv)
        merged: dict[str, dict] = {}
        for category, g in raw.items():
            m = merged.setdefault(strip_pct(category), {"total": 0.0, "pu_sum": 0.0, "ppv_sum": 0.0, "qty_sum": 0.0})
            m["total"] += g["total"]
            avg_pu_row = mean(g["pu"])
            if avg_pu_row is not None:
                m["pu_sum"] += avg_pu_row * g["qty"]
                m["ppv_sum"] += (mean(g["ppv"]) or 0) * g["qty"]
                m["qty_sum"] += g["qty"]
        out = []
        for k, m in merged.items():
            pct = None
            if m["qty_sum"] > 0 and m["ppv_sum"] > 0:
                a_pu, a_ppv = m["pu_sum"] / m["qty_sum"], m["ppv_sum"] / m["qty_sum"]
                if a_ppv > 0:
                    pct = r3((1 - a_pu / a_ppv) * 100)
            out.append({"category": k, "total": r2(m["total"]), "marge_pct": pct})
        return sorted(out, key=lambda x: x["total"], reverse=True)

    def trend(self, ct: str) -> list[dict]:
        first, last = month_start(self.df), month_start(self.dt)
        stop = next_month(last)
        tv: dict[date, float] = defaultdict(float)
        ta: dict[date, float] = defaultdict(float)
        for v in self.ventes:
            if first <= v.day < stop and cat_ok(v.p, ct):
                tv[month_start(v.day)] += ca(v)
        for a in self.achats:
            if first <= a.day < stop and cat_ok(a.p, ct):
                ta[month_start(a.day)] += a.total
        points, cur = [], first
        while cur <= last:
            points.append({"label": FR_MONTHS[cur.month - 1], "ventes": r2(tv[cur]), "achats": r2(ta[cur])})
            cur = next_month(cur)
        return points

    def stats(self, ct: str) -> dict:
        vw = [v for v in self.vw if cat_ok(v.p, ct)]
        aw = [a for a in self.aw if cat_ok(a.p, ct)]
        total_ca = sum(ca(v) for v in vw)

        daily: dict[date, list[float]] = defaultdict(lambda: [0.0, 0])
        for v in vw:
            daily[v.day][0] += ca(v)
            daily[v.day][1] += 1

        def ties(pick, idx: int) -> dict | None:
            if not daily:
                return None
            best = pick(t[idx] for t in daily.values())
            return {"value": best, "dates": sorted(d.isoformat() for d, t in daily.items() if t[idx] == best)}

        p_df, p_dt = subtract_year(self.df), subtract_year(self.dt)
        pv = [v for v in self.ventes if p_df <= v.day <= p_dt and cat_ok(v.p, ct)]
        pa_all = [a for a in self.achats if p_df <= a.day <= p_dt]
        tva_enc = sum(ca(v) * v.p.tva / 100 for v in vw)
        tva_pay = sum(a.total * a.p.tva / 100 for a in aw)

        return {
            "kpis": {"ventes_total": total_ca, "ventes_count": len(vw),
                     "achats_total": sum(a.total for a in aw), "achats_count": len(aw)},
            "previous_kpis": {
                "ventes_total": sum(ca(v) for v in pv),
                "achats_total": sum(a.total for a in pa_all if cat_ok(a.p, ct)),
                "marge_pct": self.marge(pv, avg_pu(pa_all))["marge_pct"],
            },
            "marge": self.reconcile(self.marge(vw, self.pu_window), total_ca),
            "tva": {"tva_encaissee": r2(tva_enc), "tva_payee": r2(tva_pay), "tva_a_declarer": r2(tva_enc - tva_pay)},
            "type_breakdown": {
                "pharmacie":     {"ventes_total": r2(sum(ca(v) for v in self.vw if v.p.pharma))},
                "parapharmacie": {"ventes_total": r2(sum(ca(v) for v in self.vw if not v.p.pharma))},
            },
            "advanced_kpis": {
                "ticket_moyen": r2(total_ca / len(vw)) if vw else 0,
                "vente_moyenne_par_jour": r2(total_ca / len(daily)) if daily else 0,
                "best_day_dh": ties(max, 0), "worst_day_dh": ties(min, 0),
                "best_day_count": ties(max, 1), "worst_day_count": ties(min, 1),
            },
            "trend_granularity": "month",
            "monthly_trend": self.trend(ct),
            "top_categories": self.top_categories(vw),
        }

    # ── Alertes ─────────────────────────────────────────────────────────────

    def margin_alerts(self, ct: str) -> dict:
        per: dict[str, list] = {}
        for v in self.vw:
            if cat_ok(v.p, ct):
                row = per.setdefault(v.p.pid, [v.p, 0, 0.0])
                row[1] += v.qty
                row[2] += ca(v)
        out = {k: {"count": 0, "total_ca": 0.0, "total_margin_dh": 0.0, "products": []} for k, _, _ in MARGIN_BRACKETS}
        for pid, (p, qty, total) in per.items():
            pu = self.pu_window.get(pid)
            if not pu or not p.ppv:
                continue
            pct = r3((1 - pu / p.ppv) * 100)
            key = bracket(pct)
            if key is None:
                continue
            b = out[key]
            b["count"] += 1
            b["total_ca"] += total
            b["total_margin_dh"] += r2(qty * (p.ppv - pu))
            b["products"].append({"product": p.name, "marge_pct": pct, "ca": r2(total)})
        for b in out.values():
            b["total_ca"], b["total_margin_dh"] = r2(b["total_ca"]), r2(b["total_margin_dh"])
        return out

    def ventes_sans_achat(self, ct: str) -> dict:
        bought = {a.p.pid for a in self.aw}
        per: dict[str, dict] = {}
        for v in self.vw:
            if cat_ok(v.p, ct) and v.p.pid not in bought:
                r = per.setdefault(v.p.pid, {"p": v.p, "units": 0.0, "ca": 0.0, "last": v.day})
                r["units"] += v.qty
                r["ca"] += ca(v)
                r["last"] = max(r["last"], v.day)
        top = sorted(per.values(), key=lambda r: r["ca"], reverse=True)[:500]
        products = [{"product": r["p"].name, "category": r["p"].category, "ppv": r["p"].ppv,
                     "units_sold": r2(r["units"]), "ca": r2(r["ca"]), "last_vente_date": r["last"].isoformat()}
                    for r in top]
        return {"count": len(products),
                "total_ca": r2(sum(p["ca"] for p in products)),
                "total_units_sold": r2(sum(p["units_sold"] for p in products)),
                "products": products}

    # ── Stock ───────────────────────────────────────────────────────────────

    def stock_summary(self) -> dict:
        since = self.today - timedelta(days=365)
        units: dict[str, float] = defaultdict(float)
        for v in self.ventes:
            if v.day >= since:
                units[v.p.pid] += v.qty
        sous = sur = band = 0
        for p in self.stocked:
            u = units.get(p.pid, 0.0)
            if u <= 0:
                continue
            if p.stock < u / 300 * 14:
                sous += 1
            elif p.stock > u / 300 * 15:
                sur += 1
            else:
                band += 1
        classified = sous + sur + band
        return {"total_references": len(self.stocked),
                "ppv_potentiel": r2(sum(p.stock * p.ppv for p in self.stocked)),
                "sous_stock_count": sous, "sur_stock_count": sur, "in_band_count": band,
                "health_pct": round((band + sur) / classified * 100, 1) if classified else 0.0}

    def stock_abcd(self, start_12m: date, end: date) -> dict:
        start_4m = end - timedelta(days=120)
        u12: dict[str, int] = defaultdict(int)
        u4: dict[str, int] = defaultdict(int)
        before: dict[str, int] = defaultdict(int)
        for v in self.ventes:
            if start_12m <= v.day <= end:
                u12[v.p.pid] += v.qty
            if start_4m <= v.day <= end:
                u4[v.p.pid] += v.qty
            if start_12m <= v.day < start_4m:
                before[v.p.pid] += v.qty
        ids = set(u12) | {p.pid for p in self.stocked}
        products, ppv_pot = [], 0.0
        distribution: dict[str, int] = defaultdict(int)
        for p in self.products:
            if p.pid not in ids:
                continue
            units = u12.get(p.pid, 0)
            cls = abcd_class(units, u4.get(p.pid, 0), before.get(p.pid, 0))
            distribution[cls] += 1
            if p.stock is not None and p.stock > 0:
                ppv_pot += p.ppv * p.stock
            pu = self.pu_alltime.get(p.pid)                    # no date filter in compute_stock_abcd
            products.append({
                "product": p.name, "category": cls, "units_sold_12m": units,
                "stock_min": round(units / 300 * 14) if units > 0 else 0,
                "stock_max": round(units / 300 * 15) if units > 0 else 0,
                "current_stock": p.stock, "ppv": r2(p.ppv),
                "avg_pu": r4(pu) if pu is not None else None,
                "status": coverage_status(p.stock, units),
            })
        return {"date_from": start_12m.isoformat(), "date_to": end.isoformat(),
                "distribution": dict(sorted(distribution.items())),
                "total_references": len(products), "ppv_potentiel": r2(ppv_pot), "products": products}

    # ── Produits ────────────────────────────────────────────────────────────

    def products_list(self, infos: dict[str, dict]) -> list[dict]:
        """GET /products rows (no id): every product in the stock file, sold or bought (any
        date); « vendus 12 mois » + average PU = the Stock page's (no exclusions). `infos`:
        scraped info per PID, once 18-produits gave the barcode (generate.make_product_infos)."""
        start, end = default_abcd_window(self.today)
        units: dict[str, int] = defaultdict(int)
        for v in self.ventes:
            if start <= v.day <= end:
                units[v.p.pid] += v.qty
        linked = {p.pid for p in self.stocked} | {v.p.pid for v in self.ventes} | {a.p.pid for a in self.achats}
        rows = []
        for p in self.products:
            if p.pid not in linked:
                continue
            pu = self.pu_alltime.get(p.pid)
            rows.append({
                "pid": p.pid, "product": p.name, "laboratoire": None, "category": p.category,
                "category_type": "pharmacie" if p.pharma else "parapharmacie",
                "current_stock": p.stock, "units_sold_12m": units.get(p.pid, 0), "ppv": r2(p.ppv),
                "avg_pu": r4(pu) if pu is not None else None,
                "marge_pct": r2((1 - pu / p.ppv) * 100) if pu is not None and p.ppv > 0 else None,
                "photo": infos[p.pid]["images"][0] if p.pid in infos else None,
            })
        return sorted(rows, key=lambda r: r["product"])

    def product_sheet(self, p, info: dict | None, barcode1: str | None) -> dict:
        """GET /products/{id} (no id): Stock page rules for min / max / status, the 5
        latest lines (newest day first; same day: sales, then purchases; then latest line),
        units sold / bought in the last 30 days (today and the 29 before) and the 30 before."""
        start, end = default_abcd_window(self.today)
        units = sum(v.qty for v in self.ventes if v.p is p and start <= v.day <= end)
        pu = self.pu_alltime.get(p.pid)
        last = max((a for a in self.achats if a.p is p and a.qty > 0), key=lambda a: (a.day, a.seq), default=None)
        moves = [(a.day, "achat", a.seq, a.qty, a.unit, a.ref, a.supplier) for a in self.achats if a.p is p]
        moves += [(v.day, "vente", v.seq, -v.qty, v.unit, v.ref, v.client or None) for v in self.ventes if v.p is p]
        moves.sort(key=lambda m: (m[0], m[1], m[2]), reverse=True)
        stock = p.stock
        return {
            "pid": p.pid, "product": p.name, "laboratoire": None, "category": p.category,
            "category_type": "pharmacie" if p.pharma else "parapharmacie", "tva": p.tva_label,
            # The stock file's « Code barre 1 » fills it at import; 18-produits' admin gives the photo one.
            "barcode1": barcode1 or (p.barcode if p.stock is not None else None), "barcode2": None, "info": info,
            "prices": {
                "ppv": r2(p.ppv), "pph": r2(p.pph), "avg_pu": r4(pu) if pu is not None else None,
                "last_pu": r4(last.unit) if last else None, "last_pu_date": last.day.isoformat() if last else None,
                "marge_pct": r2((1 - pu / p.ppv) * 100) if pu is not None and p.ppv > 0 else None,
            },
            "stock": {
                "current_stock": stock, "units_sold_12m": units,
                "stock_min": round(units / 300 * 14) if units > 0 else 0,
                "stock_max": round(units / 300 * 15) if units > 0 else 0,
                "sales_from": start.isoformat(), "sales_to": end.isoformat(),
                "coverage_days": round(stock * 365 / units) if stock is not None and stock >= 0 and units > 0 else None,
                "status": coverage_status(stock, units),
                "expiry_date": p.expiry.isoformat() if stock is not None and p.expiry else None,
                "zone": p.zone.strip(),   # the browser trims every cell of the file
            },
            "recent_movements": [
                {"kind": kind, "date": day.isoformat(), "quantity": qty, "unit_price": unit, "document": ref,
                 "party": party}
                for day, kind, _, qty, unit, ref, party in moves[:5]
            ],
            "imported": {},   # no owner edit (18-produits « modifier » puts everything back)
        }

    def stats_periods(self) -> dict[str, tuple[date, date]]:
        """Statistiques dates (the Ventes picker): the last 30 days first (today included), two
        « Périodes rapides » (frontend utils/dateRange.ts), dates typed = the test window."""
        t = self.today
        first = month_start(t)
        return {
            "30d": (t - timedelta(days=29), t),
            "previous-month": (months_back(first, 1), first - timedelta(days=1)),
            "previous-year": (date(t.year - 1, 1, 1), date(t.year - 1, 12, 31)),
            "custom": (self.df, self.dt),
        }

    def product_stats(self, p, df: date, dt: date) -> dict:
        """GET /products/{id}/stats?date_from&date_to: the period vs the days just before (same
        number); the last 12 months; every supplier of the period (most units first); each supplier's
        latest priced purchase (newest first); units sold / bought per month of every year with a sale
        or a purchase (newest first).
        CA = qty × PPV, marge = CA − units sold × average PU (every purchase)."""
        days = (dt - df).days + 1
        pf, pt = df - timedelta(days=days), df - timedelta(days=1)
        pu = self.pu_alltime.get(p.pid)
        sales = [v for v in self.ventes if v.p is p]
        buys = [a for a in self.achats if a.p is p]

        def figures(first: date, last: date) -> dict:
            lines = [v for v in sales if first <= v.day <= last]
            sold = sum(v.qty for v in lines)
            c = sum(ca(v) for v in lines)
            return {"sold": sold, "bought": sum(a.qty for a in buys if first <= a.day <= last), "ca": r2(c),
                    "marge": r2(c - sold * pu) if pu is not None else None,
                    "transactions": len({v.ref for v in lines})}

        months = [months_back(month_start(self.today), n) for n in range(11, -1, -1)]
        monthly = [{"month": m.isoformat()[:7], **{k: v for k, v in figures(m, next_month(m) - timedelta(days=1)).items()
                                                  if k != "transactions"}} for m in months]

        qty: dict[str, int] = defaultdict(int)
        for a in buys:
            if df <= a.day <= dt:
                qty[a.supplier] += a.qty
        total = sum(qty.values())
        ranked = sorted(qty.items(), key=lambda kv: (-kv[1], kv[0]))

        def share(supplier: str | None, q: float) -> dict:
            return {"supplier": supplier, "quantity": q, "pct": r2(q / total * 100) if total > 0 else None}

        last_prices, seen = [], set()
        for a in sorted((a for a in buys if a.qty > 0), key=lambda a: (a.day, a.seq), reverse=True):
            if a.supplier not in seen:
                seen.add(a.supplier)
                last_prices.append({"supplier": a.supplier, "unit_price": r4(a.unit), "date": a.day.isoformat()})
        return {
            "date_from": df.isoformat(), "date_to": dt.isoformat(),
            "previous_from": pf.isoformat(), "previous_to": pt.isoformat(),
            "period": figures(df, dt), "previous": figures(pf, pt),
            "monthly": monthly,
            "suppliers": [share(name, q) for name, q in ranked],
            "last_prices": last_prices,
            "history": [
                {"year": y, "sold": [float(sum(v.qty for v in sales if v.day.year == y and v.day.month == m))
                                     for m in range(1, 13)],
                 "total": float(sum(v.qty for v in sales if v.day.year == y)),
                 "ca": r2(sum(ca(v) for v in sales if v.day.year == y)),
                 "bought": [float(sum(a.qty for a in buys if a.day.year == y and a.day.month == m))
                            for m in range(1, 13)],
                 "bought_total": float(sum(a.qty for a in buys if a.day.year == y)),
                 "spent": r2(sum(a.total for a in buys if a.day.year == y))}
                for y in sorted({v.day.year for v in sales} | {a.day.year for a in buys}, reverse=True)
            ],
        }

    def product_movements(self, p, df: date | None = None, dt: date | None = None, kind: str = "all",
                          query: str | None = None, page: int = 1, order: str = "date") -> dict:
        """GET /products/{id}/movements (« Traçabilité »): purchase (+qty) and sale (−qty, with its
        remise) lines, newest day first (same day: sales, then purchases; then the latest line);
        order « kind » = purchases first, then sales, each newest first. Search = every word in the
        document or the supplier / client (accents ignored), 20 per page. A purchase also gives
        « Créée le », its hour when it is the BL's day, the lot expiry and stock min / max of the file
        (empty in the generated files). The import (date, who, file) is checked by the test."""
        lines = [{"day": a.day, "kind": "achat", "seq": a.seq, "quantity": a.qty, "unit_price": a.unit,
                  "total": a.total, "discount": None, "document": a.ref, "party": a.supplier,
                  "created_at": a.created,
                  "time": a.created[11:16] if a.created[:10] == a.day.isoformat() else None}
                 for a in self.achats if a.p is p]
        lines += [{"day": v.day, "kind": "vente", "seq": v.seq, "quantity": -v.qty, "unit_price": v.unit,
                   "total": v.total, "discount": v.discount, "document": v.ref, "party": v.client or None,
                   "created_at": None, "time": None}
                  for v in self.ventes if v.p is p]
        tokens = tokenize(query or "")
        keep = [m for m in lines
                if (df is None or m["day"] >= df) and (dt is None or m["day"] <= dt)
                and (kind == "all" or m["kind"] == kind)
                and all(token_match(m["document"], t, unaccent=True) or token_match(m["party"], t, unaccent=True)
                        for t in tokens)]
        keep.sort(key=lambda m: (m["day"], m["kind"], m["seq"]), reverse=True)
        if order == "kind":
            keep.sort(key=lambda m: m["kind"])  # stable: newest first inside each kind
        return {
            "total": len(keep),
            "page": [{"kind": m["kind"], "date": m["day"].isoformat(), "time": m["time"],
                      "created_at": m["created_at"], "quantity": m["quantity"], "unit_price": m["unit_price"],
                      "total": m["total"], "discount": m["discount"], "document": m["document"],
                      "party": m["party"], "expiry_date": None, "stock_min": None, "stock_max": None}
                     for m in keep[(page - 1) * 20:page * 20]],
        }

    def traced_product(self, rows: list[dict], by_pid: dict):
        """The product of the « Traçabilité » scenarios: the first row of the list (the best seller
        with big files) with a purchase, a sale to a named client and a 2nd page (more than 20 lines).
        Small files (1 000 lines): the best seller may have no purchase."""
        buys, sales, named = defaultdict(int), defaultdict(int), set()
        for a in self.achats:
            buys[a.p.pid] += 1
        for v in self.ventes:
            sales[v.p.pid] += 1
            if v.client:
                named.add(v.p.pid)
        pid = next((r["pid"] for r in rows
                    if buys[r["pid"]] and r["pid"] in named and buys[r["pid"]] + sales[r["pid"]] > 20),
                   None) or next(r["pid"] for r in rows if buys[r["pid"]] and r["pid"] in named)
        return by_pid[pid]

    def movements_scenarios(self, p) -> dict:
        """18-produits « Traçabilité » tab, best-selling product: no filter (pages 1 + 2), sorted by
        type, Achats, Ventes over the test window, search = the client of its latest sale with a client.
        « Voir détail » of its latest sale / purchase = every line of that ticket / BL (any product)."""
        client = next(v.client for v in sorted(self.ventes, key=lambda v: (v.day, v.seq), reverse=True)
                      if v.p is p and v.client)
        sale = max((v for v in self.ventes if v.p is p), key=lambda v: (v.day, v.seq))
        buy = max((a for a in self.achats if a.p is p), key=lambda a: (a.day, a.seq))
        return {
            "pid": p.pid, "client": client,
            "all": self.product_movements(p), "all_page2": self.product_movements(p, page=2),
            "by_kind": self.product_movements(p, order="kind"),
            "achats": self.product_movements(p, kind="achat"),
            "ventes_window": self.product_movements(p, self.df, self.dt, "vente"),
            "search": self.product_movements(p, query=client),
            "ticket": {"ref": sale.ref, "products": sorted(v.p.name for v in self.ventes if v.ref == sale.ref)},
            "bl": {"ref": buy.ref, "products": sorted(a.p.name for a in self.achats if a.ref == buy.ref)},
        }

    def sheet_pids(self, rows: list[dict], infos: dict[str, dict]) -> list[str]:
        """Products 18-produits opens: the 4 with scraped info, then one never bought (no PU),
        one not in the stock file, one stock-only (no line at all), one with a negative stock."""
        listed = {r["pid"] for r in rows}
        sold = {v.p.pid for v in self.ventes}
        bought = {a.p.pid for a in self.achats}
        picks = list(infos)
        for keep in (
            lambda p: p.pid in sold and p.pid not in bought,
            lambda p: p.stock is None,
            lambda p: p.pid not in sold and p.pid not in bought,
            lambda p: p.stock is not None and p.stock < 0,
        ):
            pid = next((p.pid for p in sorted(self.products, key=lambda p: p.name)
                        if p.pid in listed and p.pid not in picks and keep(p)), None)
            if pid:
                picks.append(pid)
        return picks

    def produits(self, photo_setup: dict) -> dict:
        infos = photo_setup["infos"]
        rows = self.products_list(infos)
        by_pid = {p.pid: p for p in self.products}
        barcode = photo_setup["barcode"]
        start, end = default_abcd_window(self.today)
        return {
            "sales_from": start.isoformat(), "sales_to": end.isoformat(), "rows": rows,
            "barcode_setup": barcode,
            # 15-imports deletes the stock import: only sold / bought products stay listed.
            "count_without_stock_file": sum(1 for r in rows if r["pid"] in {v.p.pid for v in self.ventes}
                                            | {a.p.pid for a in self.achats}),
            "sheets": {pid: self.product_sheet(by_pid[pid], infos.get(pid),
                                               barcode["barcode1"] if by_pid[pid].name == barcode["product"] else None)
                       for pid in self.sheet_pids(rows, infos)},
            # Statistiques: every period button, for every product the test opens.
            "stats": {pid: {k: self.product_stats(by_pid[pid], *r) for k, r in self.stats_periods().items()}
                      for pid in self.sheet_pids(rows, infos)},
            "movements": self.movements_scenarios(self.traced_product(rows, by_pid)),
            "search": {q: [r["pid"] for r in rows if all(product_match(by_pid[r["pid"]], t) for t in tokenize(q))]
                       for q in PRODUCT_QUERIES},
        }

    def peremptions(self) -> dict:
        b6, b12 = self.today + timedelta(days=180), self.today + timedelta(days=360)
        out = {k: {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []}
               for k in ("expired", "very_close", "close", "no_date")}
        for p in self.stocked:
            if p.stock <= 0:
                continue
            if p.expiry is None:
                key = "no_date"
            elif p.expiry < self.today:
                key = "expired"
            elif p.expiry < b6:
                key = "very_close"
            elif p.expiry < b12:
                key = "close"
            else:
                continue
            b = out[key]
            b["count"] += 1
            b["total_units"] += p.stock
            b["purchase_value"] += p.pph * p.stock
            b["sale_value"] += p.ppv * p.stock
            b["products"].append({"product": p.name, "expiry_date": p.expiry.isoformat() if p.expiry else None,
                                  "quantity": p.stock, "ppv": p.ppv})
        for b in out.values():
            b["purchase_value"], b["sale_value"] = r2(b["purchase_value"]), r2(b["sale_value"])
        return out

    # ── Ventes / Achats ledgers ─────────────────────────────────────────────

    def vente_row(self, v) -> dict:
        pu = self.pu_window.get(v.p.pid)
        return {
            "seq": v.seq, "date": v.day.isoformat(), "transaction_ref": v.ref,
            "transaction_ref_final": v.ref, "transaction_ref_color": None,
            "client": v.client or None, "pid": v.p.pid, "product": v.p.name,
            "category": v.p.category, "category_type": None, "tva": v.p.tva_label,
            "ppv": v.p.ppv, "quantity": v.qty, "discount": v.discount, "unit_price": v.unit,
            "subtotal": r4(v.p.ppv * v.qty * (1 - v.discount / 100)), "total": v.total,
            "avg_pu": r4(pu) if pu is not None else None,
        }

    def achat_row(self, a) -> dict:
        return {
            "seq": a.seq, "delivery_date": a.day.isoformat(), "delivery_ref": a.ref,
            "delivery_ref_final": a.ref, "delivery_ref_color": None, "supplier": a.supplier,
            "pid": a.p.pid, "product": a.p.name, "category": a.p.category, "category_type": None,
            "tva": a.p.tva_label, "quantity": a.qty, "pph": a.p.pph, "unit_price": a.unit,
            "total": a.total, "expiry_date": None,
        }

    def vente_search(self, v, tokens: list[str]) -> bool:
        return all(product_match(v.p, t) or token_match(v.client or None, t, unaccent=True)
                   or token_match(v.ref, t, unaccent=True) for t in tokens)

    def achat_search(self, a, tokens: list[str]) -> bool:
        return all(product_match(a.p, t) or token_match(a.supplier, t, unaccent=True)
                   or token_match(a.ref, t, unaccent=True) for t in tokens)

    def ledgers(self) -> dict:
        pus = self.pu_window

        def flags(v):
            pu = pus.get(v.p.pid)
            pct = (1 - pu / v.p.ppv) * 100 if pu is not None and v.p.ppv else None
            neg = pu is not None and pu > v.p.ppv
            low = pu is not None and v.p.ppv > 0 and pu <= v.p.ppv and pct < 10
            rem = v.discount > 20
            return neg, low, rem, neg or rem or (pct is not None and pct < 10)

        # `top_seq`: default list order (id desc = CSV line desc), first 50 rows
        # (pages 1–2 at 20 rows, and at 25 rows for the Comptabilité journal).
        def v_summary(rows):
            return {"rows_total": len(rows), "grand_total": r2(sum(v.total for v in rows)),
                    "tva_collected": r2(sum(v.total * v.p.tva / 100 for v in rows)),
                    "top_seq": [v.seq for v in sorted(rows, key=lambda v: v.seq, reverse=True)[:50]]}

        def a_summary(rows):
            return {"rows_total": len(rows), "grand_total": r2(sum(a.total for a in rows)),
                    "tva_payee": r2(sum(a.total * a.p.tva / 100 for a in rows)),
                    "top_seq": [a.seq for a in sorted(rows, key=lambda a: a.seq, reverse=True)[:50]]}

        fl = [flags(v) for v in self.vw]
        tabs = {"marge_negative": 0, "marge_low": 1, "remises_high": 2, "all_flagged": 3}
        disc = [v for v in self.vw if v.discount > 0]
        full = [v for v in self.vw if not v.discount > 0]
        is_gros = lambda a: is_grossiste(a.supplier)   # noqa: E731

        def v_suggest(q: str) -> dict:
            toks = tokenize(q)
            return {
                "products": sorted({v.p.name for v in self.ventes if all(product_match(v.p, t) for t in toks)}),
                "clients":  sorted({v.client for v in self.ventes if v.client and all(token_match(v.client, t, unaccent=True) for t in toks)}),
                "refs":     sorted({v.ref for v in self.ventes if all(token_match(v.ref, t, unaccent=True) for t in toks)}),
            }

        def a_suggest(q: str) -> dict:
            toks = tokenize(q)
            return {
                "products":  sorted({a.p.name for a in self.achats if all(product_match(a.p, t) for t in toks)}),
                "suppliers": sorted({a.supplier for a in self.achats if all(token_match(a.supplier, t, unaccent=True) for t in toks)}),
                "refs":      sorted({a.ref for a in self.achats if all(token_match(a.ref, t, unaccent=True) for t in toks)}),
            }

        return {
            "ventes_rows": [self.vente_row(v) for v in self.vw],
            "achats_rows": [self.achat_row(a) for a in self.aw],
            "ventes_list": v_summary(self.vw),
            "achats_list": a_summary(self.aw),
            "ventes_categories": sorted({strip_pct(v.p.category) for v in self.ventes}, key=str.lower),
            "achats_categories": sorted({strip_pct(a.p.category) for a in self.achats}, key=str.lower),
            "ventes_tva_rates": sorted({v.p.tva_label for v in self.ventes}),
            "achats_tva_rates": sorted({a.p.tva_label for a in self.achats}),
            "surveillance_counts": {"marge_negative": sum(f[0] for f in fl), "marge_low": sum(f[1] for f in fl),
                                    "remises_high": sum(f[2] for f in fl), "all_flagged": sum(f[3] for f in fl)},
            "surveillance_lists": {tab: v_summary([v for v, f in zip(self.vw, fl) if f[i]]) for tab, i in tabs.items()},
            "discount_summary": {side: {"total_mad": r2(sum(v.total for v in rows)),
                                        "unit_count": float(sum(v.qty for v in rows)), "count": len(rows)}
                                 for side, rows in (("discounted", disc), ("full_price", full))},
            "supplier_summary": {side: {"total_mad": r2(sum(a.total for a in rows)),
                                        "unit_count": float(sum(a.qty for a in rows)),
                                        "bl_count": len({a.ref for a in rows})}
                                 for side, rows in (("grossiste", [a for a in self.aw if is_gros(a)]),
                                                    ("direct_labo", [a for a in self.aw if not is_gros(a)]))},
            "search": {
                "ventes": {q: v_summary([v for v in self.vw if self.vente_search(v, tokenize(q))]) for q in VENTE_QUERIES},
                "achats": {q: a_summary([a for a in self.aw if self.achat_search(a, tokenize(q))]) for q in ACHAT_QUERIES},
            },
            "suggestions": {"ventes": {q: v_suggest(q) for q in VENTE_QUERIES},
                            "achats": {q: a_suggest(q) for q in ACHAT_QUERIES}},
        }

    # ── Analyses ────────────────────────────────────────────────────────────

    def units_available(self, ct: str, product: str | None = None) -> int | None:
        total = sum(p.stock for p in self.stocked if cat_ok(p, ct) and name_has(p, product))
        return round(total) if total else None

    def produit_rows(self, ct: str) -> list[dict]:
        prices: dict[str, dict] = {}
        for a in self.aw:
            if a.qty > 0:
                g = prices.setdefault(a.p.pid, {"num": 0.0, "den": 0.0, "max": a.unit, "min": a.unit})
                g["num"] += a.unit * a.qty
                g["den"] += a.qty
                g["max"], g["min"] = max(g["max"], a.unit), min(g["min"], a.unit)
        per: dict[str, dict] = {}
        for v in self.vw:
            if cat_ok(v.p, ct):
                r = per.setdefault(v.p.pid, {"p": v.p, "qty": 0.0, "ca": 0.0})
                r["qty"] += v.qty
                r["ca"] += ca(v)
        rows = []
        for pid, r in per.items():
            p, g = r["p"], prices.get(pid)
            ppv = float(p.ppv or 0)
            pu = g["num"] / g["den"] if g else 0.0
            prix_max, prix_min = (g["max"], g["min"]) if g else (0.0, 0.0)
            cost = g["num"] if g else None
            stock = p.stock
            marge_pct = r3((1 - pu / ppv) * 100) if ppv and pu else None
            marge_dh = r4(ppv - pu) if ppv and pu else None
            rows.append({
                "product": p.name, "category": strip_pct(p.category), "tva": p.tva_label or "—",
                "ppv": r4(ppv) if ppv else None, "pu": r4(pu) if pu else None,
                "prix_max": r4(prix_max), "prix_min": r4(prix_min), "prix_avg": r4(pu),
                "qty": r2(r["qty"]), "ca": r2(r["ca"]),
                "marge_pct": marge_pct, "marge_dh": marge_dh,
                "marge_pct_best":  r3((1 - prix_min / ppv) * 100) if ppv and prix_min else marge_pct,
                "marge_pct_worst": r3((1 - prix_max / ppv) * 100) if ppv and prix_max else marge_pct,
                "marge_dh_best":   r4(ppv - prix_min) if ppv and prix_min else marge_dh,
                "marge_dh_worst":  r4(ppv - prix_max) if ppv and prix_max else marge_dh,
                "stock_dispo": stock,
                "ppv_potentiel": r2(ppv * stock) if ppv > 0 and stock and stock > 0 else None,
                "total_achat_cost": r2(cost) if cost else None,
            })
        return rows

    def categorie_rows(self, ct: str) -> list[dict]:
        raw: dict[str, dict] = {}
        med_qty: dict[str, float] = defaultdict(float)
        for v in self.vw:
            if not cat_ok(v.p, ct):
                continue
            g = raw.setdefault(strip_pct(v.p.category), {"qty": 0.0, "ca": 0.0, "units": []})
            g["qty"] += v.qty
            g["ca"] += ca(v)
            g["units"].append(v.unit)
            med_qty[v.p.pid] += v.qty
        by_pid = {p.pid: p for p in self.products}
        margin: dict[str, dict] = {}
        for pid, qty in med_qty.items():
            p, pu = by_pid[pid], self.pu_window.get(pid)
            if pu is None:
                continue
            m = margin.setdefault(strip_pct(p.category), {"pct": 0.0, "dh": 0.0, "qty": 0.0})
            pct = (1 - pu / p.ppv) * 100 if p.ppv else 0
            m["pct"] += qty * pct
            m["dh"] += qty * (p.ppv - pu)
            m["qty"] += qty
        rows = []
        for category, g in raw.items():
            key = strip_pct(category)
            m = margin.get(key)
            tq = m["qty"] if m else 0
            rows.append({
                "category": key or "—",
                "prix_max": r4(max(g["units"])), "prix_min": r4(min(g["units"])), "prix_avg": r4(mean(g["units"])),
                "qty": r2(g["qty"]), "ca": r2(g["ca"]),
                "marge_pct_avg": r3(m["pct"] / tq) if m and tq else None,
                "marge_dh_avg": r2(m["dh"] / tq) if m and tq else None,
            })
        return rows

    def supplier_rows(self, is_grossiste: bool, key: str) -> list[dict]:
        """G3: a product bought from several suppliers shares its sales by units bought
        (60 from A + 40 from B, 100 sold → A 60, B 40)."""
        sub: dict[tuple[str, str], dict] = {}
        bought: dict[str, float] = defaultdict(float)
        for a in self.aw:
            if a.qty > 0:
                bought[a.p.pid] += a.qty
                if a.supplier.upper().startswith("GROSSISTE") == is_grossiste:
                    g = sub.setdefault((a.supplier, a.p.pid), {"num": 0.0, "den": 0.0})
                    g["num"] += a.unit * a.qty
                    g["den"] += a.qty
        ventes_by_pid: dict[str, list] = defaultdict(list)
        for v in self.vw:
            ventes_by_pid[v.p.pid].append(v)
        by_pid = {p.pid: p for p in self.products}
        rows: dict[str, dict] = {}
        cost: dict[str, float] = defaultdict(float)
        for (supplier, pid), g in sub.items():
            cost[supplier] += g["num"]
            vs = ventes_by_pid.get(pid, [])
            if not vs:
                continue
            r = rows.setdefault(supplier, {"qty": 0.0, "ca": 0.0, "units": [], "m_pct": 0.0, "m_dh": 0.0, "m_qty": 0.0})
            share = g["den"] / bought[pid]
            qty = sum(v.qty for v in vs) * share
            r["qty"] += qty
            r["ca"] += sum(ca(v) for v in vs) * share
            r["units"].extend(v.unit for v in vs)
            ppv, pu = by_pid[pid].ppv, g["num"] / g["den"]
            if ppv:
                r["m_pct"] += qty * (1 - pu / ppv) * 100
                r["m_dh"] += qty * (ppv - pu)
                r["m_qty"] += qty
        return [{
            key: s or "—",
            "prix_max": r4(max(r["units"])), "prix_min": r4(min(r["units"])), "prix_avg": r4(mean(r["units"])),
            "qty": r2(r["qty"]), "ca": r2(r["ca"]),
            "marge_pct_avg": r3(r["m_pct"] / r["m_qty"]) if r["m_qty"] else None,
            "marge_dh_avg": r2(r["m_dh"] / r["m_qty"]) if r["m_qty"] else None,
            "total_achat_cost": r2(cost[s]),
        } for s, r in rows.items()]

    def simple_rows(self, ct: str, mode: str, product: str | None = None) -> list[dict]:
        out: dict = {}
        for v in self.vw:
            if not cat_ok(v.p, ct) or not name_has(v.p, product):
                continue
            if mode == "annee":
                row = out.setdefault(v.day.year, {"annee": v.day.year, **{k: {"qty": 0.0, "ca": 0.0} for k in MONTH_KEYS},
                                                  "ca": 0.0, "qty": 0.0})
                cell = row[MONTH_KEYS[v.day.month - 1]]
                cell["qty"] += v.qty
                cell["ca"] += ca(v)
                row["ca"] += ca(v)
                row["qty"] += v.qty
                continue
            k = v.client or "Anonyme" if mode == "operateur" else v.day.strftime("%Y-%m")
            field = "client" if mode == "operateur" else "mois"
            row = out.setdefault(k, {field: k, "nb_transactions": 0, "qty": 0.0, "ca": 0.0})
            row["nb_transactions"] += 1
            row["qty"] += v.qty
            row["ca"] += ca(v)
        rows = list(out.values())
        for row in rows:
            row["qty"], row["ca"] = r2(row["qty"]), r2(row["ca"])
            if mode == "annee":
                for k in MONTH_KEYS:
                    row[k] = {"qty": r2(row[k]["qty"]), "ca": r2(row[k]["ca"])}
        if mode == "annee":
            rows.sort(key=lambda r: r["annee"], reverse=True)
        return rows

    @staticmethod
    def kpis_from_rows(rows: list[dict], total_ventes_dh: float, units_available) -> tuple[dict, dict]:
        """_compute_kpis. Returns (kpis, ties): `ties` lists the labels that tie
        for each best/worst pick and every possible difference_gain_dh (the
        app keeps the first tied row in SQL order, which is not fixed)."""
        k = {
            "total_ventes_dh": r2(total_ventes_dh),
            "total_ventes_unites": r2(sum(float(r.get("qty") or 0) for r in rows)),
            "total_units_available": units_available,
            "total_pu_purchased": None, "ppv_total_available": None,
            "marge_pct_avg": None, "marge_pct_min": None, "marge_pct_max": None,
            "marge_dh_avg": None, "marge_dh_min": None, "marge_dh_max": None, "difference_gain_dh": None,
        }
        cost = sum(float(r.get("total_achat_cost") or 0) for r in rows)
        pot = sum(float(r.get("ppv_potentiel") or 0) for r in rows)
        k["total_pu_purchased"] = r2(cost) if cost else None
        k["ppv_total_available"] = r2(pot) if pot else None
        ties: dict = {}
        marge_rows = [r for r in rows if r.get("marge_pct") is not None]
        avg_rows = [r for r in rows if r.get("marge_pct_avg") is not None]

        def pick(rs, fn, best: bool):
            val = (max if best else min)(fn(r) for r in rs)
            return val, [r for r in rs if fn(r) == val]

        if marge_rows:
            tq = sum(float(r["qty"] or 0) for r in marge_rows)
            if tq:
                s_ppv = sum(float(r["qty"] or 0) * float(r["ppv"] or 0) for r in marge_rows)
                s_pu = sum(float(r["qty"] or 0) * float(r["pu"] or 0) for r in marge_rows)
                k["marge_pct_avg"] = r3((1 - s_pu / s_ppv) * 100) if s_ppv else None
                k["marge_dh_avg"] = r2(sum(float(r["qty"] or 0) * float(r["marge_dh"] or 0) for r in marge_rows) / tq)
            fns = {
                "marge_pct_max": (lambda r: float(r.get("marge_pct_best") or r["marge_pct"]), True),
                "marge_pct_min": (lambda r: float(r.get("marge_pct_worst") or r["marge_pct"]), False),
                "marge_dh_max":  (lambda r: float(r.get("marge_dh_best") or r["marge_dh"]), True),
                "marge_dh_min":  (lambda r: float(r.get("marge_dh_worst") or r["marge_dh"]), False),
            }
            label, dh = "product", "marge_dh"
        elif avg_rows:
            label = next((c for c in ("category", "grossiste", "laboratoire") if c in avg_rows[0]), "category")
            tq = sum(float(r["qty"] or 0) for r in avg_rows)
            if tq:
                k["marge_pct_avg"] = r3(sum(float(r["qty"] or 0) * float(r["marge_pct_avg"] or 0) for r in avg_rows) / tq)
                k["marge_dh_avg"] = r2(sum(float(r["qty"] or 0) * float(r["marge_dh_avg"] or 0) for r in avg_rows) / tq)
            fns = {
                "marge_pct_max": (lambda r: r["marge_pct_avg"], True),
                "marge_pct_min": (lambda r: r["marge_pct_avg"], False),
                "marge_dh_max":  (lambda r: r["marge_dh_avg"], True),
                "marge_dh_min":  (lambda r: r["marge_dh_avg"], False),
            }
            marge_rows, dh = avg_rows, "marge_dh_avg"
        else:
            return k, ties

        picked = {}
        for name, (fn, best) in fns.items():
            val, tied = pick(marge_rows, fn, best)
            k[name] = {"value": val}
            ties[name] = [{"label": r[label], "qty": r["qty"]} for r in tied]
            picked[name] = tied
        ties["difference_gain_dh"] = sorted({
            r2(float(b["qty"] or 0) * float(b[dh] or 0) - float(w["qty"] or 0) * float(w[dh] or 0))
            for b, w in cartesian(picked["marge_dh_max"], picked["marge_dh_min"])
        })
        return k, ties

    def analyse(self, ct: str, mode: str, product: str | None = None) -> dict:
        """`product` = année-mode search box (ILIKE %product% on the product name)."""
        if mode == "produit":
            rows = self.produit_rows(ct)
        elif mode == "categorie":
            rows = self.categorie_rows(ct)
        elif mode == "grossiste":
            rows = self.supplier_rows(True, "grossiste")
        elif mode == "laboratoire":
            rows = self.supplier_rows(False, "laboratoire")
        else:
            rows = self.simple_rows(ct, mode, product)
        total = sum(ca(v) for v in self.vw if cat_ok(v.p, ct) and name_has(v.p, product))
        kpis, ties = self.kpis_from_rows(rows, total, self.units_available(ct, product))
        return {"rows": rows, "kpis": kpis, "ties": ties}

    def analyse_search(self, q: str) -> dict:
        """/analyses search box on Produit × Mixte — all in the browser: rows where every
        token matches the product OR the category (matchesFields), KPIs recomputed from
        those rows (computeKpisFromRows), suggestions = product names matching."""
        toks, all_rows = tokenize(q), self.produit_rows("all")
        hit = lambda r, fields: all(any(token_match(r[f], t, unaccent=True) for f in fields) for t in toks)
        rows = [r for r in all_rows if hit(r, ("product", "category"))]
        units = sum(float(r["stock_dispo"] or 0) for r in rows)
        kpis, ties = self.kpis_from_rows(rows, sum(r["ca"] for r in rows), r2(units) if units else None)
        return {"rows": rows, "kpis": kpis, "ties": ties,
                "suggestions": sorted({r["product"] for r in all_rows if hit(r, ("product",))})}

    def liste(self, items: list[dict], ct: str = "all") -> dict:
        """compute_analyse_liste (items = what parseListeCsv sends). `ct` filters the
        sales rows; a matched product with no row in it still shows as a 0-sales stub."""
        norm_inputs: dict[str, str] = {}
        item_by_norm: dict[str, dict] = {}
        for it in items:
            name = (it.get("name") or "").strip()
            if name:
                n = strip_accents(name.lower())
                norm_inputs[n], item_by_norm[n] = name, it
        lookup = {strip_accents(p.name.strip().lower()): p for p in self.products}
        by_pid = {p.pid: p for p in self.products}
        matched: dict[str, object] = {}
        unmatched: list[str] = []
        for n, original in norm_inputs.items():
            found = lookup.get(n)
            if found is None:
                found = next((p for dbn, p in lookup.items() if n in dbn or dbn in n), None)
            it = item_by_norm.get(n)
            if found is None and it and it.get("pid"):
                found = by_pid.get(str(it["pid"]).strip())
            if found is None:
                unmatched.append(original)
            else:
                matched[found.pid] = found
        matched_norms = {strip_accents(p.name.strip().lower()) for p in matched.values()}
        rows, covered = [], set()
        for row in self.produit_rows(ct):
            n = strip_accents(row["product"].strip().lower())
            if n in matched_norms or any(n == k or n in k or k in n for k in norm_inputs):
                rows.append({**row, "match_status": "found"})
                covered.add(n)
        for p in matched.values():
            if strip_accents(p.name.strip().lower()) in covered:
                continue
            stock = p.stock
            rows.append({
                "product": p.name, "category": strip_pct(p.category), "tva": p.tva_label,
                "ppv": r4(p.ppv) if p.ppv else None, "pu": None, "prix_max": None, "prix_min": None,
                "prix_avg": None, "qty": 0, "ca": 0, "marge_pct": None, "marge_dh": None,
                "stock_dispo": stock, "ppv_potentiel": r2(p.ppv * stock) if p.ppv and stock else None,
                "total_achat_cost": None, "match_status": "found",
            })
        for name in unmatched:
            rows.append({"product": name, "match_status": "not_found", "category": None, "tva": None,
                         "ppv": None, "pu": None, "prix_max": None, "prix_min": None, "prix_avg": None,
                         "qty": 0, "ca": 0, "marge_pct": None, "marge_dh": None, "stock_dispo": None,
                         "ppv_potentiel": None, "total_achat_cost": None})
        found = [r for r in rows if r["match_status"] == "found"]
        k = {
            "total_ventes_dh": r2(sum(float(r.get("ca") or 0) for r in found)),
            "total_ventes_unites": r2(sum(float(r.get("qty") or 0) for r in found)),
        }
        units = sum(float(r.get("stock_dispo") or 0) for r in found)
        cost = sum(float(r.get("total_achat_cost") or 0) for r in found)
        pot = sum(float(r.get("ppv_potentiel") or 0) for r in found)
        k.update({"total_units_available": r2(units) if units else None,
                  "total_pu_purchased": r2(cost) if cost else None,
                  "ppv_total_available": r2(pot) if pot else None,
                  "marge_pct_avg": None, "marge_pct_min": None, "marge_pct_max": None,
                  "marge_dh_avg": None, "marge_dh_min": None, "marge_dh_max": None, "difference_gain_dh": None})
        ties: dict = {}
        mr = [r for r in found if r.get("marge_pct") is not None]
        if mr:
            tq = sum(float(r["qty"] or 0) for r in mr)
            if tq:
                k["marge_pct_avg"] = r3(sum(float(r["qty"] or 0) * float(r["marge_pct"] or 0) for r in mr) / tq)
                k["marge_dh_avg"] = r2(sum(float(r["qty"] or 0) * float(r["marge_dh"] or 0) for r in mr) / tq)
            picked = {}
            for name, field, best in (("marge_pct_max", "marge_pct", True), ("marge_pct_min", "marge_pct", False),
                                      ("marge_dh_max", "marge_dh", True), ("marge_dh_min", "marge_dh", False)):
                val = (max if best else min)(float(r[field]) for r in mr)
                tied = [r for r in mr if float(r[field]) == val]
                k[name] = {"value": val}
                ties[name] = [{"label": r["product"], "qty": r["qty"]} for r in tied]
                picked[name] = tied
            ties["difference_gain_dh"] = sorted({
                r2(float(b["qty"] or 0) * float(b["marge_dh"] or 0) - float(w["qty"] or 0) * float(w["marge_dh"] or 0))
                for b, w in cartesian(picked["marge_dh_max"], picked["marge_dh_min"])
            })
        return {"rows": rows, "kpis": k, "ties": ties}

    # ── Produits spéciaux → Comptabilité ────────────────────────────────────

    def unique_query(self, p) -> str | None:
        """`PRODUIT 00123` when it finds p alone. Barcodes count too
        (the special-products + BL searches in routers/exclusions.py use them): `00012` is inside
        6119000000123, so low numbers are skipped."""
        q = f"PRODUIT {p.name.rsplit(' ', 1)[1]}"
        toks = tokenize(q)
        hits = [x for x in self.products
                if all(product_match(x, t) or token_match(x.barcode, t, unaccent=False) for t in toks)]
        return q if hits == [p] else None

    def exclusion_scenario(self) -> dict:
        """1 special product + 1 BL (found by one of its products) + 1 supplier.
        Comptabilité (include_non_declared=false) drops them med-level
        (exclusions.excluded_medicaments_select): the product, EVERY product on the
        BL and EVERY product of the supplier leave ventes AND achats. Its /stats
        is the plain oracle run on what is left."""
        by_ref: dict[str, list] = defaultdict(list)
        for a in self.achats:
            by_ref[a.ref].append(a)

        def bl(ref: str) -> dict:
            lines = by_ref[ref]
            return {"delivery_ref": ref, "supplier": max(a.supplier for a in lines),
                    "delivery_date": max(a.day for a in lines).isoformat(),
                    "total": r2(sum(a.total for a in lines)), "nb_lines": len(lines)}

        def bl_summary(ref: str, matched: list[str]) -> dict:
            return {**bl(ref), "nb_products": len({a.p.pid for a in by_ref[ref]}),
                    "already_excluded": False, "matched_products": matched}

        def supplier(name: str) -> dict:
            lines = [a for a in self.achats if a.supplier == name]
            return {"supplier": name, "total": r2(sum(a.total for a in lines)), "nb_lines": len(lines),
                    "nb_products": len({a.p.pid for a in lines}),
                    "last_date": max(a.day for a in lines).isoformat(), "already_excluded": False}

        # BL: first grossiste BL of the window holding a product findable alone by name.
        ref, holder = next((a.ref, a.p) for a in self.aw if is_grossiste(a.supplier) and self.unique_query(a.p))
        bl_pids = {a.p.pid for a in by_ref[ref]}
        holder_refs = sorted({a.ref for a in self.achats if a.p.pid == holder.pid})

        # Special product: sold + bought, not on that BL, not from the excluded supplier.
        sold = {v.p.pid for v in self.ventes}
        bought = {a.p.pid for a in self.achats}
        from_supplier = {a.p.pid for a in self.achats if a.supplier == EXCLUDED_SUPPLIER}
        special = next(p for p in self.products
                       if p.pid in sold and p.pid in bought and p.pid not in bl_pids
                       and p.pid not in from_supplier and self.unique_query(p))

        suppliers = sorted({a.supplier for a in self.achats})
        excluded = {special.pid} | bl_pids | from_supplier
        compta = Oracle(self.products, [v for v in self.ventes if v.p.pid not in excluded],
                        [a for a in self.achats if a.p.pid not in excluded], self.today, self.df, self.dt)
        return {
            "special": {
                "query": self.unique_query(special), "pid": special.pid, "product": special.name,
                "category": special.category,
                "suggestions": [{"pid": special.pid, "product": special.name, "category": special.category,
                                 "nb_ventes": sum(1 for v in self.ventes if v.p.pid == special.pid)}],
            },
            "bl": {
                "ref": ref, "query": self.unique_query(holder),
                "search": [bl_summary(r, [holder.name]) for r in holder_refs],
                "search_by_ref": [bl_summary(ref, [])],
                "detail": {**bl(ref), "lines": [{"pid": a.p.pid, "product": a.p.name, "quantity": a.qty,
                                                 "unit_price": a.unit, "total": a.total} for a in by_ref[ref]]},
            },
            "supplier": {
                "name": EXCLUDED_SUPPLIER, "query": SUPPLIER_QUERY,
                "search": [supplier(s) for s in suppliers
                           if all(token_match(s, t, unaccent=True) for t in tokenize(SUPPLIER_QUERY))],
                "search_grossiste": sorted((supplier(s) for s in suppliers if is_grossiste(s)),
                                           key=lambda r: r["total"], reverse=True),
            },
            "excluded_pids": sorted(excluded),
            "stats": {ct: compta.stats(ct) for ct in CATEGORY_TYPES},
        }

    # ── Everything ──────────────────────────────────────────────────────────

    def build(self, liste_items: list[dict], photo_setup: dict) -> dict:
        return {
            "window": {"date_from": self.df.isoformat(), "date_to": self.dt.isoformat()},
            "stats": {ct: self.stats(ct) for ct in CATEGORY_TYPES},
            "margin_alerts": {ct: self.margin_alerts(ct) for ct in CATEGORY_TYPES},
            "ventes_sans_achat": {ct: self.ventes_sans_achat(ct) for ct in CATEGORY_TYPES},
            "stock_summary": self.stock_summary(),
            "stock_abcd_default": self.stock_abcd(*default_abcd_window(self.today)),
            "stock_abcd_window": self.stock_abcd(self.df, self.dt),
            "peremptions": self.peremptions(),
            "products": self.produits(photo_setup),
            **self.ledgers(),
            "analyse": {ct: {mode: self.analyse(ct, mode) for mode in ANALYSE_MODES} for ct in CATEGORY_TYPES},
            "liste": {"items": liste_items, **self.liste(liste_items)},
            "liste_ct": {ct: self.liste(liste_items, ct) for ct in ("pharmacie", "parapharmacie")},
            "analyse_search": {q: self.analyse_search(q) for q in ANALYSE_QUERIES},
            "analyse_annee_product": {"q": ANNEE_PRODUCT, **self.analyse("all", "annee", ANNEE_PRODUCT)},
            "exclusions": self.exclusion_scenario(),
        }
