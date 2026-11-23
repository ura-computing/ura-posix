"""/v1/notifications — the bell of the top bar, every logged-in user (only their own lines)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path

from app.core.database import DbDep
from app.core.security import CurrentUserDep
from app.notifications.schemas import NotificationOut, NotificationsOut
from app.notifications.service import mark_read, user_lines

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationsOut)
def list_notifications(user: CurrentUserDep, db: DbDep) -> NotificationsOut:
    lines, unread = user_lines(db, user.id)
    return NotificationsOut(items=[NotificationOut.model_validate(n) for n in lines], unread=unread)


@router.post("/notifications/read-all", status_code=204)
def read_all(user: CurrentUserDep, db: DbDep) -> None:
    """« Tout marquer comme lu »."""
    mark_read(db, user.id)


@router.post("/notifications/{notification_id}/read", status_code=204)
def read_one(notification_id: Annotated[int, Path(ge=1)], user: CurrentUserDep, db: DbDep) -> None:
    """A click on a line (another user's id: nothing happens)."""
    mark_read(db, user.id, notification_id)
