import csv
import io
from typing import Any

import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from database import get_db
from models import Achat, ImportBatch, Medicament, User, Vente
from routers.auth import get_current_user
from utils.strings import normalize_category, strip_accents

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Impossible de décoder l'encodage du fichier")


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
    category = normalize_category(category)
    # 1. Try exact Sobrus PID match
    med = db.query(Medicament).filter(Medicament.pid == pid).first()
    if not med:
        # 2. Fall back to name match (case + accent insensitive)
        name = (product or "").strip()
        if name:
            med = db.query(Medicament).filter(
                Medicament.product.ilike(name)
            ).first()
            # 2b. Try accent-stripped match if still not found
            if not med:
                norm = strip_accents(name.lower())
                med = db.query(Medicament).filter(
                    func.lower(Medicament.product).ilike(f"%{norm}%")
                ).first()
                # Only accept if the stripped name is an exact match, not just a substring
                if med and strip_accents((med.product or "").lower()) != norm:
                    med = None
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


def _insert_achats(db: Session, rows: list[dict[str, Any]], pharmacy_id: int | None = None, filename: str | None = None, batch_id: int | None = None) -> dict:
    # Pre-load existing (delivery_ref, medicament_id) pairs scoped to this pharmacy
    incoming_refs = {
        (row.get("Référence de livraison") or "").strip()
        for row in rows
        if (row.get("Référence de livraison") or "").strip()
    }
    existing_pairs: set[tuple[str, int]] = set()
    if incoming_refs:
        q = db.query(Achat.delivery_ref, Achat.medicament_id).filter(
            Achat.delivery_ref.in_(incoming_refs)
        )
        if pharmacy_id is not None:
            q = q.filter(Achat.pharmacy_id == pharmacy_id)
        existing_pairs = {(a.delivery_ref, a.medicament_id) for a in q.all()}

    if batch_id:
        batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not batch:
            batch = ImportBatch(pharmacy_id=pharmacy_id or 0, file_type="achat", filename=filename)
            db.add(batch)
            db.flush()
    else:
        batch = ImportBatch(pharmacy_id=pharmacy_id or 0, file_type="achat", filename=filename)
        db.add(batch)
        db.flush()

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
            pharmacy_id=pharmacy_id,
            medicament_id=med.id,
            import_batch_id=batch.id,
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
    batch.rows_inserted = (batch.rows_inserted or 0) + len(achats)
    batch.rows_skipped = (batch.rows_skipped or 0) + skipped
    db.commit()
    return {"inserted": len(achats), "skipped": skipped, "batch_id": batch.id}


def _insert_ventes(db: Session, rows: list[dict[str, Any]], pharmacy_id: int | None = None, filename: str | None = None, batch_id: int | None = None) -> dict:
    # Pre-load existing (transaction_ref, medicament_id) pairs scoped to this pharmacy
    incoming_refs = {
        (row.get("Numéro de transaction") or "").strip()
        for row in rows
        if (row.get("Numéro de transaction") or "").strip()
    }
    existing_pairs: set[tuple[str, int]] = set()
    if incoming_refs:
        q = db.query(Vente.transaction_ref, Vente.medicament_id).filter(
            Vente.transaction_ref.in_(incoming_refs)
        )
        if pharmacy_id is not None:
            q = q.filter(Vente.pharmacy_id == pharmacy_id)
        existing_pairs = {(v.transaction_ref, v.medicament_id) for v in q.all()}

    if batch_id:
        batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not batch:
            batch = ImportBatch(pharmacy_id=pharmacy_id or 0, file_type="vente", filename=filename)
            db.add(batch)
            db.flush()
    else:
        batch = ImportBatch(pharmacy_id=pharmacy_id or 0, file_type="vente", filename=filename)
        db.add(batch)
        db.flush()

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
            pharmacy_id=pharmacy_id,
            medicament_id=med.id,
            import_batch_id=batch.id,
            date=row.get("Date") or None,
            transaction_ref=transaction_ref,
            client=row.get("Client") or None,
            quantity=_parse_float(str(row.get("Quantité", ""))),
            discount=_parse_float(str(row.get("Remise", ""))),
            unit_price=_parse_float(str(row.get("Prix unitaire", ""))),
            total=_parse_float(str(row.get("Total", ""))),
        ))
    db.bulk_save_objects(ventes)
    batch.rows_inserted = (batch.rows_inserted or 0) + len(ventes)
    batch.rows_skipped = (batch.rows_skipped or 0) + skipped
    db.commit()
    return {"inserted": len(ventes), "skipped": skipped, "batch_id": batch.id}


