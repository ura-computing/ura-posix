from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, CatalogRequest, Medicament, Pharmacy, PharmacyMedicamentStatus, User, Vente
from routers.auth import get_current_user
from utils.constants import Role, Status
from .excel import _build_excel
from .marge import _compute_analyse_marge, _compute_margin_alerts
from .stock import _compute_stock_abcd
from .peremptions import _compute_peremptions
from .queries import (
    _compute_extra_stats,
    _fetch_med_rows,
    _merge_top_categories,
    _pharma_expr,
    build_monthly_trend,
    compute_previous_kpis,
)

router = APIRouter(tags=["stats"])


@router.get("/stats")
def get_stats(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    include_non_declared: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/stats")

    pharmacy_id = current_user.pharmacy_id
    df = date_from or None
    dt = date_to or None

    cat_filter_v: list = []
    cat_filter_a: list = []
    if category_type == "pharmacie":
        cat_filter_v = [_pharma_expr() == True]
        cat_filter_a = [_pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter_v = [_pharma_expr() == False]
        cat_filter_a = [_pharma_expr() == False]

    non_declared_sub = None
    if pharmacy_id and not include_non_declared:
        non_declared_sub = (
            db.query(PharmacyMedicamentStatus.medicament_id)
            .filter(
                PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                PharmacyMedicamentStatus.declared == False,
            )
            .subquery()
        )

    # Ventes total uses PPV (catalog sale price), achats total uses Achat.total (PU × qty)
    vq = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)), func.count(Vente.id))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    aq = db.query(func.sum(Achat.total), func.count(Achat.id))
    if cat_filter_v:
        vq = vq.filter(*cat_filter_v)
    if cat_filter_a:
        aq = aq.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
    if pharmacy_id:
        vq = vq.filter(Vente.pharmacy_id == pharmacy_id)
        aq = aq.filter(Achat.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        vq = vq.filter(Vente.medicament_id.notin_(non_declared_sub))
        aq = aq.filter(Achat.medicament_id.notin_(non_declared_sub))
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)
    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()

    monthly_trend = build_monthly_trend(db, pharmacy_id, df, dt, non_declared_sub, cat_filter_v, cat_filter_a)

    # Weighted avg purchase price per medicament (from Achat)
    _avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("pu"),
        )
        .filter(Achat.quantity > 0, Achat.unit_price.isnot(None))
    )
    if pharmacy_id:
        _avg_pu_sub = _avg_pu_sub.filter(Achat.pharmacy_id == pharmacy_id)
    _avg_pu_sub = _avg_pu_sub.group_by(Achat.medicament_id).subquery()

    cat_q = (
        db.query(
            Medicament.category.label("category"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("total"),
            func.sum(Vente.quantity).label("qty"),
            func.avg(func.coalesce(_avg_pu_sub.c.pu, Medicament.pph)).label("avg_pu"),
            func.avg(Medicament.ppv).label("avg_ppv"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .outerjoin(_avg_pu_sub, Medicament.id == _avg_pu_sub.c.medicament_id)
        .filter(Medicament.category.isnot(None))
    )
    if cat_filter_v:
        cat_q = cat_q.filter(*cat_filter_v)
    if pharmacy_id:
        cat_q = cat_q.filter(Vente.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        cat_q = cat_q.filter(Vente.medicament_id.notin_(non_declared_sub))
    if df:
        cat_q = cat_q.filter(Vente.date >= df)
    if dt:
        cat_q = cat_q.filter(Vente.date <= dt)
    top_categories = _merge_top_categories(cat_q.group_by(Medicament.category).all())

    extra = _compute_extra_stats(db, pharmacy_id, df, dt, category_type)

    previous_kpis = compute_previous_kpis(
        db, pharmacy_id, df, dt, cat_filter_v, cat_filter_a, non_declared_sub
    )

    return {
        "kpis": {
            "ventes_total": float(ventes_total or 0),
            "achats_total": float(achats_total or 0),
            "ventes_count": ventes_count or 0,
            "achats_count": achats_count or 0,
        },
        "previous_kpis": previous_kpis,
        **extra,
        "monthly_trend": monthly_trend,
        "top_categories": top_categories,
    }


@router.get("/stats/analyse-marge")
def stats_analyse_marge(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    mode: str = Query("produit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/pharmacy/{id}/stats/analyse-marge")
    return _compute_analyse_marge(
        db, current_user.pharmacy_id, date_from or None, date_to or None, category_type, mode
    )


class ListeItem(BaseModel):
    name: Optional[str] = None
    pid: Optional[str] = None
    barcode1: Optional[str] = None
    barcode2: Optional[str] = None


class ListeRequest(BaseModel):
    items: Optional[List[ListeItem]] = None
    products: Optional[List[str]] = None  # legacy
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    category_type: str = "all"


def _sanitize_barcode(s: Optional[str]) -> Optional[str]:
    """Keep digit-only strings of length >= 8. Reject Excel-mangled garbage like '8,47E+12'."""
    if not s:
        return None
    cleaned = "".join(ch for ch in str(s) if ch.isdigit())
    return cleaned if len(cleaned) >= 8 else None


@router.post("/stats/analyse-liste")
def stats_analyse_liste(
    body: ListeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Match a list of products (by name → barcode1 → barcode2) against the pharmacy's data."""
    from utils.strings import strip_accents

    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Non disponible pour les admins")

    pharmacy_id = current_user.pharmacy_id
    if not pharmacy_id:
        raise HTTPException(status_code=400, detail="Pas de pharmacie associée")

    # Build the canonical input list
    if body.items is not None:
        items = body.items
    elif body.products:
        items = [ListeItem(name=p) for p in body.products]
    else:
        items = []

    # Normalized inputs keyed by name; track original + barcodes per entry
    normalized_inputs: dict[str, str] = {}
    item_by_norm: dict[str, ListeItem] = {}
    barcode_inputs: list[tuple[ListeItem, list[str]]] = []  # (item, sanitized_barcodes)
    for it in items:
        name = (it.name or "").strip()
        bcs = [b for b in (_sanitize_barcode(it.barcode1), _sanitize_barcode(it.barcode2)) if b]
        if name:
            norm = strip_accents(name.lower())
            normalized_inputs[norm] = name
            item_by_norm[norm] = it
        if bcs and not name:
            # Anonymous-by-barcode: still need a placeholder display name
            barcode_inputs.append((it, bcs))
        elif bcs:
            barcode_inputs.append((it, bcs))

    if not normalized_inputs and not barcode_inputs:
        return {"kpis": {}, "rows": []}

    # Pool = the entire medicament catalog. A product can be matched even if this
    # pharmacy has no Vente/Achat/PharmacyStock yet — we'll synthesize a stub row.
    med_rows = (
        db.query(Medicament.id, Medicament.product, Medicament.pid,
                 Medicament.barcode1, Medicament.barcode2,
                 Medicament.category, Medicament.tva, Medicament.ppv, Medicament.pph)
        .all()
    )

    matched_ids = set()
    matched_names = {}  # med_id -> original CSV name
    unmatched = []

    med_lookup = {strip_accents((m.product or "").strip().lower()): m for m in med_rows}

    # Build PID → med and barcode → med lookups
    pid_to_med: dict[str, object] = {}
    barcode_to_med: dict[str, object] = {}
    for m in med_rows:
        if m.pid:
            pid_to_med[str(m.pid).strip()] = m
        for bc in (_sanitize_barcode(m.barcode1), _sanitize_barcode(m.barcode2)):
            if bc:
                barcode_to_med[bc] = m

    matched_norms: set[str] = set()
    for norm_name, original_name in normalized_inputs.items():
        found = False
        # 1. Exact normalized name match
        if norm_name in med_lookup:
            m = med_lookup[norm_name]
            matched_ids.add(m.id)
            matched_names[m.id] = original_name
            found = True
        else:
            # 2. Substring match (CSV name contains DB name or vice versa)
            for db_norm, m in med_lookup.items():
                if norm_name in db_norm or db_norm in norm_name:
                    matched_ids.add(m.id)
                    matched_names[m.id] = original_name
                    found = True
                    break
        it = item_by_norm.get(norm_name)
        if not found and it:
            # 3. PID fallback
            if it.pid and str(it.pid).strip() in pid_to_med:
                m = pid_to_med[str(it.pid).strip()]
                matched_ids.add(m.id)
                matched_names[m.id] = original_name
                found = True
            else:
                # 4. Barcode fallback for this row
                for bc in (_sanitize_barcode(it.barcode1), _sanitize_barcode(it.barcode2)):
                    if bc and bc in barcode_to_med:
                        m = barcode_to_med[bc]
                        matched_ids.add(m.id)
                        matched_names[m.id] = original_name
                        found = True
                        break
        if found:
            matched_norms.add(norm_name)
        else:
            unmatched.append(original_name)

    # Run produit mode analysis but filtered to matched IDs only
    result = _compute_analyse_marge(
        db, pharmacy_id,
        body.date_from, body.date_to,
        body.category_type, "produit",
    )

    # Build a set of normalized names + map for matched meds (incl. barcode-only matches)
    matched_norms_db: set[str] = set()
    matched_meds_by_id: dict[int, object] = {}
    for m in med_rows:
        if m.id in matched_ids:
            matched_norms_db.add(strip_accents((m.product or "").strip().lower()))
            matched_meds_by_id[m.id] = m

    # Filter rows to only matched products + collect which med_ids were covered
    matched_rows = []
    covered_norms: set[str] = set()
    for row in result.get("rows", []):
        product_name = row.get("product", "")
        norm = strip_accents(product_name.strip().lower())
        if norm in matched_norms_db or any(norm == k or norm in k or k in norm for k in normalized_inputs):
            row["match_status"] = "found"
            matched_rows.append(row)
            covered_norms.add(norm)

    # Synthesize rows for matched stock-only products (no Vente → not in result.rows).
    # Pull stock figures directly from PharmacyStock.
    uncovered_meds = [m for m in matched_meds_by_id.values()
                      if strip_accents((m.product or "").strip().lower()) not in covered_norms]
    if uncovered_meds:
        from models import PharmacyStock as _PS2
        stock_map = dict(
            db.query(_PS2.medicament_id, _PS2.current_stock)
            .filter(_PS2.pharmacy_id == pharmacy_id, _PS2.medicament_id.in_([m.id for m in uncovered_meds]))
            .all()
        )
        for m in uncovered_meds:
            stock_dispo = stock_map.get(m.id)
            ppv = float(m.ppv or 0)
            ppv_potentiel = round(ppv * stock_dispo, 2) if ppv and stock_dispo else None
            matched_rows.append({
                "product": m.product or "—",
                "category": (m.category or "").replace(" (", " (") if m.category else None,
                "tva": m.tva,
                "ppv": round(ppv, 4) if ppv else None,
                "pu": None,
                "prix_max": None, "prix_min": None, "prix_avg": None,
                "qty": 0, "ca": 0,
                "marge_pct": None, "marge_dh": None,
                "stock_dispo": stock_dispo,
                "ppv_potentiel": ppv_potentiel,
                "total_achat_cost": None,
                "match_status": "found",
            })

    # Add unmatched products
    for name in unmatched:
        matched_rows.append({
            "product": name,
            "match_status": "not_found",
            "category": None, "tva": None, "ppv": None, "pu": None,
            "prix_max": None, "prix_min": None, "prix_avg": None,
            "qty": 0, "ca": 0, "marge_pct": None, "marge_dh": None,
            "stock_dispo": None, "ppv_potentiel": None, "total_achat_cost": None,
        })

    # Recompute KPIs from matched rows only (not global)
    found_rows = [r for r in matched_rows if r.get("match_status") == "found"]
    total_ventes_dh = sum(float(r.get("ca") or 0) for r in found_rows)
    total_ventes_unites = sum(float(r.get("qty") or 0) for r in found_rows)
    total_units_available = sum(float(r.get("stock_dispo") or 0) for r in found_rows)
    total_pu_purchased = sum(float(r.get("total_achat_cost") or 0) for r in found_rows)
    ppv_total_available = sum(float(r.get("ppv_potentiel") or 0) for r in found_rows)

    marge_rows = [r for r in found_rows if r.get("marge_pct") is not None]
    kpis = {
        "total_ventes_dh": round(total_ventes_dh, 2),
        "total_ventes_unites": round(total_ventes_unites, 2),
        "total_units_available": round(total_units_available, 2),
        "total_pu_purchased": round(total_pu_purchased, 2),
        "ppv_total_available": round(ppv_total_available, 2),
        "marge_pct_avg": None, "marge_pct_min": None, "marge_pct_max": None,
        "marge_dh_avg": None, "marge_dh_min": None, "marge_dh_max": None,
        "difference_gain_dh": None,
    }
    if marge_rows:
        total_qty = sum(float(r["qty"] or 0) for r in marge_rows)
        if total_qty:
            kpis["marge_pct_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_pct"] or 0) for r in marge_rows) / total_qty, 2)
            kpis["marge_dh_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_dh"] or 0) for r in marge_rows) / total_qty, 2)
        best_pct_key = "marge_pct_best" if "marge_pct_best" in marge_rows[0] else "marge_pct"
        worst_pct_key = "marge_pct_worst" if "marge_pct_worst" in marge_rows[0] else "marge_pct"
        best_dh_key = "marge_dh_best" if "marge_dh_best" in marge_rows[0] else "marge_dh"
        worst_dh_key = "marge_dh_worst" if "marge_dh_worst" in marge_rows[0] else "marge_dh"
        best_pct = max(marge_rows, key=lambda r: float(r.get(best_pct_key) or r["marge_pct"]))
        worst_pct = min(marge_rows, key=lambda r: float(r.get(worst_pct_key) or r["marge_pct"]))
        best_dh = max(marge_rows, key=lambda r: float(r.get(best_dh_key) or r["marge_dh"]))
        worst_dh = min(marge_rows, key=lambda r: float(r.get(worst_dh_key) or r["marge_dh"]))
        kpis["marge_pct_max"] = {"label": best_pct["product"], "value": float(best_pct.get(best_pct_key) or best_pct["marge_pct"]), "qty": best_pct["qty"]}
        kpis["marge_pct_min"] = {"label": worst_pct["product"], "value": float(worst_pct.get(worst_pct_key) or worst_pct["marge_pct"]), "qty": worst_pct["qty"]}
        kpis["marge_dh_max"] = {"label": best_dh["product"], "value": float(best_dh.get(best_dh_key) or best_dh["marge_dh"]), "qty": best_dh["qty"]}
        kpis["marge_dh_min"] = {"label": worst_dh["product"], "value": float(worst_dh.get(worst_dh_key) or worst_dh["marge_dh"]), "qty": worst_dh["qty"]}

    return {"kpis": kpis, "rows": matched_rows}


