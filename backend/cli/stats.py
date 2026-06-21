"""Stats / Rapport category. Owner endpoints (/v1/stats*) + admin variants
(/v1/admin/stats, /v1/admin/pharmacies, /v1/admin/pharmacy/{id}/stats*)."""
from __future__ import annotations

from typing import Callable

import questionary

from ._client import request
from ._output import print_request, print_response, success, warn


BACK = "__BACK__"

EP_STATS           = "/stats"
EP_MARGIN_ALERTS   = "/stats/margin-alerts"
EP_STOCK_SUMMARY   = "/stats/stock-summary"
EP_ADMIN_STATS     = "/admin/stats"
EP_ADMIN_PHARMS    = "/admin/pharmacies"


def _call(params: dict | None = None) -> None:
    """Single helper — formats the query string, prints request+response, summarizes."""
    qs = ""
    if params:
        qs = "?" + "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
    print_request("GET", EP_STATS + qs)
    resp = request("GET", EP_STATS, params=params or None)
    print_response(resp)
    if resp.status_code != 200:
        return
    d = resp.json()
    success(
        f"ventes_total = {d['kpis']['ventes_total']:>15,.2f} MAD  "
        f"({d['kpis']['ventes_count']:,} ventes)\n"
        f"achats_total = {d['kpis']['achats_total']:>15,.2f} MAD  "
        f"({d['kpis']['achats_count']:,} achats)\n"
        f"marge_pct    = {d['marge']['marge_pct']}%  "
        f"(brute {d['marge']['marge_brute_dh']:,.2f}, nette {d['marge']['marge_nette_dh']:,.2f} DH)\n"
        f"prev_kpis    = ventes {d['previous_kpis']['ventes_total']:,.2f}, "
        f"marge {d['previous_kpis']['marge_pct']}%\n"
        f"type_breakdown : "
        f"pharmacie {d['type_breakdown']['pharmacie']['ventes_total']:,.0f} / "
        f"parapharmacie {d['type_breakdown']['parapharmacie']['ventes_total']:,.0f}\n"
        f"monthly_trend  : {len(d['monthly_trend'])} points  "
        f"(first {d['monthly_trend'][0]['month'] if d['monthly_trend'] else 'n/a'})\n"
        f"top_categories : {len(d['top_categories'])}  "
        f"(top 3: {[c['category'] for c in d['top_categories'][:3]]})\n"
        f"ticket_moyen   : {d['advanced_kpis']['ticket_moyen']:,.2f} MAD"
    )


def _all_periods() -> None:
    """No date filter, no category filter — full history."""
    _call({"category_type": "all"})


def _date_window() -> None:
    """Pick a window via two text prompts (YYYY-MM-DD)."""
    df = questionary.text("date_from (YYYY-MM-DD, blank for none)").ask()
    if df is None: return
    dt = questionary.text("date_to (YYYY-MM-DD, blank for none)").ask()
    if dt is None: return
    params = {"category_type": "all"}
    if df.strip(): params["date_from"] = df.strip()
    if dt.strip(): params["date_to"]   = dt.strip()
    _call(params)


def _last_full_year() -> None:
    """Quick shortcut: 2025 full year, no other filters."""
    _call({"date_from": "2025-01-01", "date_to": "2025-12-31", "category_type": "all"})


def _category_picker() -> None:
    """Pick a category_type via arrow keys; optional date window."""
    ct = questionary.select(
        "category_type?",
        choices=[
            questionary.Choice("all (Mixte)",        value="all"),
            questionary.Choice("pharmacie (Ph)",     value="pharmacie"),
            questionary.Choice("parapharmacie (Pa)", value="parapharmacie"),
            questionary.Choice("← Cancel",      value=BACK),
        ],
    ).ask()
    if ct is None or ct == BACK: return
    df = questionary.text("date_from (YYYY-MM-DD, blank for none)").ask() or ""
    dt = questionary.text("date_to (YYYY-MM-DD, blank for none)").ask() or ""
    params = {"category_type": ct}
    if df.strip(): params["date_from"] = df.strip()
    if dt.strip(): params["date_to"]   = dt.strip()
    _call(params)


def _include_non_declared() -> None:
    """Same as _all_periods but with include_non_declared=true."""
    _call({"category_type": "all", "include_non_declared": "true"})


def _admin_should_403() -> None:
    """If you logged in as admin (admin@gmail.com), /stats should refuse."""
    warn("This call expects you to be logged in as admin. Owners get 200.")
    _call({"category_type": "all"})


# ─── Margin alerts + stock summary (owner endpoints) ─────────────────────────

def _margin_alerts() -> None:
    """4-bracket margin breakdown for Rapport Section 5."""
    print_request("GET", EP_MARGIN_ALERTS)
    resp = request("GET", EP_MARGIN_ALERTS)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        for key in ("negative", "low", "medium", "high", "very_high"):
            b = d[key]
            success(
                f"{key:>10}: {b['count']:>5} produits  "
                f"CA={b['total_ca']:>15,.0f}  marge_dh={b['total_margin_dh']:>15,.0f}"
            )


