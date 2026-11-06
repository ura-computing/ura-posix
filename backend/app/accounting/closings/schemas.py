"""« Clôture de caisse » shapes (Comptabilité, read-only): the days of one month as the Sobrus robot stored them."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ClosingMethod(BaseModel):
    """One payment way of a day (Sobrus code: cash, check, debit_card, bill_of_exchange, credit, other,
    wire_transfer); `label` = Sobrus' own name, shown when the code has no translation."""

    code: str
    label: str
    cash_sales: float
    settlements: float
    advances: float
    expenses: float
    other: float


class ClosingCustomer(BaseModel):
    name: str
    credit: float
    balance: float


class ClosingDay(BaseModel):
    day: date
    invoices: int
    total: float
    paid: float
    unpaid: float
    discount: float
    cash_sales: float
    credit_sales: float
    unpaid_credit: float
    returns: float
    net: float
    gross_total: float
    methods: list[ClosingMethod]
    customers: list[ClosingCustomer]
    model_config = ConfigDict(from_attributes=True)


class ClosingTotals(BaseModel):
    invoices: int
    total: float
    paid: float
    credit_sales: float
    returns: float
    net: float


class ClosingMonth(BaseModel):
    """`connected` = a Sobrus connection exists; `no_access` = its account may not read the report (the owner's
    login can); `last_fetched_at` = the newest day's fetch."""

    days: list[ClosingDay]
    totals: ClosingTotals
    connected: bool
    no_access: bool
    last_fetched_at: datetime | None