@router.get("/stats/margin-alerts")
def stats_margin_alerts(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/pharmacy/{id}/stats/margin-alerts")
    return _compute_margin_alerts(
        db, current_user.pharmacy_id, date_from or None, date_to or None, category_type
    )


@router.get("/stats/stock-abcd")
def stats_stock_abcd(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    class_filter: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/pharmacy/{id}/stats/stock-abcd")
    if not current_user.pharmacy_id:
        raise HTTPException(status_code=400, detail="Aucune pharmacie associée")
    return _compute_stock_abcd(
        db, current_user.pharmacy_id, date_from or None, date_to or None,
        class_filter=class_filter, status=status, search=search,
        sort_by=sort_by, sort_order=sort_order,
    )


@router.get("/stats/peremptions")
def stats_peremptions(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/pharmacy/{id}/stats/peremptions")
    if not current_user.pharmacy_id:
        raise HTTPException(status_code=400, detail="Aucune pharmacie associée")
    return _compute_peremptions(
        db, current_user.pharmacy_id, date_from or None, date_to or None
    )


def _compute_excel_section(db, pharmacy_id, df, dt, cat_type: str, nd_sub) -> dict:
    """Compute (kpis, extra, med_rows) for one category section.

    cat_type ∈ {"pharmacie", "parapharmacie", "all"}.
    """
    cat_filter = (
        [_pharma_expr() == True]  if cat_type == "pharmacie"
        else [_pharma_expr() == False] if cat_type == "parapharmacie"
        else None
    )

    vq = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)), func.count(Vente.id))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    aq = (
        db.query(func.sum(Achat.total), func.count(Achat.id))
        .join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
    )
    if cat_filter:
        vq = vq.filter(*cat_filter)
        aq = aq.filter(*cat_filter)
    if pharmacy_id:
        vq = vq.filter(Vente.pharmacy_id == pharmacy_id)
        aq = aq.filter(Achat.pharmacy_id == pharmacy_id)
    if nd_sub is not None:
        vq = vq.filter(Vente.medicament_id.notin_(nd_sub))
        aq = aq.filter(Achat.medicament_id.notin_(nd_sub))
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)
    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()

    return {
        "kpis": {
            "ventes_total": float(ventes_total or 0),
            "achats_total": float(achats_total or 0),
            "ventes_count": ventes_count or 0,
            "achats_count": achats_count or 0,
        },
        "extra": _compute_extra_stats(db, pharmacy_id, df, dt, cat_type),
        "med_rows": _fetch_med_rows(db, pharmacy_id, df, dt, cat_filter, non_declared_sub=nd_sub),
    }


