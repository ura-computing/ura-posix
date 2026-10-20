"""« Historique des modifications » shapes."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.ledger.schemas import Pagination


class AuditRow(BaseModel):
    id: int
    created_at: datetime
    user_name: str  # who (name, else email; kept if the account is deleted); "" = unknown (old imports)
    action: str  # `app/core/audit.py` AuditAction: the page shows `history.<action>`
    details: dict  # the action's values: file, field before → after, note text…
    medicament_id: int | None  # the product it is about (link to its page)
    product: str | None  # its catalogue name


class HistoryResponse(BaseModel):
    data: list[AuditRow]
    pagination: Pagination
    people: list[str]  # everyone who appears in the pharmacy's history (« Personne » filter)


class ProductHistoryResponse(BaseModel):
    data: list[AuditRow]
    pagination: Pagination
