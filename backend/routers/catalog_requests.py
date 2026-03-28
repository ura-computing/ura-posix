from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, CatalogRequest, Medicament, PharmacyMedicamentStatus, User, Vente
from routers.auth import get_current_user
from schemas import CatalogRejectBody, CatalogRequestCreate, CatalogRequestOut, NonDeclareRequestCreate

router = APIRouter(prefix="/catalog-requests", tags=["catalog-requests"])


def _to_out(req: CatalogRequest) -> CatalogRequestOut:
    return CatalogRequestOut(
        id=req.id,
        requested_by=req.requested_by,
        pharmacy_id=req.pharmacy_id,
        status=req.status,
        reject_reason=req.reject_reason,
        request_type=req.request_type or "new_product",
        medicament_id=req.medicament_id,
        medicament_name=req.medicament.product if req.medicament else None,
        notes=req.notes,
        product=req.product,
        tva=req.tva,
        pph=req.pph,
        ppv=req.ppv,
        category=req.category,
        zone=req.zone,
        barcode1=req.barcode1,
        laboratoire=req.laboratoire,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
        requester_name=req.requester.name if req.requester else None,
        requester_email=req.requester.email if req.requester else None,
        pharmacy_name=req.requester.pharmacy.name if (req.requester and req.requester.pharmacy) else None,
    )


@router.post("", response_model=CatalogRequestOut)
def submit_request(
    body: CatalogRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only pharmacy owners can submit catalog requests")
    req = CatalogRequest(
        requested_by=current_user.id,
        pharmacy_id=current_user.pharmacy_id,
        **body.model_dump(),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    # Reload with relationship
    req = db.query(CatalogRequest).filter(CatalogRequest.id == req.id).first()
    return _to_out(req)


@router.get("", response_model=List[CatalogRequestOut])
def list_requests(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(CatalogRequest)
    if current_user.role != "admin":
        # Owners see only their own requests
        q = q.filter(CatalogRequest.requested_by == current_user.id)
    if status:
        q = q.filter(CatalogRequest.status == status)
    reqs = q.order_by(CatalogRequest.created_at.desc()).all()
    return [_to_out(r) for r in reqs]


@router.post("/non-declare", response_model=CatalogRequestOut)
def submit_non_declare_request(
    body: NonDeclareRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("owner", "employee"):
        raise HTTPException(status_code=403, detail="Réservé aux propriétaires de pharmacie")
    med = db.query(Medicament).filter(Medicament.id == body.medicament_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    # Ensure pharmacy has this product in their data
    has_product = (
        db.query(Vente.id).filter(
            Vente.pharmacy_id == current_user.pharmacy_id,
            Vente.medicament_id == body.medicament_id,
        ).first()
        or db.query(Achat.id).filter(
            Achat.pharmacy_id == current_user.pharmacy_id,
            Achat.medicament_id == body.medicament_id,
        ).first()
    )
    if not has_product:
        raise HTTPException(status_code=400, detail="Ce produit n'existe pas dans vos données")
    # Avoid duplicate pending requests
    existing = db.query(CatalogRequest).filter(
        CatalogRequest.pharmacy_id == current_user.pharmacy_id,
        CatalogRequest.medicament_id == body.medicament_id,
        CatalogRequest.request_type == "non_declare",
        CatalogRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Une demande est déjà en cours pour ce produit")
    req = CatalogRequest(
        requested_by=current_user.id,
        pharmacy_id=current_user.pharmacy_id,
        request_type="non_declare",
        medicament_id=body.medicament_id,
        notes=body.notes,
        product=med.product,  # store name for display
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    req = db.query(CatalogRequest).filter(CatalogRequest.id == req.id).first()
    return _to_out(req)


@router.put("/{req_id}/approve", response_model=CatalogRequestOut)
def approve_request(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    req = db.query(CatalogRequest).filter(CatalogRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    if req.request_type == "non_declare":
        # Mark product as non-declared for this pharmacy
        existing = db.query(PharmacyMedicamentStatus).filter(
            PharmacyMedicamentStatus.pharmacy_id == req.pharmacy_id,
            PharmacyMedicamentStatus.medicament_id == req.medicament_id,
        ).first()
        if existing:
            existing.declared = False
        else:
            db.add(PharmacyMedicamentStatus(
                pharmacy_id=req.pharmacy_id,
                medicament_id=req.medicament_id,
                declared=False,
            ))
    else:
        # new_product: create a new Medicament entry
        pid_candidate = req.barcode1 or req.product
        if db.query(Medicament).filter(Medicament.pid == pid_candidate).first():
            pid_candidate = f"{req.product}-{req_id}"
        db.add(Medicament(
            pid=pid_candidate,
            product=req.product,
            tva=req.tva,
            pph=req.pph,
            ppv=req.ppv,
            category=req.category,
            zone=req.zone,
            barcode1=req.barcode1,
            laboratoire=req.laboratoire,
        ))

    req.status = "approved"
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    req = db.query(CatalogRequest).filter(CatalogRequest.id == req_id).first()
    return _to_out(req)


@router.put("/{req_id}/reject", response_model=CatalogRequestOut)
def reject_request(
    req_id: int,
    body: CatalogRejectBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    req = db.query(CatalogRequest).filter(CatalogRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = "rejected"
    req.reject_reason = body.reason
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    req = db.query(CatalogRequest).filter(CatalogRequest.id == req_id).first()
    return _to_out(req)
