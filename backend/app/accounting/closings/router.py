"""Comptabilité — « Clôture de caisse » (Sobrus' daily cash desk closing) and « Retours clients (avoirs) », read-only.
The Sobrus robot fetches both at every run (`app/sobrus/sync.py`, `Robot.closing`, `Robot.returns`); this only reads
what it stored. Gated like the payments
(`member("accounting")`)."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.accounting.closings.schemas import (
    ClosingDay,
    ClosingMethod,
    ClosingMonth,
    ClosingTotals,
    SalesReturnMonth,
    SalesReturnRow,
)
from app.core.database import DbDep
from app.core.models import SobrusCashClosing, SobrusConnection, SobrusSalesReturn
from app.core.permissions import member

router = APIRouter(prefix="/accounting", tags=["accounting"])


def _day(row: SobrusCashClosing) -> ClosingDay:
    methods = [ClosingMethod(code=code, **values) for code, values in (row.by_method or {}).items()]
    return ClosingDay(
        **{k: getattr(row, k) for k in ClosingDay.model_fields if k not in ("methods", "customers")},
        methods=sorted(methods, key=lambda m: -(m.cash_sales + m.settlements + m.advances)),
        customers=row.by_customer or [],
    )


MonthQ = Annotated[str, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


def _month(month: str) -> tuple[date, date]:
    """« 2026-11 » → (2026-11-01, 2026-12-01)."""
    year, m = int(month[:4]), int(month[5:])
    return date(year, m, 1), date(year + m // 12, m % 12 + 1, 1)


@router.get("/cash-closings", response_model=ClosingMonth)
def list_cash_closings(
    pharmacy_id: Annotated[int, member("accounting")],
    db: DbDep,
    month: MonthQ,
) -> ClosingMonth:
    """The month's days (oldest first) + their totals; why it may be empty (not connected, no access)."""
    first, nxt = _month(month)
    rows = (
        db.query(SobrusCashClosing)
        .filter(
            SobrusCashClosing.pharmacy_id == pharmacy_id,
            SobrusCashClosing.day >= first,
            SobrusCashClosing.day < nxt,
        )
        .order_by(SobrusCashClosing.day)
        .all()
    )
    conn = db.query(SobrusConnection).filter_by(pharmacy_id=pharmacy_id).first()
    return ClosingMonth(
        days=[_day(r) for r in rows],
        totals=ClosingTotals(
            invoices=sum(r.invoices for r in rows),
            total=round(sum(r.total for r in rows), 2),
            paid=round(sum(r.paid for r in rows), 2),
            credit_sales=round(sum(r.credit_sales for r in rows), 2),
            returns=round(sum(r.returns for r in rows), 2),
            net=round(sum(r.net for r in rows), 2),
        ),
        connected=conn is not None,
        no_access=conn is not None and conn.closing_access is False,
        last_fetched_at=max((r.fetched_at for r in rows), default=None),
    )


@router.get("/sales-returns", response_model=SalesReturnMonth)
def list_sales_returns(
    pharmacy_id: Annotated[int, member("accounting")],
    db: DbDep,
    month: MonthQ,
) -> SalesReturnMonth:
    """The month's « Retours clients (avoirs) » (newest first) + count and total; why it may be empty."""
    first, nxt = _month(month)
    rows = (
        db.query(SobrusSalesReturn)
        .filter(
            SobrusSalesReturn.pharmacy_id == pharmacy_id,
            SobrusSalesReturn.day >= first,
            SobrusSalesReturn.day < nxt,
        )
        .order_by(SobrusSalesReturn.day.desc(), SobrusSalesReturn.id.desc())
        .all()
    )
    conn = db.query(SobrusConnection).filter_by(pharmacy_id=pharmacy_id).first()
    return SalesReturnMonth(
        returns=[SalesReturnRow.model_validate(r) for r in rows],
        count=len(rows),
        total=round(sum(r.amount for r in rows), 2),
        connected=conn is not None,
        no_access=conn is not None and conn.returns_access is False,
        last_fetched_at=max((r.fetched_at for r in rows), default=None),
    )
