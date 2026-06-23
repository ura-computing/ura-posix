from datetime import datetime, date

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# FK target constants — avoid duplicating literals across mapped_column declarations.
FK_USERS_ID         = "users.id"
FK_PHARMACIES_ID    = "pharmacies.id"
FK_MEDICAMENTS_ID   = "medicaments.id"
FK_IMPORT_BATCHES_ID = "import_batches.id"

PAYMENT_METHODS = ("tpe", "especes", "cheques", "virement")

ALLOWED_FEATURES = (
    "rapports", "import", "achats", "ventes",
    "stock", "analyse", "accounting", "bl_exclusions",
    "special_products",
)


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id:      Mapped[int]            = mapped_column(Integer, primary_key=True)
    name:    Mapped[str]            = mapped_column(String, nullable=False)
    city:    Mapped[str | None]     = mapped_column(String, nullable=True)
    code:    Mapped[str | None]     = mapped_column(String, nullable=True, unique=True)
    address: Mapped[str | None]     = mapped_column(String, nullable=True)
    phone:   Mapped[str | None]     = mapped_column(String, nullable=True)
    email:   Mapped[str | None]     = mapped_column(String, nullable=True)
    version: Mapped[int]            = mapped_column(Integer, nullable=False, default=0)

    features: Mapped[list["PharmacyFeature"]] = relationship(back_populates="pharmacy", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id:            Mapped[int]            = mapped_column(Integer, primary_key=True)
    email:         Mapped[str]            = mapped_column(String, nullable=False, unique=True)
    name:          Mapped[str | None]     = mapped_column(String, nullable=True)
    phone:         Mapped[str | None]     = mapped_column(String, nullable=True)
    password_hash: Mapped[str | None]     = mapped_column(String, nullable=True)
    role:          Mapped[str]            = mapped_column(String, nullable=False)
    status:        Mapped[str]            = mapped_column(String, nullable=False)
    pharmacy_id:   Mapped[int | None]     = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=True)
    token_version: Mapped[int]            = mapped_column(Integer, nullable=False, default=0)
    version:       Mapped[int]            = mapped_column(Integer, nullable=False, default=0)
    last_login_at: Mapped[datetime | None]= mapped_column(DateTime(timezone=True), nullable=True)
    created_by:    Mapped[int | None]     = mapped_column(Integer, ForeignKey(FK_USERS_ID), nullable=True)
    reset_token:         Mapped[str | None]      = mapped_column(String, nullable=True)        # SHA-256 hash of the raw token
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    pharmacy:    Mapped[Pharmacy | None]      = relationship()
    permissions: Mapped[list["UserPermission"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id:                 Mapped[int]      = mapped_column(Integer, primary_key=True)
    user_id:            Mapped[int]      = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="CASCADE"), nullable=False)
    refresh_token_hash: Mapped[str]      = mapped_column(String, nullable=False, unique=True)
    device_label:       Mapped[str | None] = mapped_column(String, nullable=True)
    ip:                 Mapped[str | None] = mapped_column(String, nullable=True)
    created_at:         Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at:       Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at:         Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PharmacyFeature(Base):
    __tablename__ = "pharmacy_features"
    __table_args__ = (UniqueConstraint("pharmacy_id", "feature", name="uq_pharmacy_features_pharmacy_feature"),)

    id:          Mapped[int]  = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int]  = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    feature:     Mapped[str]  = mapped_column(String, nullable=False)
    enabled:     Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    pharmacy: Mapped[Pharmacy] = relationship(back_populates="features")


class UserPermission(Base):
    __tablename__ = "user_permissions"
    __table_args__ = (UniqueConstraint("user_id", "permission", name="uq_user_permissions_user_permission"),)

    id:         Mapped[int]  = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]  = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="CASCADE"), nullable=False)
    permission: Mapped[str]  = mapped_column(String, nullable=False)
    enabled:    Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped[User] = relationship(back_populates="permissions")


# ───────────────────────────────────────────────────────────────────────────────
# DATA-PAGE MODELS (catalog + transactions + stock + import audit + exclusions)
# Shapes ported verbatim from apcm-pharma (column names, nullability, indexes).
# Dates stored as VARCHAR ISO strings (e.g. "2024-01-15") for the Sobrus import
# pipeline — that's deliberate, ISO strings sort lexicographically so BETWEEN
# queries still work. PG-013/PG-007 invariants land in the queries, not here.
# ───────────────────────────────────────────────────────────────────────────────

