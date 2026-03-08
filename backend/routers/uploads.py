import csv
import io
from typing import Any

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, Medicament, User, Vente
from routers.auth import get_current_user

router = APIRouter(prefix="/uploads", tags=["uploads"])

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Cannot decode file encoding")


def _parse_float(val: str) -> float | None:
    if not val or not val.strip():
        return None
    try:
        return float(val.strip().replace(",", "."))
    except ValueError:
        return None


def _parse_csv(content: bytes) -> list[dict]:
    text = _decode(content)
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    return [
        {k.strip().strip('"'): v.strip().strip('"') for k, v in row.items()}
        for row in reader
        if any(v.strip() for v in row.values())
    ]


def _upsert_medicament(db: Session, pid: str, product: str, tva: str | None,
                        pph: float | None, ppv: float | None,
                        category: str | None, zone: str | None) -> Medicament:
    # 1. Try exact Sobrus PID match
    med = db.query(Medicament).filter(Medicament.pid == pid).first()
    if not med:
        # 2. Fall back to name match — claim the catalog entry and stamp it with the Sobrus pid
        name = (product or "").strip()
        if name:
            med = db.query(Medicament).filter(
                Medicament.product.ilike(name)
            ).first()
        if med:
            med.pid = pid  # claim: barcode/name pid → Sobrus pid
        else:
            med = Medicament(pid=pid, product=product, tva=tva, pph=pph,
                             ppv=ppv, category=category, zone=zone)
            db.add(med)
            db.flush()
            return med
    # Update only fields that improve on what's already stored
    if tva:
        med.tva = tva
    if pph is not None:
        med.pph = pph
    if ppv is not None:
        med.ppv = ppv
    # Never overwrite category from CSV — catalog is source of truth
    if category and not med.category:
        med.category = category
    if zone:
        med.zone = zone
    db.flush()
    return med


def _insert_achats(db: Session, rows: list[dict[str, Any]]) -> dict:
    # Pre-load existing (delivery_ref, medicament_id) pairs to skip duplicates
    incoming_refs = {
        (row.get("Référence de livraison") or "").strip()
        for row in rows
        if (row.get("Référence de livraison") or "").strip()
    }
    existing_pairs: set[tuple[str, int]] = set()
    if incoming_refs:
        existing_pairs = {
            (a.delivery_ref, a.medicament_id)
            for a in db.query(Achat.delivery_ref, Achat.medicament_id)
                       .filter(Achat.delivery_ref.in_(incoming_refs))
                       .all()
        }

    achats = []
    skipped = 0
    for row in rows:
        pid = (row.get("PID") or "").strip()
        if not pid:
            continue
        med = _upsert_medicament(
            db,
            pid=pid,
            product=row.get("Produit", ""),
            tva=row.get("TVA") or None,
            pph=_parse_float(str(row.get("PPH", ""))),
            ppv=_parse_float(str(row.get("PPV", ""))),
            category=row.get("Catégorie") or None,
            zone=row.get("Zone") or None,
        )
        delivery_ref = (row.get("Référence de livraison") or "").strip() or None
        if delivery_ref and (delivery_ref, med.id) in existing_pairs:
            skipped += 1
            continue
        achats.append(Achat(
            medicament_id=med.id,
            created_at_source=row.get("Créée le") or None,
            delivery_date=row.get("Date Bon de Livraison") or None,
            delivery_ref=delivery_ref,
            supplier=row.get("Fournisseur") or None,
            quantity=_parse_float(str(row.get("Quantité", ""))),
            unit_price=_parse_float(str(row.get("Prix unitaire", ""))),
            expiry_date=row.get("Date de péremption") or None,
            stock_min=_parse_float(str(row.get("Stock min", ""))),
            stock_max=_parse_float(str(row.get("Stock max", ""))),
            total=_parse_float(str(row.get("Total", ""))),
        ))
    db.bulk_save_objects(achats)
    db.commit()
    return {"inserted": len(achats), "skipped": skipped}


