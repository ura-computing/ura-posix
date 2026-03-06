import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
    """Insert or update a Medicament row by PID, return the instance."""
    med = db.query(Medicament).filter(Medicament.pid == pid).first()
    if med:
        # Keep the catalog fresh with the latest values from the CSV
        if product:
            med.product = product
        if tva:
            med.tva = tva
        if pph is not None:
            med.pph = pph
        if ppv is not None:
            med.ppv = ppv
        if category:
            med.category = category
        if zone:
            med.zone = zone
    else:
        med = Medicament(
            pid=pid,
            product=product,
            tva=tva,
            pph=pph,
            ppv=ppv,
            category=category,
            zone=zone,
        )
        db.add(med)
    db.flush()  # assign med.id without full commit
    return med


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

    achats = []
    for row in rows:
        pid = row.get("PID", "").strip()
        if not pid:
            continue

        med = _upsert_medicament(
            db,
            pid=pid,
            product=row.get("Produit", ""),
            tva=row.get("TVA") or None,
            pph=_parse_float(row.get("PPH", "")),
            ppv=_parse_float(row.get("PPV", "")),
            category=row.get("Catégorie") or None,
            zone=row.get("Zone") or None,
        )

        achats.append(Achat(
            medicament_id=med.id,
            created_at_source=row.get("Créée le") or None,
            delivery_date=row.get("Date Bon de Livraison") or None,
            delivery_ref=row.get("Référence de livraison") or None,
            supplier=row.get("Fournisseur") or None,
            quantity=_parse_float(row.get("Quantité", "")),
            unit_price=_parse_float(row.get("Prix unitaire", "")),
            expiry_date=row.get("Date de péremption") or None,
            stock_min=_parse_float(row.get("Stock min", "")),
            stock_max=_parse_float(row.get("Stock max", "")),
            total=_parse_float(row.get("Total", "")),
        ))

    db.bulk_save_objects(achats)
    db.commit()
    return {"inserted": len(achats)}


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

    ventes = []
    for row in rows:
        pid = row.get("PID", "").strip()
        if not pid:
            continue

        med = _upsert_medicament(
            db,
            pid=pid,
            product=row.get("Produit", ""),
            tva=row.get("TVA") or None,
            pph=_parse_float(row.get("PPH", "")),
            ppv=_parse_float(row.get("PPV", "")),
            category=row.get("Catégorie") or None,
            zone=row.get("Zone") or None,
        )

        ventes.append(Vente(
            medicament_id=med.id,
            date=row.get("Date") or None,
            transaction_ref=row.get("Numéro de transaction") or None,
            client=row.get("Client") or None,
            quantity=_parse_float(row.get("Quantité", "")),
            discount=_parse_float(row.get("Remise", "")),
            unit_price=_parse_float(row.get("Prix unitaire", "")),
            total=_parse_float(row.get("Total", "")),
        ))

    db.bulk_save_objects(ventes)
    db.commit()
    return {"inserted": len(ventes)}
