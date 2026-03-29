from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base
from utils.constants import RequestStatus, RequestType


class Medicament(Base):
    """Product catalog — one row per unique product."""
    __tablename__ = "medicaments"

    id = Column(Integer, primary_key=True, index=True)
    pid = Column(String, unique=True, index=True, nullable=False)  # Sobrus PID or barcode fallback
    product = Column(String, nullable=False)
    tva = Column(String, nullable=True)
    pph = Column(Float, nullable=True)        # purchase price
    ppv = Column(Float, nullable=True)        # selling price
    category = Column(String, nullable=True)
    zone = Column(String, nullable=True)
    barcode1 = Column(String, nullable=True)  # Code barre 1
    barcode2 = Column(String, nullable=True)  # Code barre 2
    laboratoire = Column(String, nullable=True)
    product_type = Column(String, nullable=True)  # "pharmacie" | "parapharmacie" | None (auto-detect)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    achats = relationship("Achat", back_populates="medicament")
    ventes = relationship("Vente", back_populates="medicament")

    __table_args__ = (
        Index("ix_medicament_category", "category"),
    )


class CategorySuffix(Base):
    """Maps a normalized category name to its transaction reference suffix."""
    __tablename__ = "category_suffixes"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, unique=True)  # normalized, no (xx%)
    suffix = Column(String, nullable=False)                  # e.g. "-1"
    color = Column(String, nullable=True)                    # e.g. "teal", "blue"
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CatalogRequest(Base):
    """Product addition OR non-declare request submitted by a pharmacy owner, reviewed by admin."""
    __tablename__ = "catalog_requests"

    id            = Column(Integer, primary_key=True, index=True)
    requested_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    pharmacy_id   = Column(Integer, ForeignKey("pharmacies.id"), nullable=True)
    status        = Column(String, default=RequestStatus.PENDING, nullable=False)  # pending | approved | rejected
    reject_reason = Column(String, nullable=True)
    request_type  = Column(String, default=RequestType.NEW_PRODUCT, nullable=False)  # new_product | non_declare
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=True)
    notes         = Column(String, nullable=True)

    product       = Column(String, nullable=False)
    tva           = Column(String, nullable=True)
    pph           = Column(Float, nullable=True)
    ppv           = Column(Float, nullable=True)
    category      = Column(String, nullable=True)
    zone          = Column(String, nullable=True)
    barcode1      = Column(String, nullable=True)
    laboratoire   = Column(String, nullable=True)

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at   = Column(DateTime(timezone=True), nullable=True)

    requester  = relationship("User", foreign_keys=[requested_by])
    medicament = relationship("Medicament", foreign_keys=[medicament_id])


class PharmacyMedicamentStatus(Base):
    """Tracks explicitly non-declared products per pharmacy.
    Absence = declared (default). A row only exists when admin approved a non-declare request."""
    __tablename__ = "pharmacy_medicament_status"

    id            = Column(Integer, primary_key=True, index=True)
    pharmacy_id   = Column(Integer, ForeignKey("pharmacies.id"), nullable=False)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=False)
    declared      = Column(Boolean, default=False, nullable=False)  # False = non-declared
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_medicament"),)