def _insert_ventes(db: Session, rows: list[dict[str, Any]]) -> dict:
    # Pre-load existing (transaction_ref, medicament_id) pairs to skip duplicates
    incoming_refs = {
        (row.get("Numéro de transaction") or "").strip()
        for row in rows
        if (row.get("Numéro de transaction") or "").strip()
    }
    existing_pairs: set[tuple[str, int]] = set()
    if incoming_refs:
        existing_pairs = {
            (v.transaction_ref, v.medicament_id)
            for v in db.query(Vente.transaction_ref, Vente.medicament_id)
                       .filter(Vente.transaction_ref.in_(incoming_refs))
                       .all()
        }

    ventes = []
    skipped = 0
    for row in rows:
        pid = (row.get("PID") or "").strip()
        if not pid:
            continue
        med = _upsert_medicament(
            db,
            pid=pid,
            product=row.get("Produit", ""),
            tva=row.get("TVA") or None,
            pph=_parse_float(str(row.get("PPH", ""))),
            ppv=_parse_float(str(row.get("PPV", ""))),
            category=row.get("Catégorie") or None,
            zone=row.get("Zone") or None,
        )
        transaction_ref = (row.get("Numéro de transaction") or "").strip() or None
        if transaction_ref and (transaction_ref, med.id) in existing_pairs:
            skipped += 1
            continue
        ventes.append(Vente(
            medicament_id=med.id,
            date=row.get("Date") or None,
            transaction_ref=transaction_ref,
            client=row.get("Client") or None,
            quantity=_parse_float(str(row.get("Quantité", ""))),
            discount=_parse_float(str(row.get("Remise", ""))),
            unit_price=_parse_float(str(row.get("Prix unitaire", ""))),
            total=_parse_float(str(row.get("Total", ""))),
        ))
    db.bulk_save_objects(ventes)
    db.commit()
    return {"inserted": len(ventes), "skipped": skipped}


# ─── Pydantic models ──────────────────────────────────────────────────────────

class TableUpload(BaseModel):
    rows: list[dict[str, Any]]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/achat")
async def upload_achat(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    rows = _parse_csv(await file.read())
    if not rows:
        raise HTTPException(status_code=400, detail="No data found in file")
    return _insert_achats(db, rows)


@router.post("/achat-json")
async def upload_achat_json(
    body: TableUpload,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not body.rows:
        raise HTTPException(status_code=400, detail="No rows provided")
    return _insert_achats(db, body.rows)


@router.post("/vente")
async def upload_vente(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    rows = _parse_csv(await file.read())
    if not rows:
        raise HTTPException(status_code=400, detail="No data found in file")
    return _insert_ventes(db, rows)


@router.post("/vente-json")
async def upload_vente_json(
    body: TableUpload,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not body.rows:
        raise HTTPException(status_code=400, detail="No rows provided")
    return _insert_ventes(db, body.rows)


@router.post("/catalog")
async def upload_catalog(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Import the LISTING sheet from the XLSM accounting file as the medicament catalog.
    Clears all existing medicaments (and cascades to achats/ventes) then re-imports."""
    if not file.filename or not file.filename.lower().endswith(".xlsm"):
        raise HTTPException(status_code=400, detail="Only .xlsm files are accepted")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, keep_vba=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Cannot open Excel file")

    if "LISTING" not in wb.sheetnames:
        raise HTTPException(status_code=400, detail="Sheet 'LISTING' not found in file")

    ws = wb["LISTING"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    # Clear existing data
    db.query(Medicament).delete()
    db.commit()

    import re
    def _clean(s: str) -> str:
        return re.sub(r'\s+', ' ', str(s)).strip()

    medicaments = []
    seen_names: set[str] = set()
    seen_pids: set[str] = set()
    for row in rows:
        name = _clean(row[0]) if row[0] else None
        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        barcode = str(int(row[5])) if isinstance(row[5], (int, float)) else None
        pid = barcode if (barcode and barcode not in seen_pids) else name
        if pid in seen_pids:
            continue
        seen_pids.add(pid)

        medicaments.append(Medicament(
            pid=pid,
            product=name,
            tva=str(row[2]).strip() if row[2] else None,
            ppv=float(row[3]) if isinstance(row[3], (int, float)) else None,
            pph=float(row[4]) if isinstance(row[4], (int, float)) else None,
            category=str(row[1]).strip() if row[1] else None,
            zone=None,
        ))

    db.bulk_save_objects(medicaments)
    db.commit()
    return {"imported": len(medicaments)}