# ─── Pydantic models ──────────────────────────────────────────────────────────

class TableUpload(BaseModel):
    rows: list[dict[str, Any]]
    filename: str | None = None
    batch_id: int | None = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

def _require_import(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.permissions or {}).get("import") is False:
        raise HTTPException(status_code=403, detail="Accès à l'import refusé")
    return current_user


@router.post("/achat")
async def upload_achat(
    file: UploadFile = File(...),
    batch_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_import),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers CSV sont acceptés")
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")
    rows = _parse_csv(content)
    if not rows:
        raise HTTPException(status_code=400, detail="Aucune donnée trouvée dans le fichier")
    return _insert_achats(db, rows, current_user.pharmacy_id, filename=file.filename, batch_id=batch_id)


@router.post("/achat-json")
async def upload_achat_json(
    body: TableUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_import),
):
    if not body.rows:
        raise HTTPException(status_code=400, detail="Aucune ligne fournie")
    return _insert_achats(db, body.rows, current_user.pharmacy_id, filename=body.filename, batch_id=body.batch_id)


@router.post("/vente")
async def upload_vente(
    file: UploadFile = File(...),
    batch_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_import),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers CSV sont acceptés")
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")
    rows = _parse_csv(content)
    if not rows:
        raise HTTPException(status_code=400, detail="Aucune donnée trouvée dans le fichier")
    return _insert_ventes(db, rows, current_user.pharmacy_id, filename=file.filename, batch_id=batch_id)


@router.post("/vente-json")
async def upload_vente_json(
    body: TableUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_import),
):
    if not body.rows:
        raise HTTPException(status_code=400, detail="Aucune ligne fournie")
    return _insert_ventes(db, body.rows, current_user.pharmacy_id, filename=body.filename, batch_id=body.batch_id)


def _parse_catalog_csv(content: bytes) -> list[Medicament]:
    """Parse catalog.csv (comma-delimited): Nom,Categorie,TVA,PPV,PPH,Code barre 1,Code barre 2,Laboratoire"""
    import re
    text = _decode(content)
    reader = csv.DictReader(io.StringIO(text), delimiter=",")
    medicaments = []
    seen_names: set[str] = set()
    seen_pids: set[str] = set()
    for row in reader:
        name = re.sub(r'\s+', ' ', (row.get("Nom") or "").strip())
        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        barcode = (row.get("Code barre 1") or "").strip()
        pid = barcode if (barcode and barcode not in seen_pids) else name
        if pid in seen_pids:
            continue
        seen_pids.add(pid)

        medicaments.append(Medicament(
            pid=pid,
            product=name,
            category=normalize_category(row.get("Categorie")),
            tva=(row.get("TVA") or "").strip() or None,
            ppv=_parse_float(row.get("PPV", "")),
            pph=_parse_float(row.get("PPH", "")),
            barcode1=barcode or None,
            barcode2=(row.get("Code barre 2") or "").strip() or None,
            laboratoire=(row.get("Laboratoire") or "").strip() or None,
        ))
    return medicaments


@router.post("/catalog")
async def upload_catalog(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Import catalog from CSV or XLSM. Clears all existing medicaments then re-imports."""
    fname = (file.filename or "").lower()
    if not fname.endswith(".csv") and not fname.endswith(".xlsm"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers .csv ou .xlsm sont acceptés")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo)")

    if fname.endswith(".csv"):
        medicaments = _parse_catalog_csv(content)
    else:
        import re
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, keep_vba=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Impossible d'ouvrir le fichier Excel")
        if "LISTING" not in wb.sheetnames:
            raise HTTPException(status_code=400, detail="Feuille 'LISTING' introuvable dans le fichier")
        ws = wb["LISTING"]
        xlsm_rows = list(ws.iter_rows(min_row=2, values_only=True))

        def _clean(s: str) -> str:
            return re.sub(r'\s+', ' ', str(s)).strip()

        medicaments = []
        seen_names: set[str] = set()
        seen_pids: set[str] = set()
        for row in xlsm_rows:
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
                category=normalize_category(str(row[1])) if row[1] else None,
                zone=None,
            ))

    if not medicaments:
        raise HTTPException(status_code=400, detail="Aucun produit trouvé dans le fichier")

    db.query(Medicament).delete()
    db.commit()
    db.bulk_save_objects(medicaments)
    db.commit()
    return {"imported": len(medicaments)}
