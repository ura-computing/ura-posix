"""« Connexion Sobrus » (owner + feature `sobrus`, given or taken by the admin like every access):
PharmaGest imports the pharmacy's Sobrus achats + ventes + stock by itself (`worker.py` + `sync.py`).

GET    /v1/sobrus/connection          the connection (never the password) + the run in progress
PUT    /v1/sobrus/connection          {email, password, consent} first time; {password} = new password.
                                      Queues a « check » run (login test) at once
DELETE /v1/sobrus/connection          password + session erased, the running run stopped
POST   /v1/sobrus/runs                {mode: full | new | check | range, date_from?, date_to?}: one queued /
                                      running run per pharmacy
GET    /v1/sobrus/runs                the last runs, newest first (the page polls while one runs)
POST   /v1/sobrus/runs/{id}/cancel    « Arrêter »: the run ends now (cancelled); a busy robot stops at its next check

Admin, Catalogue « Importer les produits depuis Sobrus » (run mode `products`, one owner's Sobrus login at a
time, `catalog_import.py`; the catalogue CSV import stays for when Sobrus fails):
POST   /v1/admin/catalog/sobrus-products         queue the fetch with one owner's account (the next one if refused)
GET    /v1/admin/catalog/sobrus-products         the last click's tries + how many pharmacies are connected
GET    /v1/admin/catalog/sobrus-products/history every try, newest first (« Gestion des imports »)
POST   /v1/admin/catalog/sobrus-products/cancel  « Arrêter »

A queued run wakes the robot at once (`launcher.wake`: Postgres NOTIFY to `worker.py`, its own process).
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Path, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import AuditAction, log_action
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Pharmacy, SobrusConnection, SobrusRun
from app.core.permissions import AdminDep, owner
from app.core.security import CurrentUserDep
from app.sobrus.catalog_import import chain_since, queue_next
from app.sobrus.crypto import encrypt
from app.sobrus.launcher import wake
from app.sobrus.schemas import (
    AdminProductsRun,
    AdminSobrusImportOut,
    AdminSobrusImportStarted,
    SobrusConnectionIn,
    SobrusConnectionOut,
    SobrusRunIn,
    SobrusRunOut,
)

router = APIRouter(tags=["sobrus"])

OwnerSobrus = Annotated[int, owner("sobrus")]
ACTIVE = ("queued", "running")


def _connection(db: Session, pharmacy_id: int) -> SobrusConnection | None:
    return db.query(SobrusConnection).filter_by(pharmacy_id=pharmacy_id).first()


def _active_run(db: Session, pharmacy_id: int) -> SobrusRun | None:
    return db.query(SobrusRun).filter(SobrusRun.pharmacy_id == pharmacy_id, SobrusRun.status.in_(ACTIVE)).first()


def _connection_out(db: Session, pharmacy_id: int) -> SobrusConnectionOut:
    conn = _connection(db, pharmacy_id)
    if conn is None:
        return SobrusConnectionOut(connected=False)
    run = _active_run(db, pharmacy_id)
    if run is not None and run.mode == "products":  # the admin's catalogue import: its progress is the admin's
        run = None
    return SobrusConnectionOut(
        connected=True,
        email=conn.email,
        status=conn.status,
        consent_at=conn.consent_at,
        last_success_at=conn.last_success_at,
        last_error_code=conn.last_error_code,
        active_run=SobrusRunOut.model_validate(run, from_attributes=True) if run else None,
    )


def _queue(
    db: Session, pharmacy_id: int, mode: str, user_id: int, date_from: date | None = None, date_to: date | None = None
) -> SobrusRun:
    run = SobrusRun(
        pharmacy_id=pharmacy_id,
        mode=mode,
        status="queued",
        date_from=date_from,
        date_to=date_to,
        events=[],
        created_by=user_id,
    )
    db.add(run)
    wake(db)  # delivered by the commit below
    try:
        db.commit()
    except IntegrityError as e:  # the partial unique index: one queued / running run per pharmacy
        db.rollback()
        raise ApiError(409, ErrorCode.SOBRUS_RUN_ACTIVE, "Un import Sobrus est déjà en cours.") from e
    db.refresh(run)
    return run


@router.get("/sobrus/connection", response_model=SobrusConnectionOut)
def get_connection(pharmacy_id: OwnerSobrus, db: DbDep) -> SobrusConnectionOut:
    return _connection_out(db, pharmacy_id)


@router.put("/sobrus/connection", response_model=SobrusConnectionOut)
def save_connection(
    body: SobrusConnectionIn, pharmacy_id: OwnerSobrus, user: CurrentUserDep, db: DbDep
) -> SobrusConnectionOut:
    conn = _connection(db, pharmacy_id)
    if conn is None:
        if not body.email:
            raise ApiError(422, ErrorCode.INVALID_INPUT, "Email Sobrus requis.")
        if not body.consent:
            raise ApiError(422, ErrorCode.CONSENT_REQUIRED, "Autorisation requise.")
        conn = SobrusConnection(
            pharmacy_id=pharmacy_id,
            email=body.email,
            password_enc=encrypt(body.password),
            status="active",
            consent_at=datetime.now(timezone.utc),
            created_by=user.id,
            failed_nights=0,
        )
        db.add(conn)
        action = AuditAction.SOBRUS_CONNECTED
    else:
        if body.email:
            conn.email = body.email
        conn.password_enc = encrypt(body.password)
        conn.session_enc = None  # next run logs in with the new password
        conn.status = "active"
        conn.last_error_code = None
        conn.problem_notified_at = None
        conn.failed_nights = 0
        conn.created_by = user.id  # emails go to the owner who typed the password
        action = AuditAction.SOBRUS_PASSWORD_UPDATED
    log_action(db, user, pharmacy_id, action, {"email": conn.email})
    db.commit()
    if _active_run(db, pharmacy_id) is None:
        _queue(db, pharmacy_id, "check", user.id)
    return _connection_out(db, pharmacy_id)


@router.delete("/sobrus/connection", status_code=204)
def delete_connection(pharmacy_id: OwnerSobrus, user: CurrentUserDep, db: DbDep) -> None:
    conn = _connection(db, pharmacy_id)
    if conn is None:
        raise ApiError(404, ErrorCode.SOBRUS_NOT_CONNECTED, "Aucune connexion Sobrus.")
    run = _active_run(db, pharmacy_id)
    if run is not None:
        _stop(run)
    log_action(db, user, pharmacy_id, AuditAction.SOBRUS_DISCONNECTED, {"email": conn.email})
    db.delete(conn)
    db.commit()


@router.post("/sobrus/runs", response_model=SobrusRunOut, status_code=201)
def start_run(body: SobrusRunIn, pharmacy_id: OwnerSobrus, user: CurrentUserDep, db: DbDep) -> SobrusRun:
    conn = _connection(db, pharmacy_id)
    if conn is None:
        raise ApiError(409, ErrorCode.SOBRUS_NOT_CONNECTED, "Aucune connexion Sobrus.")
    if conn.status == "invalid":
        raise ApiError(409, ErrorCode.SOBRUS_BAD_CREDENTIALS, "Mot de passe Sobrus refusé : mettez-le à jour.")
    return _queue(db, pharmacy_id, body.mode, user.id, body.date_from, body.date_to)


@router.get("/sobrus/runs", response_model=list[SobrusRunOut])
def list_runs(pharmacy_id: OwnerSobrus, db: DbDep, limit: Annotated[int, Query(ge=1, le=50)] = 10) -> list[SobrusRun]:
    return (
        db.query(SobrusRun)
        .filter(SobrusRun.pharmacy_id == pharmacy_id, SobrusRun.mode != "products")  # the admin's, shown to him only
        .order_by(SobrusRun.created_at.desc(), SobrusRun.id.desc())
        .limit(limit)
        .all()
    )


def _stop(run: SobrusRun) -> None:
    """« Arrêter » / « Déconnecter »: the run ends now for the owner (no « en cours », no more polling,
    a new run can start). A robot still busy — a Sobrus download can last minutes — sees
    `cancel_requested` at its next check and removes what it imported of that file."""
    run.cancel_requested = True
    run.status = "cancelled"
    run.ended_at = datetime.now(timezone.utc)


@router.post("/sobrus/runs/{run_id}/cancel", response_model=SobrusRunOut)
def cancel_run(run_id: Annotated[int, Path(ge=1)], pharmacy_id: OwnerSobrus, db: DbDep) -> SobrusRun:
    run = db.get(SobrusRun, run_id)
    if run is None or run.pharmacy_id != pharmacy_id or run.status not in ACTIVE:
        raise ApiError(404, ErrorCode.SOBRUS_RUN_NOT_FOUND, "Import Sobrus introuvable.")
    _stop(run)
    db.commit()
    db.refresh(run)
    return run


@router.post("/admin/catalog/sobrus-products", response_model=AdminSobrusImportStarted, status_code=201)
def start_products_import(admin: AdminDep, db: DbDep) -> AdminSobrusImportStarted:
    """« Importer les produits depuis Sobrus »: one owner's Sobrus account, the last that worked; the robot tries the
    next connected pharmacy if Sobrus refuses it (`catalog_import`)."""
    if not db.query(SobrusConnection).filter(SobrusConnection.status == "active").count():
        raise ApiError(409, ErrorCode.SOBRUS_NOT_CONNECTED, "Aucune pharmacie n'est connectée à Sobrus.")
    if db.query(SobrusRun.id).filter(SobrusRun.mode == "products", SobrusRun.status.in_(ACTIVE)).first():
        raise ApiError(409, ErrorCode.SOBRUS_RUN_ACTIVE, "Un import Sobrus est déjà en cours.")
    wake(db)  # delivered by queue_next's commit
    run = queue_next(db, datetime.now(timezone.utc), admin.id, set())
    if run is None:  # every connected pharmacy is busy with its own run
        raise ApiError(409, ErrorCode.SOBRUS_RUN_ACTIVE, "Un import Sobrus est déjà en cours.")
    return AdminSobrusImportStarted(pharmacy_name=db.get(Pharmacy, run.pharmacy_id).name)


@router.get("/admin/catalog/sobrus-products", response_model=AdminSobrusImportOut)
def products_import(_: AdminDep, db: DbDep) -> AdminSobrusImportOut:
    """The last click's tries (oldest first: refused accounts, then the one that worked or still runs) + how many
    pharmacies are connected."""
    latest = db.query(SobrusRun).filter(SobrusRun.mode == "products").order_by(SobrusRun.id.desc()).first()
    rows = []
    if latest is not None:
        rows = (
            db.query(SobrusRun, Pharmacy.name)
            .join(Pharmacy, Pharmacy.id == SobrusRun.pharmacy_id)
            .filter(SobrusRun.mode == "products", SobrusRun.created_at >= chain_since(latest))
            .order_by(SobrusRun.id)
            .all()
        )
    connected = db.query(SobrusConnection).filter(SobrusConnection.status == "active").count()
    return AdminSobrusImportOut(
        connected=connected,
        runs=[
            AdminProductsRun(pharmacy_name=name, run=SobrusRunOut.model_validate(run, from_attributes=True))
            for run, name in rows
        ],
    )


@router.get("/admin/catalog/sobrus-products/history", response_model=list[AdminProductsRun])
def products_import_history(
    _: AdminDep, db: DbDep, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> list[AdminProductsRun]:
    """« Gestion des imports » (admin), tab « Produits Sobrus »: every try, newest first, with the account used."""
    rows = (
        db.query(SobrusRun, Pharmacy.name)
        .join(Pharmacy, Pharmacy.id == SobrusRun.pharmacy_id)
        .filter(SobrusRun.mode == "products")
        .order_by(SobrusRun.id.desc())
        .limit(limit)
        .all()
    )
    return [
        AdminProductsRun(pharmacy_name=name, run=SobrusRunOut.model_validate(run, from_attributes=True))
        for run, name in rows
    ]


@router.post("/admin/catalog/sobrus-products/cancel", response_model=AdminSobrusImportOut)
def cancel_products_import(admin: AdminDep, db: DbDep) -> AdminSobrusImportOut:
    """« Arrêter »: the running / queued fetch ends now (what it added stays); no next account is tried."""
    for run in db.query(SobrusRun).filter(SobrusRun.mode == "products", SobrusRun.status.in_(ACTIVE)):
        _stop(run)
    db.commit()
    return products_import(admin, db)
