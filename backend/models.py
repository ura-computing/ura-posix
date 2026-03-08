from sqlalchemy import Column, Float, ForeignKey, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="pharmacy")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)  # null for Google-only users
    google_id = Column(String, unique=True, nullable=True)
    image_url = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    pharmacy_name = Column(String, nullable=True)
    profile_complete = Column(Boolean, default=False)
    role = Column(String, default="owner", nullable=False)  # admin | owner | employee
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    pharmacy = relationship("Pharmacy", back_populates="users")


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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    achats = relationship("Achat", back_populates="medicament")
    ventes = relationship("Vente", back_populates="medicament")


class Achat(Base):
    """One row = one line-item on a purchase delivery note."""
    __tablename__ = "achats"

    id = Column(Integer, primary_key=True, index=True)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=True, index=True)
    medicament = relationship("Medicament", back_populates="achats")

    created_at_source = Column(String, nullable=True)   # "Créée le"
    delivery_date = Column(String, nullable=True)        # "Date Bon de Livraison"
    delivery_ref = Column(String, nullable=True)         # "Référence de livraison"
    supplier = Column(String, nullable=True)             # Fournisseur
    quantity = Column(Float, nullable=True)
    unit_price = Column(Float, nullable=True)            # "Prix unitaire"
    expiry_date = Column(String, nullable=True)          # "Date de péremption"
    stock_min = Column(Float, nullable=True)
    stock_max = Column(Float, nullable=True)
    total = Column(Float, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())


class Vente(Base):
    """One row = one line-item on a sales transaction."""
    __tablename__ = "ventes"

    id = Column(Integer, primary_key=True, index=True)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=True, index=True)
    medicament = relationship("Medicament", back_populates="ventes")

    date = Column(String, nullable=True)
    transaction_ref = Column(String, nullable=True)      # "Numéro de transaction"
    client = Column(String, nullable=True)
    quantity = Column(Float, nullable=True)
    discount = Column(Float, nullable=True)              # Remise
    unit_price = Column(Float, nullable=True)            # "Prix unitaire"
    total = Column(Float, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