@router.get("/stats/export-excel")
def export_stats_excel(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    include_non_declared: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/pharmacy/{id}/stats/export-excel")

    df, dt = date_from or None, date_to or None
    pharmacy_id = current_user.pharmacy_id

    nd_sub = None
    if pharmacy_id and not include_non_declared:
        nd_sub = (
            db.query(PharmacyMedicamentStatus.medicament_id)
            .filter(
                PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                PharmacyMedicamentStatus.declared == False,
            )
            .subquery()
        )

    titles = {"all": "Rapport Analytique", "pharmacie": "Rapport Pharmacie", "parapharmacie": "Rapport Parapharmacie"}
    title = titles.get(category_type, "Rapport Analytique")
    period = f"{df or 'Toutes dates'} → {dt or 'aujourd\'hui'}"

    # Mixte → two sections (Pharmacie + Parapharmacie); single category → one.
    if category_type == "all":
        sections = [
            {"name": "Pharmacie",    **_compute_excel_section(db, pharmacy_id, df, dt, "pharmacie", nd_sub)},
            {"name": "Parapharmacie", **_compute_excel_section(db, pharmacy_id, df, dt, "parapharmacie", nd_sub)},
        ]
    else:
        sections = [{"name": category_type.capitalize(), **_compute_excel_section(db, pharmacy_id, df, dt, category_type, nd_sub)}]

    buf = _build_excel(title, period, sections)
    filename = f"rapport_{category_type}_{df or 'all'}_{dt or 'all'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/admin/pharmacy/{pharmacy_id}/stats")
