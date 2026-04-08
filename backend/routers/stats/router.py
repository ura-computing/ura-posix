from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
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
    if pharmacy_id:
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

    monthly_trend = build_monthly_trend(db, pharmacy_id, df, dt, non_declared_sub)

    cat_q = (
        db.query(
            Medicament.category.label("category"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("total"),
            func.sum(Vente.quantity).label("qty"),
            func.avg(Vente.unit_price).label("avg_pu"),
            func.avg(Medicament.ppv).label("avg_ppv"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/pharmacy/{id}/stats/stock-abcd")
    if not current_user.pharmacy_id:
        raise HTTPException(status_code=400, detail="Aucune pharmacie associée")
    return _compute_stock_abcd(
        db, current_user.pharmacy_id, date_from or None, date_to or None
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


@router.get("/stats/export-excel")
def export_stats_excel(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent /admin/pharmacy/{id}/stats/export-excel")

    df, dt = date_from or None, date_to or None
    pharmacy_id = current_user.pharmacy_id

    nd_sub = None
    if pharmacy_id:
        nd_sub = (
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

    extra = _compute_extra_stats(db, pharmacy_id, df, dt, category_type)

    titles = {"all": "Rapport Analytique", "pharmacie": "Rapport Pharmacie", "parapharmacie": "Rapport Parapharmacie"}
    title = titles.get(category_type, "Rapport Analytique")
    period = f"{df or 'Toutes dates'} → {dt or 'aujourd\'hui'}"
    kpis = {
        "ventes_total": float(ventes_total or 0),
        "achats_total": float(achats_total or 0),
        "ventes_count": ventes_count or 0,
        "achats_count": achats_count or 0,
    }

    cat_filter = ([_pharma_expr() == True] if category_type == "pharmacie"
                  else [_pharma_expr() == False] if category_type == "parapharmacie"
                  else None)
    med_rows = _fetch_med_rows(db, pharmacy_id, df, dt, cat_filter, non_declared_sub=nd_sub)
    buf = _build_excel(title, period, kpis, extra, med_rows)
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

    monthly_trend = build_monthly_trend(db, pharmacy_id, df, dt, non_declared_sub)

    cat_q = (
        db.query(
            Medicament.category.label("category"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("total"),
            func.sum(Vente.quantity).label("qty"),
            func.avg(Vente.unit_price).label("avg_pu"),
            func.avg(Medicament.ppv).label("avg_ppv"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
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

    vq = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)), func.count(Vente.id))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id.notin_(nd_sub))
    )
    aq = db.query(func.sum(Achat.total), func.count(Achat.id)).filter(
        Achat.pharmacy_id == pharmacy_id,
        Achat.medicament_id.notin_(nd_sub),
    )
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)
    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()

    extra = _compute_extra_stats(db, pharmacy_id, df, dt, category_type)

    titles = {"all": "Rapport Analytique", "pharmacie": "Rapport Pharmacie", "parapharmacie": "Rapport Parapharmacie"}
    title = titles.get(category_type, "Rapport Analytique")
    period = f"{df or 'Toutes dates'} → {dt or 'aujourd\'hui'}"
    kpis = {
        "ventes_total": float(ventes_total or 0),
        "achats_total": float(achats_total or 0),
        "ventes_count": ventes_count or 0,
        "achats_count": achats_count or 0,
    }

    cat_filter = ([_pharma_expr() == True] if category_type == "pharmacie"
                  else [_pharma_expr() == False] if category_type == "parapharmacie"
                  else None)
    med_rows = _fetch_med_rows(db, pharmacy_id, df, dt, cat_filter, non_declared_sub=nd_sub)
    buf = _build_excel(title, period, kpis, extra, med_rows)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return _compute_stock_abcd(
        db, pharmacy_id, date_from or None, date_to or None
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

    q = db.query(Medicament).filter(Medicament.id.in_(med_ids))
    if search:
        q = q.filter(Medicament.product.ilike(f"%{search}%"))

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
