from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from database import Base


class PharmacyStock(Base):
    """Current stock snapshot for a pharmacy, imported from Sobrus stock CSV.

    Full snapshot semantics: uploading a new CSV replaces all rows for the pharmacy.
    """
    __tablename__ = "pharmacy_stock"

    id = Column(Integer, primary_key=True, index=True)
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=False, index=True)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=False, index=True)
    current_stock = Column(Integer, nullable=False, default=0)
    stock_min = Column(Integer, nullable=True)
    stock_max = Column(Integer, nullable=True)
    expiry_date = Column(Date, nullable=True)
    zone = Column(String, nullable=True)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_stock_pharmacy_medicament"),
    )
