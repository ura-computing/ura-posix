"""Payment-entry shapes for the /comptabilité page. Mirrors the apcm-pharma
contract: month is a 'YYYY-MM' string, method is one of PAYMENT_METHODS, and
the two amounts split by product type (pharmacie vs parapharmacie)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PaymentMethodLiteral = Literal["tpe", "especes", "cheques", "virement"]


class PaymentEntryIn(BaseModel):
    """Upsert payload. The (pharmacy_id, month, method) tuple is the key —
    a POST with an existing tuple updates the amounts + count in place."""
    month:                str                = Field(..., pattern=r"^\d{4}-\d{2}$")  # "YYYY-MM"
    method:               PaymentMethodLiteral
    pharmacie_amount:     float              = Field(0.0, ge=0)
    parapharmacie_amount: float              = Field(0.0, ge=0)
    count:                int                = Field(0,   ge=0)


class PaymentEntryOut(PaymentEntryIn):
    id: int
    model_config = ConfigDict(from_attributes=True)
