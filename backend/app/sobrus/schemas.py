"""« Connexion Sobrus » shapes. The password never appears in an answer."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.utils import today


class SobrusRunOut(BaseModel):
    id: int
    mode: Literal["full", "new", "check", "range", "products", "suppliers"]  # products, suppliers: the admin's
    status: Literal["queued", "running", "success", "error", "cancelled"]
    cancel_requested: bool
    date_from: date | None  # mode `range` only
    date_to: date | None
    phase: str | None  # login | download | import | closing | products
    kind: str | None  # achat | vente
    year: int | None
    bytes_received: int
    chunk_current: int
    chunk_total: int
    lines_added: int
    events: list[dict]  # [{at, code, kind?, year?, n?, start?, end?, error?}]
    error_code: str | None
    created_by: int | None  # who clicked (None = the nightly robot); the admin's corner card: that person only
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None


class SobrusConnectionOut(BaseModel):
    """`locked_email`: the pharmacy's Sobrus account, also once disconnected (a new connection must use it);
    `imported_years`: past years already imported in full, by kind (« 2024 ✓ »)."""

    connected: bool
    locked_email: str | None = None
    imported_years: dict[str, list[int]] = {}
    email: str | None = None
    status: Literal["active", "needs_login", "invalid"] | None = None
    consent_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error_code: str | None = None
    active_run: SobrusRunOut | None = None


class SobrusConnectionIn(BaseModel):
    """First connection: email + password + consent. Later: only `password` (« Mettre à jour le mot de
    passe »), or a new email + password."""

    email: str | None = Field(None, max_length=200)
    password: str = Field(min_length=1, max_length=200)
    consent: bool = False

    @field_validator("email", mode="before")
    @classmethod
    def _trim(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class SobrusRunIn(BaseModel):
    """`range` = « Importer une période »: date_from ≤ date_to; an end after today stops today."""

    mode: Literal["full", "new", "check", "range"]
    date_from: date | None = None
    date_to: date | None = None
    force: bool = False  # « Réimporter quand même »: the past years already imported are read again

    @model_validator(mode="after")
    def _period(self) -> "SobrusRunIn":
        if self.mode != "range":
            self.date_from = self.date_to = None
            return self
        if self.date_from is None or self.date_to is None:
            raise ValueError("date_from et date_to requis")
        self.date_to = min(self.date_to, today())
        if self.date_from > self.date_to:
            raise ValueError("date_from après date_to")
        return self


class AdminProductsRun(BaseModel):
    pharmacy_name: str
    run: SobrusRunOut


class AdminSobrusImportOut(BaseModel):
    """Catalogue « Importer les produits depuis Sobrus »: connected pharmacies (active connection) and the last
    click's tries, oldest first (refused accounts, then the one that worked or still runs)."""

    connected: int
    runs: list[AdminProductsRun]


class AdminSobrusImportStarted(BaseModel):
    pharmacy_name: str  # whose owner's Sobrus account is read first