class Medicament(Base):
    """Global product catalog. One row per unique PID (Sobrus product id)."""
    __tablename__ = "medicaments"
    __table_args__ = (Index("ix_medicament_category", "category"),)

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True)
    pid:          Mapped[str]            = mapped_column(String, nullable=False, unique=True, index=True)
    product:      Mapped[str]            = mapped_column(String, nullable=False)
    tva:          Mapped[str | None]     = mapped_column(String, nullable=True)
    pph:          Mapped[float | None]   = mapped_column(Float, nullable=True)        # purchase price (catalog)
    ppv:          Mapped[float | None]   = mapped_column(Float, nullable=True)        # selling price
    category:     Mapped[str | None]     = mapped_column(String, nullable=True)
    zone:         Mapped[str | None]     = mapped_column(String, nullable=True)
    barcode1:     Mapped[str | None]     = mapped_column(String, nullable=True)
    barcode2:     Mapped[str | None]     = mapped_column(String, nullable=True)
    laboratoire:  Mapped[str | None]     = mapped_column(String, nullable=True)
    product_type: Mapped[str | None]     = mapped_column(String, nullable=True)       # pharmacie | parapharmacie | None
    created_at:   Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:   Mapped[datetime | None]= mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)


class ImportBatch(Base):
    """Per-import audit row. Drives the Imports tab and cascade-delete UX.

    Status semantics (Page 2 audit, Decision 1):
      - "in_progress" → first chunk inserted; later chunks haven't flipped it yet
      - "success"     → finished cleanly. Default for backward-compat with one-shot
                        CSV uploads that existed before the chunked extension flow.
      - "cancelled"   → user cancelled mid-upload (page wizard or extension)
      - "error"       → unexpected failure; error_message carries the reason
    """
    __tablename__ = "import_batches"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True)
    pharmacy_id:   Mapped[int]      = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    file_type:     Mapped[str]      = mapped_column(String, nullable=False)         # achat | vente | stock
    filename:      Mapped[str | None] = mapped_column(String, nullable=True)
    rows_inserted: Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    rows_skipped:  Mapped[int]      = mapped_column(Integer, default=0, nullable=False)
    status:        Mapped[str]      = mapped_column(String, nullable=False, default="success")
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    imported_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Achat(Base):
    """One line on a purchase delivery note (Bon de Livraison)."""
    __tablename__ = "achats"
    __table_args__ = (Index("ix_achat_pharmacy_date", "pharmacy_id", "delivery_date"),)

    id:                Mapped[int]         = mapped_column(Integer, primary_key=True)
    pharmacy_id:       Mapped[int | None]  = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=True, index=True)
    medicament_id:     Mapped[int | None]  = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=True, index=True)
    import_batch_id:   Mapped[int | None]  = mapped_column(Integer, ForeignKey(FK_IMPORT_BATCHES_ID), nullable=True, index=True)
    created_at_source: Mapped[str | None]  = mapped_column(String, nullable=True)
    delivery_date:     Mapped[str | None]  = mapped_column(String, nullable=True)
    delivery_ref:      Mapped[str | None]  = mapped_column(String, nullable=True)
    supplier:          Mapped[str | None]  = mapped_column(String, nullable=True)
    quantity:          Mapped[float | None]= mapped_column(Float, nullable=True)
    unit_price:        Mapped[float | None]= mapped_column(Float, nullable=True)
    expiry_date:       Mapped[str | None]  = mapped_column(String, nullable=True)
    stock_min:         Mapped[float | None]= mapped_column(Float, nullable=True)
    stock_max:         Mapped[float | None]= mapped_column(Float, nullable=True)
    total:             Mapped[float | None]= mapped_column(Float, nullable=True)
    uploaded_at:       Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())

    medicament: Mapped[Medicament | None] = relationship()


class Vente(Base):
    """One line on a sales transaction."""
    __tablename__ = "ventes"
    __table_args__ = (Index("ix_vente_pharmacy_date", "pharmacy_id", "date"),)

    id:              Mapped[int]         = mapped_column(Integer, primary_key=True)
    pharmacy_id:     Mapped[int | None]  = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=True, index=True)
    medicament_id:   Mapped[int | None]  = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=True, index=True)
    import_batch_id: Mapped[int | None]  = mapped_column(Integer, ForeignKey(FK_IMPORT_BATCHES_ID), nullable=True, index=True)
    date:            Mapped[str | None]  = mapped_column(String, nullable=True)
    transaction_ref: Mapped[str | None]  = mapped_column(String, nullable=True)
    client:          Mapped[str | None]  = mapped_column(String, nullable=True)
    quantity:        Mapped[float | None]= mapped_column(Float, nullable=True)
    discount:        Mapped[float | None]= mapped_column(Float, nullable=True)         # "Remise" (percentage value)
    unit_price:      Mapped[float | None]= mapped_column(Float, nullable=True)
    total:           Mapped[float | None]= mapped_column(Float, nullable=True)
    uploaded_at:     Mapped[datetime]    = mapped_column(DateTime(timezone=True), server_default=func.now())

    medicament: Mapped[Medicament | None] = relationship()


