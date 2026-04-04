"""Payment entries — manually entered by users (not from Sobrus CSV)."""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.sql import func

from database import Base


class PaymentEntry(Base):
    """Monthly payment method totals — manually entered by the pharmacy owner."""
    __tablename__ = "payment_entries"

    id = Column(Integer, primary_key=True, index=True)
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=False, index=True)
    month = Column(String, nullable=False)  # "2026-03" format
    method = Column(String, nullable=False)  # "tpe", "especes", "cheques", "virement"
    pharmacie_amount = Column(Float, default=0)
    parapharmacie_amount = Column(Float, default=0)
    count = Column(Integer, default=0)  # number of transactions
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
