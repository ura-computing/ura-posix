from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
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
    phone = Column(String, nullable=True)
    pharmacy_name = Column(String, nullable=True)
    profile_complete = Column(Boolean, default=False)
    role = Column(String, default="owner", nullable=False)  # admin | owner | employee
    status = Column(String, default="pending", nullable=False)  # pending | active | rejected
    permissions = Column(JSON, nullable=True, default=lambda: {})  # feature flags, {} = all allowed
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    pharmacy = relationship("Pharmacy", back_populates="users")

    @property
    def pharmacy_address(self):
        return self.pharmacy.address if self.pharmacy else None