def _stock_summary() -> None:
    """4-tile stock health summary for Rapport Section 8."""
    print_request("GET", EP_STOCK_SUMMARY)
    resp = request("GET", EP_STOCK_SUMMARY)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        success(
            f"total_references = {d['total_references']:,}\n"
            f"ppv_potentiel    = {d['ppv_potentiel']:,.2f} MAD en stock\n"
            f"sous_stock       = {d['sous_stock_count']:,} produits\n"
            f"sur_stock        = {d['sur_stock_count']:,} produits\n"
            f"in_band (idéal)  = {d['in_band_count']:,} produits\n"
            f"health_pct       = {d['health_pct']}%"
        )


# ─── Admin endpoints (log in as admin first) ──────────────────────────────────

def _admin_stats() -> None:
    """System-wide tile counts."""
    print_request("GET", EP_ADMIN_STATS)
    resp = request("GET", EP_ADMIN_STATS)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        success(
            f"pharmacies={d['total_pharmacies']}  "
            f"active_users={d['total_active_users']}  "
            f"catalog_items={d['total_catalog_items']:,}  "
            f"pending={d['pending_catalog_requests']}"
        )


def _admin_pharmacies() -> None:
    """List pharmacies for the picker dropdown."""
    print_request("GET", EP_ADMIN_PHARMS)
    resp = request("GET", EP_ADMIN_PHARMS)
    print_response(resp)
    if resp.status_code == 200:
        rows = resp.json()
        warn(f"{len(rows)} pharmacie(s):")
        for p in rows:
            print(f"  id={p['id']:>4}  code={p['code']:<10}  name={p['name']}")


def _admin_pharm_stats() -> None:
    """Drill-down: admin views /v1/stats for a target pharmacy."""
    pharm_id = questionary.text("Pharmacy id (use /admin/pharmacies to list)").ask()
    if not pharm_id: return
    ep = f"/admin/pharmacy/{pharm_id.strip()}/stats"
    print_request("GET", ep)
    resp = request("GET", ep)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        success(
            f"ventes_total = {d['kpis']['ventes_total']:,.2f}  "
            f"marge_pct = {d['marge']['marge_pct']}%  "
            f"ticket_moyen = {d['advanced_kpis']['ticket_moyen']:,.2f}"
        )


def _admin_pharm_margin_alerts() -> None:
    pharm_id = questionary.text("Pharmacy id").ask()
    if not pharm_id: return
    ep = f"/admin/pharmacy/{pharm_id.strip()}/stats/margin-alerts"
    print_request("GET", ep)
    resp = request("GET", ep)
    print_response(resp)


def _admin_pharm_stock_summary() -> None:
    pharm_id = questionary.text("Pharmacy id").ask()
    if not pharm_id: return
    ep = f"/admin/pharmacy/{pharm_id.strip()}/stats/stock-summary"
    print_request("GET", ep)
    resp = request("GET", ep)
    print_response(resp)


ENDPOINTS: list[tuple[str, Callable[[], None]]] = [
    # Owner — /v1/stats variants
    ("GET  /stats (no filters, full history)",              _all_periods),
    ("GET  /stats (2025 full year, no category)",           _last_full_year),
    ("GET  /stats (custom date window)",                    _date_window),
    ("GET  /stats (pick category_type + optional dates)",   _category_picker),
    ("GET  /stats (include non-declared products)",         _include_non_declared),
    ("GET  /stats (admin should 403 — only owners)",        _admin_should_403),
    # Owner — Rapport Sections 5 + 8
    ("GET  /stats/margin-alerts (4 brackets)",              _margin_alerts),
    ("GET  /stats/stock-summary (4 tiles)",                 _stock_summary),
    # Admin
    ("ADMIN GET  /admin/stats (Vue système — 4 tiles)",     _admin_stats),
    ("ADMIN GET  /admin/pharmacies (picker dropdown)",      _admin_pharmacies),
    ("ADMIN GET  /admin/pharmacy/{id}/stats",               _admin_pharm_stats),
    ("ADMIN GET  /admin/pharmacy/{id}/stats/margin-alerts", _admin_pharm_margin_alerts),
    ("ADMIN GET  /admin/pharmacy/{id}/stats/stock-summary", _admin_pharm_stock_summary),
]


def run() -> None:
    """Stats submenu loop. Returns to main menu on Back."""
    while True:
        choices = [questionary.Choice(label, value=fn) for label, fn in ENDPOINTS]
        choices.append(questionary.Choice("← Back", value=BACK))
        pick = questionary.select("Stats · pick an endpoint", choices=choices).ask()
        if pick is None or pick == BACK:
            return
        pick()