def get_pharmacy_stats_for_admin(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")

    df = date_from or None
    dt = date_to or None

    cat_filter_v: list = []
    cat_filter_a: list = []
    if category_type == "pharmacie":
        cat_filter_v = [_pharma_expr() == True]
        cat_filter_a = [_pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter_v = [_pharma_expr() == False]
        cat_filter_a = [_pharma_expr() == False]

    non_declared_sub = (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .subquery()
    )

    vq = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)), func.count(Vente.id))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    aq = db.query(func.sum(Achat.total), func.count(Achat.id))
    if cat_filter_v:
        vq = vq.filter(*cat_filter_v)
    if cat_filter_a:
        aq = aq.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
    vq = vq.filter(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id.notin_(non_declared_sub))
    aq = aq.filter(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id.notin_(non_declared_sub))
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)
    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()

    monthly_trend = build_monthly_trend(db, pharmacy_id, df, dt, non_declared_sub, cat_filter_v, cat_filter_a)

    _avg_pu_sub2 = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("pu"),
        )
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.quantity > 0, Achat.unit_price.isnot(None))
        .group_by(Achat.medicament_id)
        .subquery()
    )
    cat_q = (
        db.query(
            Medicament.category.label("category"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("total"),
            func.sum(Vente.quantity).label("qty"),
            func.avg(func.coalesce(_avg_pu_sub2.c.pu, Medicament.pph)).label("avg_pu"),
            func.avg(Medicament.ppv).label("avg_ppv"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .outerjoin(_avg_pu_sub2, Medicament.id == _avg_pu_sub2.c.medicament_id)
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Medicament.category.isnot(None),
            Vente.medicament_id.notin_(non_declared_sub),
        )
    )
    if cat_filter_v:
        cat_q = cat_q.filter(*cat_filter_v)
    if df:
        cat_q = cat_q.filter(Vente.date >= df)
    if dt:
        cat_q = cat_q.filter(Vente.date <= dt)
    top_categories = _merge_top_categories(cat_q.group_by(Medicament.category).all())

    extra = _compute_extra_stats(db, pharmacy_id, df, dt, category_type)

    previous_kpis = compute_previous_kpis(
        db, pharmacy_id, df, dt, cat_filter_v, cat_filter_a, non_declared_sub
    )

    return {
        "kpis": {
            "ventes_total": float(ventes_total or 0),
            "achats_total": float(achats_total or 0),
            "ventes_count": ventes_count or 0,
            "achats_count": achats_count or 0,
        },
        "previous_kpis": previous_kpis,
        **extra,
        "monthly_trend": monthly_trend,
        "top_categories": top_categories,
    }


@router.get("/admin/pharmacy/{pharmacy_id}/stats/export-excel")
def export_pharmacy_stats_excel(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")

    df, dt = date_from or None, date_to or None

    nd_sub = (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .subquery()
    )

    titles = {"all": "Rapport Analytique", "pharmacie": "Rapport Pharmacie", "parapharmacie": "Rapport Parapharmacie"}
    title = titles.get(category_type, "Rapport Analytique")
    period = f"{df or 'Toutes dates'} → {dt or 'aujourd\'hui'}"

    if category_type == "all":
        sections = [
            {"name": "Pharmacie",    **_compute_excel_section(db, pharmacy_id, df, dt, "pharmacie", nd_sub)},
            {"name": "Parapharmacie", **_compute_excel_section(db, pharmacy_id, df, dt, "parapharmacie", nd_sub)},
        ]
    else:
        sections = [{"name": category_type.capitalize(), **_compute_excel_section(db, pharmacy_id, df, dt, category_type, nd_sub)}]

    buf = _build_excel(title, period, sections)
    filename = f"rapport_pharmacie{pharmacy_id}_{category_type}_{df or 'all'}_{dt or 'all'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/admin/pharmacy/{pharmacy_id}/stats/analyse-marge")
def admin_analyse_marge(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    mode: str = Query("produit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return _compute_analyse_marge(
        db, pharmacy_id, date_from or None, date_to or None, category_type, mode
    )


@router.get("/admin/pharmacy/{pharmacy_id}/stats/margin-alerts")
def admin_margin_alerts(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return _compute_margin_alerts(
        db, pharmacy_id, date_from or None, date_to or None, category_type
    )


@router.get("/admin/pharmacy/{pharmacy_id}/stats/stock-abcd")
def admin_stock_abcd(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    class_filter: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return _compute_stock_abcd(
        db, pharmacy_id, date_from or None, date_to or None,
        class_filter=class_filter, status=status, search=search,
        sort_by=sort_by, sort_order=sort_order,
    )


@router.get("/admin/pharmacy/{pharmacy_id}/stats/peremptions")
def admin_peremptions(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return _compute_peremptions(
        db, pharmacy_id, date_from or None, date_to or None
    )


@router.get("/admin/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")

    total_pharmacies = db.query(func.count(Pharmacy.id)).scalar() or 0
    total_active_users = db.query(func.count(User.id)).filter(User.status == Status.ACTIVE).scalar() or 0
    total_catalog_items = db.query(func.count(Medicament.id)).scalar() or 0
    pending_catalog_requests = (
        db.query(func.count(CatalogRequest.id))
        .filter(CatalogRequest.status == Status.PENDING)
        .scalar() or 0
    )

    return {
        "total_pharmacies": total_pharmacies,
        "total_active_users": total_active_users,
        "total_catalog_items": total_catalog_items,
        "pending_catalog_requests": pending_catalog_requests,
    }


@router.get("/stats/products")
def list_my_products(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return distinct products available in this pharmacy's achats/ventes."""
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent les endpoints spécifiques à la pharmacie")

    pharmacy_id = current_user.pharmacy_id
    if not pharmacy_id:
        return []

    vente_ids = db.query(Vente.medicament_id).filter(
        Vente.pharmacy_id == pharmacy_id,
        Vente.medicament_id.isnot(None),
    ).distinct()
    achat_ids = db.query(Achat.medicament_id).filter(
        Achat.pharmacy_id == pharmacy_id,
        Achat.medicament_id.isnot(None),
    ).distinct()
    med_ids = {r[0] for r in vente_ids.all()} | {r[0] for r in achat_ids.all()}

    from sqlalchemy import or_
    from utils.strings import tokenize_search
    from utils.search import product_search_clauses

    tokens = tokenize_search(search)
    q = db.query(Medicament).filter(Medicament.id.in_(med_ids))
    # Each token must match: product/pid/barcode/fuzzy OR a medicament
    # whose achat supplier name contains the token (so typing "Cantabria"
    # returns products bought from Cantabria).
    for tok, base_clause in zip(tokens, product_search_clauses(tokens)):
        supplier_med_ids = {
            r[0]
            for r in db.query(Achat.medicament_id)
            .filter(
                Achat.pharmacy_id == pharmacy_id,
                Achat.medicament_id.isnot(None),
                Achat.supplier.ilike(f"%{tok}%"),
            )
            .distinct()
            .all()
        }
        if supplier_med_ids:
            q = q.filter(or_(base_clause, Medicament.id.in_(supplier_med_ids)))
        else:
            q = q.filter(base_clause)

    meds = q.order_by(Medicament.product).limit(50).all()

    non_declared_ids = {
        r[0] for r in db.query(PharmacyMedicamentStatus.medicament_id).filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        ).all()
    }

    return [
        {
            "medicament_id": m.id,
            "product": m.product,
            "category": m.category,
            "declared": m.id not in non_declared_ids,
        }
        for m in meds
    ]
