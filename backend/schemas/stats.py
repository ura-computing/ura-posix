from enum import Enum
from typing import Any

from pydantic import BaseModel


# These mirror the JSON the frontend consumes. Floats not Decimal — we don't need
# bank-grade precision in the dashboard, and JSON serialisation is cleaner.

class StatsKpis(BaseModel):
    ventes_total: float
    achats_total: float
    ventes_count: int
    achats_count: int


class PreviousKpis(BaseModel):
    ventes_total: float
    achats_total: float
    marge_pct:    float


class DayPoint(BaseModel):
    date:  str
    total: float


class DayCount(BaseModel):
    date:  str
    count: int


class AdvancedKpis(BaseModel):
    ticket_moyen:           float
    vente_moyenne_par_jour: float
    best_day_dh:     DayPoint | None
    worst_day_dh:    DayPoint | None
    best_day_count:  DayCount | None
    worst_day_count: DayCount | None


class TvaSummary(BaseModel):
    tva_encaissee:  float
    tva_payee:      float
    tva_a_declarer: float


class MargeSummary(BaseModel):
    marge_pct:      float
    marge_brute_dh: float
    marge_nette_dh: float


class TypeBreakdownEntry(BaseModel):
    ventes_total: float


class TypeBreakdown(BaseModel):
    pharmacie:     TypeBreakdownEntry
    parapharmacie: TypeBreakdownEntry


class MonthlyTrendPoint(BaseModel):
    month:  str           # YYYY-MM
    ventes: float
    achats: float


class TopCategoryRow(BaseModel):
    category:  str
    total:     float
    marge_pct: float | None


class StatsResponse(BaseModel):
    kpis:           StatsKpis
    previous_kpis:  PreviousKpis
    advanced_kpis:  AdvancedKpis
    tva:            TvaSummary
    marge:          MargeSummary
    type_breakdown: TypeBreakdown
    monthly_trend:  list[MonthlyTrendPoint]
    top_categories: list[TopCategoryRow]


# ── Margin alerts ─────────────────────────────────────────────────────────────

class MarginAlertProduct(BaseModel):
    product:   str
    marge_pct: float
    ca:        float


class MarginAlertBracket(BaseModel):
    count:           int
    total_ca:        float
    total_margin_dh: float
    products:        list[MarginAlertProduct]


class MarginAlertsResponse(BaseModel):
    negative:  MarginAlertBracket
    low:       MarginAlertBracket
    medium:    MarginAlertBracket
    high:      MarginAlertBracket
    very_high: MarginAlertBracket


# ── Stock summary ─────────────────────────────────────────────────────────────

class StockSummaryResponse(BaseModel):
    total_references: int
    ppv_potentiel:    float
    sous_stock_count: int
    sur_stock_count:  int
    in_band_count:    int
    health_pct:       float


# ── Admin: system tiles + pharmacy picker ─────────────────────────────────────

class AdminStatsResponse(BaseModel):
    total_pharmacies:         int
    total_active_users:       int
    total_catalog_items:      int
    pending_catalog_requests: int   # always 0 until the catalog-request feature ships


class AdminPharmacyRow(BaseModel):
    id:   int
    name: str
    code: str | None


# ── Stock — ABCD analysis + filtered product list (Page 6) ──────────────────

class StockRow(BaseModel):
    product:         str
    category:        str        # A | A- | B+ | B | C | C- | C-N | D
    units_sold_12m:  int
    stock_min:       int        # round(ventes_12m / 300 × 14)
    stock_max:       int        # round(ventes_12m / 300 × 15)
    current_stock:   int | None
    ppv:             float | None
    avg_pu:          float | None
    status:          str        # sous-stock | ideal | a-surveiller | sur-stock | inconnu | negatif


class StockAbcdResponse(BaseModel):
    distribution:    dict[str, int]    # class → count (non-zero only)
    total_references: int
    ppv_potentiel:   float
    products:        list[StockRow]


# ── Peremptions — 3 mutually-exclusive expiry-proximity buckets ─────────────

class PeremptionProduct(BaseModel):
    product:     str
    expiry_date: str
    quantity:    int
    ppv:         float


class PeremptionBracket(BaseModel):
    count:          int
    total_units:    int
    purchase_value: float
    sale_value:     float
    products:       list[PeremptionProduct]


class PeremptionsResponse(BaseModel):
    """Tightened pharmacy-ops horizon. NULL-expiry products are silently
    skipped (Sobrus sometimes omits the date)."""
    expired: PeremptionBracket    # expiry_date < today
    near_2w: PeremptionBracket    # today ≤ expiry_date ≤ today + 14d
    near_1m: PeremptionBracket    # today + 14d < expiry_date ≤ today + 30d


# ── Analyse de marge — 8 modes (Page 11) ─────────────────────────────────────
# Wide-row shape: every mode's columns are optional fields on the same row type.
# Frontend renders only the columns relevant to the active mode (via per-mode column configs).

class MargeMode(str, Enum):
    PRODUIT     = "produit"
    CATEGORIE   = "categorie"
    LABORATOIRE = "laboratoire"
    GROSSISTE   = "grossiste"
    OPERATEUR   = "operateur"
    MOIS        = "mois"
    ANNEE       = "annee"
    LISTE       = "liste"


class MargeKpiPoint(BaseModel):
    label: str
    value: float
    qty:   float


class AnalyseMargeKpis(BaseModel):
    total_ventes_dh:       float
    total_ventes_unites:   float
    total_units_available: float | None = None      # produit-only
    total_pu_purchased:    float | None = None      # produit-only (Σ achat cost)
    ppv_total_available:   float | None = None      # produit-only (Σ PPV × stock)
    marge_pct_avg:         float | None = None
    marge_pct_min:         MargeKpiPoint | None = None
    marge_pct_max:         MargeKpiPoint | None = None
    marge_dh_avg:          float | None = None
    marge_dh_min:          MargeKpiPoint | None = None
    marge_dh_max:          MargeKpiPoint | None = None
    difference_gain_dh:    float | None = None      # Optimisation gauge value


class AnalyseMargeResponse(BaseModel):
    mode:  MargeMode
    kpis:  AnalyseMargeKpis
    # Wide-row dicts: every mode's column set is a subset of this. Front-end picks per mode.
    rows:  list[dict[str, Any]]


class ListeItem(BaseModel):
    name:     str
    pid:      str | None = None
    barcode1: str | None = None
    barcode2: str | None = None


class ListeRequest(BaseModel):
    items:         list[ListeItem] = []
    date_from:     str | None = None
    date_to:       str | None = None
    category_type: str = "all"