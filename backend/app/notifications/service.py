"""The bell of the top bar: who gets which line. Callers add the lines; their own `db.commit()` saves them.

| Kind (`notifications.<kind>`) | Who | When | Example text |
|---|---|---|---|
| signupRequest | admin + Support | « Créer un compte » sent | « Karim Bennani demande un compte » |
| storeRequest | Support | an owner asks for an online store | « Pharmacie Demo demande une boutique en ligne » |
| catalogueToClassify | admin + Support | products without a type after an import (one line, kept up to date) | « 12 produits à classer » |
| sobrusDone / sobrusFailed | the pharmacy's owners (catalogue run: who started it) | a Sobrus run ends | « Import Sobrus terminé : 1 204 lignes » |
| storeStep | the store's owner | Support moves the request | « Votre boutique : En cours » |
| orderToPlace | admin + Support | a pharmacy sends its order (« Envoyer à l'administrateur ») | « Pharmacie Demo : commande Bottu à passer (12 produits) » |
| orderStep | the pharmacy's owners | the admin moves it (Passée, Livrée, Annulée) | « Commande Bottu : passée chez le fournisseur » |
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.models import Medicament, Notification, User

# One unread line per user, updated in place (a running count, not an event).
COUNT_KINDS = frozenset({"catalogueToClassify"})
MAX_LINES = 30


def admin_and_support_ids(db: Session) -> list[int]:
    return [i for (i,) in db.query(User.id).filter(User.role.in_(("admin", "support")), User.status == "active").all()]


def support_ids(db: Session) -> list[int]:
    """The Support people (they build the stores; the admin does not)."""
    return [i for (i,) in db.query(User.id).filter(User.role == "support", User.status == "active").all()]


def owner_ids(db: Session, pharmacy_id: int) -> list[int]:
    return [
        i
        for (i,) in db.query(User.id)
        .filter(User.pharmacy_id == pharmacy_id, User.role == "owner", User.status == "active")
        .all()
    ]


def notify(db: Session, user_ids: list[int], kind: str, params: dict | None = None, link: str | None = None) -> None:
    """A new line for each user (a count kind: its unread line updated and moved to the top instead)."""
    now = datetime.now(tz=timezone.utc)
    for user_id in set(user_ids):
        line = None
        if kind in COUNT_KINDS:
            line = db.query(Notification).filter_by(user_id=user_id, kind=kind, read_at=None).first()
        if line is None:
            db.add(Notification(user_id=user_id, kind=kind, params=params or {}, link=link, created_at=now))
        else:
            line.params, line.link, line.created_at = params or {}, link, now


def sync_unclassified(db: Session) -> None:
    """« N produits à classer » for the admin and Support: updated after anything that adds or classifies products; read once 0."""
    n = db.query(func.count(Medicament.id)).filter(Medicament.product_type.is_(None)).scalar() or 0
    if n:
        notify(db, admin_and_support_ids(db), "catalogueToClassify", {"n": int(n)}, "catalogue?type=unclassified")
    else:
        db.query(Notification).filter_by(kind="catalogueToClassify", read_at=None).update(
            {Notification.read_at: datetime.now(tz=timezone.utc)}
        )


def user_lines(db: Session, user_id: int) -> tuple[list[Notification], int]:
    """The newest lines + how many are unread."""
    lines = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(MAX_LINES)
        .all()
    )
    unread = db.query(func.count(Notification.id)).filter_by(user_id=user_id, read_at=None).scalar() or 0
    return lines, int(unread)


def mark_read(db: Session, user_id: int, notification_id: int | None = None) -> None:
    """One line (its id) or all of them."""
    q = db.query(Notification).filter(Notification.user_id == user_id, Notification.read_at.is_(None))
    if notification_id is not None:
        q = q.filter(Notification.id == notification_id)
    q.update({Notification.read_at: datetime.now(tz=timezone.utc)})
    db.commit()
