from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Achat(Base):
    """One row = one line-item on a purchase delivery note."""
    __tablename__ = "achats"

    id = Column(Integer, primary_key=True, index=True)
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=True, index=True)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=True, index=True)
    medicament = relationship("Medicament", back_populates="achats")

    created_at_source = Column(String, nullable=True)   # "Créée le"
    delivery_date = Column(String, nullable=True)        # "Date Bon de Livraison"
    # NOTE: stored as VARCHAR (ISO date string e.g. "2024-01-15") — safe for BETWEEN comparisons
    delivery_ref = Column(String, nullable=True)         # "Référence de livraison"
    supplier = Column(String, nullable=True)             # Fournisseur
    quantity = Column(Float, nullable=True)
    unit_price = Column(Float, nullable=True)            # "Prix unitaire"
    expiry_date = Column(String, nullable=True)          # "Date de péremption"
    stock_min = Column(Float, nullable=True)
    stock_max = Column(Float, nullable=True)
    total = Column(Float, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_achat_pharmacy_date", "pharmacy_id", "delivery_date"),
    )


class Vente(Base):
    """One row = one line-item on a sales transaction."""
    __tablename__ = "ventes"

    id = Column(Integer, primary_key=True, index=True)
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=True, index=True)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=True, index=True)
    medicament = relationship("Medicament", back_populates="ventes")

    # NOTE: stored as VARCHAR (ISO date string e.g. "2024-01-15") — safe for BETWEEN comparisons
    date = Column(String, nullable=True)
    transaction_ref = Column(String, nullable=True)      # "Numéro de transaction"
    client = Column(String, nullable=True)
    quantity = Column(Float, nullable=True)
    discount = Column(Float, nullable=True)              # Remise
    unit_price = Column(Float, nullable=True)            # "Prix unitaire"
    total = Column(Float, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_vente_pharmacy_date", "pharmacy_id", "date"),
    )
