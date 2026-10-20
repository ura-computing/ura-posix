"""« Observations »: a pharmacy's notes on one product. Anyone with Produits adds one; its author or
the owner deletes it. Both are written in the history (`app/core/audit.py`) with the note's text."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import AuditAction, log_action, user_label
from app.core.models import Medicament, ProductNote, User


def note_out(note: ProductNote, user: User) -> dict:
    return {
        "id": note.id,
        "text": note.text,
        "author": note.author_name,
        "created_at": note.created_at,
        "can_delete": note.user_id == user.id or user.role == "owner",
    }


def list_notes(db: Session, pharmacy_id: int, med_id: int, user: User) -> list[dict]:
    """Newest first."""
    notes = db.scalars(
        select(ProductNote)
        .where(ProductNote.pharmacy_id == pharmacy_id, ProductNote.medicament_id == med_id)
        .order_by(ProductNote.created_at.desc(), ProductNote.id.desc())
    ).all()
    return [note_out(n, user) for n in notes]


def note_counts(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, int]:
    """Number of observations per product id (only the ids asked)."""
    if not med_ids:
        return {}
    rows = db.execute(
        select(ProductNote.medicament_id, func.count())
        .where(ProductNote.pharmacy_id == pharmacy_id, ProductNote.medicament_id.in_(med_ids))
        .group_by(ProductNote.medicament_id)
    ).all()
    return {med_id: n for med_id, n in rows}


def add_note(db: Session, pharmacy_id: int, med: Medicament, user: User, text: str) -> dict:
    note = ProductNote(
        pharmacy_id=pharmacy_id, medicament_id=med.id, user_id=user.id, author_name=user_label(user), text=text
    )
    db.add(note)
    log_action(db, user, pharmacy_id, AuditAction.NOTE_ADDED, {"product": med.product, "text": text}, med.id)
    db.commit()
    db.refresh(note)
    return note_out(note, user)


def delete_note(db: Session, pharmacy_id: int, med: Medicament, note: ProductNote, user: User) -> None:
    log_action(
        db,
        user,
        pharmacy_id,
        AuditAction.NOTE_DELETED,
        {"product": med.product, "text": note.text, "author": note.author_name},
        med.id,
    )
    db.delete(note)
    db.commit()