class PharmacyStock(Base):
    """Per-pharmacy product stock snapshot. Updated by `/uploads/stock`."""
    __tablename__ = "pharmacy_stock"
    __table_args__ = (UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_stock"),)

    id:            Mapped[int]            = mapped_column(Integer, primary_key=True)
    pharmacy_id:   Mapped[int]            = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    medicament_id: Mapped[int]            = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=False, index=True)
    current_stock: Mapped[int]            = mapped_column(Integer, default=0, nullable=False)
    stock_min:     Mapped[int | None]     = mapped_column(Integer, nullable=True)
    stock_max:     Mapped[int | None]     = mapped_column(Integer, nullable=True)
    expiry_date:   Mapped[date | None]    = mapped_column(Date, nullable=True)
    zone:          Mapped[str | None]     = mapped_column(String, nullable=True)
    imported_at:   Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now())


class PharmacyMedicamentStatus(Base):
    """Per-pharmacy non-declared (= 'spécial') flag. Row with declared=False
    ⇒ medicament excluded from this pharmacy's stats. Absence of row ⇒ declared
    (included). Owner-managed directly via /v1/special-products — no admin
    approval needed (per 2026-06-23 product decision)."""
    __tablename__ = "pharmacy_medicament_status"
    __table_args__ = (UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_medicament"),)

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True)
    pharmacy_id:   Mapped[int]      = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False)
    medicament_id: Mapped[int]      = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=False)
    declared:      Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CategorySuffix(Base):
    """Global mapping: normalized category name → (suffix string, color key).

    Drives the SuffixBadge displayed next to a Vente's transaction_ref. Owner-
    managed via /v1/category-suffixes CRUD; lookup is a single in-memory map
    keyed on `strip_percentage(category).lower()` so collation differences
    between Sobrus CSVs and the table don't cause misses.

    color is a token key (teal | blue | purple | amber | rose | emerald |
    orange | pink). Frontend maps to CSS via --color-suffix-{color}.
    """
    __tablename__ = "category_suffixes"

    id:         Mapped[int]        = mapped_column(Integer, primary_key=True)
    category:   Mapped[str]        = mapped_column(String, nullable=False, unique=True)
    suffix:     Mapped[str]        = mapped_column(String, nullable=False)
    color:      Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())


class PharmacyBlExclusion(Base):
    """A delivery_ref excluded from a pharmacy's stats / marges / accounting.
    PG-007 (achats half): Achat rows with this ref disappear from every aggregate
    via achat_bl_filter(). NULL refs are preserved (SQL NOT IN-vs-NULL gotcha)."""
    __tablename__ = "pharmacy_bl_exclusions"
    __table_args__ = (UniqueConstraint("pharmacy_id", "delivery_ref", name="uq_pharmacy_bl"),)

    id:           Mapped[int]      = mapped_column(Integer, primary_key=True)
    pharmacy_id:  Mapped[int]      = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    delivery_ref: Mapped[str]      = mapped_column(String, nullable=False, index=True)
    notes:        Mapped[str | None] = mapped_column(String, nullable=True)
    created_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PaymentEntry(Base):
    """Manual monthly bookkeeping per payment method (TPE / Espèces / Chèques /
    Virement). Doesn't come from Sobrus — owner enters totals + transaction
    count for each (month, method) pair. Upsert by (pharmacy_id, month, method).
    Surfaced on the /comptabilité page."""
    __tablename__ = "payment_entries"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "month", "method", name="uq_payment_entries_pharmacy_month_method"),
        Index("ix_payment_entries_pharmacy_month", "pharmacy_id", "month"),
    )

    id:                   Mapped[int]      = mapped_column(Integer, primary_key=True)
    pharmacy_id:          Mapped[int]      = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    month:                Mapped[str]      = mapped_column(String, nullable=False)        # "YYYY-MM"
    method:               Mapped[str]      = mapped_column(String, nullable=False)        # one of PAYMENT_METHODS
    pharmacie_amount:     Mapped[float]    = mapped_column(Float, nullable=False, default=0.0)
    parapharmacie_amount: Mapped[float]    = mapped_column(Float, nullable=False, default=0.0)
    count:                Mapped[int]      = mapped_column(Integer, nullable=False, default=0)
    created_at:           Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:           Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())