"""« Historique des modifications »: one `AuditLog` line per change of a pharmacy, kept as proof.
`log_action(db, user, pharmacy_id, AuditAction.PRODUCT_EDITED, {...}, medicament_id=…)` is added in
the same transaction as the change (the caller commits). The page translates `history.<action>`."""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy.orm import Session

from app.core.models import AuditLog, User


class AuditAction(StrEnum):
    IMPORT_DONE = "import_done"  # {batch_id, type, file, imported, skipped}
    IMPORT_CANCELLED = "import_cancelled"  # {batch_id, type, file, imported = 0, skipped = 0}
    IMPORT_FAILED = "import_failed"  # {batch_id, type, file, imported, skipped, error}
    IMPORT_DELETED = "import_deleted"  # {batch_id, type, file, lines removed (absent before 0029)}
    PRODUCT_EDITED = "product_edited"  # {product, field, before, after}
    PRODUCT_REVERTED = "product_reverted"  # {product, field, before, after = the imported value}
    NOTE_ADDED = "note_added"  # {product, text}
    NOTE_DELETED = "note_deleted"  # {product, text, author}
    SOBRUS_CONNECTED = "sobrus_connected"  # {email}
    SOBRUS_PASSWORD_UPDATED = "sobrus_password_updated"  # {email}
    SOBRUS_DISCONNECTED = "sobrus_disconnected"  # {email}
    SOBRUS_LOGIN_REFUSED = "sobrus_login_refused"  # {email, reason = error code}
    SOBRUS_PRODUCTS_FETCHED = "sobrus_products_fetched"  # {added, filled} (by the admin, « Produits Sobrus »)
    SOBRUS_EMAIL_RESET = "sobrus_email_reset"  # {email}: the admin lets the pharmacy connect another Sobrus account


def user_label(user: User) -> str:
    """The name shown in the history (kept if the account is deleted later)."""
    return user.name or user.email


def log_action(
    db: Session,
    user: User | None,
    pharmacy_id: int,
    action: AuditAction,
    details: dict,
    medicament_id: int | None = None,
) -> None:
    db.add(
        AuditLog(
            pharmacy_id=pharmacy_id,
            user_id=user.id if user else None,
            user_name=user_label(user) if user else "",
            action=action,
            details=details,
            medicament_id=medicament_id,
        )
    )
