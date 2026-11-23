"""The bell's shapes."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str  # the text: `notifications.<kind>` with `params`
    params: dict
    link: str | None  # the page it opens, e.g. "/admin/boutiques"
    created_at: datetime
    read_at: datetime | None


class NotificationsOut(BaseModel):
    items: list[NotificationOut]  # newest first, 30 max
    unread: int
