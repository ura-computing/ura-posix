from datetime import datetime, date

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from app.core.database import Base


# FK target constants — avoid duplicating literals across mapped_column declarations.
FK_USERS_ID = "users.id"
FK_PHARMACIES_ID = "pharmacies.id"
FK_MEDICAMENTS_ID = "medicaments.id"
FK_IMPORT_BATCHES_ID = "import_batches.id"

PAYMENT_METHODS = ("tpe", "especes", "cheques", "virement")
SIGNUP_STATUSES = ("pending", "accepted", "refused")

ALLOWED_FEATURES = (
    "rapports",
    "import",
    "achats",
    "ventes",
    "stock",
    "analyse",
    "accounting",
    "alertes",
    "special_products",
    "produits",
    "sobrus",  # « Connexion Sobrus » (owners only, app/sobrus/)
    "labels",  # « Étiquette » on the product page (OFF for a new pharmacy)
    "orders",  # « Commander » on the product page (OFF for a new pharmacy)
    "damaged",  # « Stock abîmé »: boxes declared damaged (app/damaged/)
    "promis",  # « Promis »: products promised to a customer (app/promis/)
)
# A new pharmacy gets these OFF (the admin switches them on); every other feature ON. Users always get the
# permission, so the pharmacy switch alone decides.
OFF_BY_DEFAULT = ("labels", "orders")
# Same rule as migrations 0009 / 0016, so a fresh DB (create_all) rejects unknown features too.
_FEATURES_SQL = "(" + ", ".join(f"'{f}'" for f in ALLOWED_FEATURES) + ")"


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    code: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Soft-delete marker. NULL = active, timestamp = archived. Admin can restore
    # by clearing the value. Related transactions/stock/payments stay linked.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The Sobrus account of this pharmacy, set by its first « Connexion Sobrus » and kept after a disconnect: a new
    # connection must use it (what was imported belongs to that account). Only the admin clears it.
    sobrus_email: Mapped[str | None] = mapped_column(String, nullable=True)

    features: Mapped[list["PharmacyFeature"]] = relationship(back_populates="pharmacy", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    pharmacy_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID), nullable=True)
    reset_token: Mapped[str | None] = mapped_column(String, nullable=True)  # SHA-256 hash of the raw token
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Lock screen: after `lock_seconds` without a click or a key, the screen locks; the 6-digit code (hashed like the
    # password) unlocks it. `lock_failed`: wrong codes in a row (5 → logged out).
    lock_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lock_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=300)
    lock_pin_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    lock_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    pharmacy: Mapped[Pharmacy | None] = relationship()
    permissions: Mapped[list["UserPermission"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="CASCADE"), nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    device_label: Mapped[str | None] = mapped_column(String, nullable=True)
    ip: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Lock screen on: every API call of this session answers 423 `screenLocked` until the code is typed.
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SignupRequest(Base):
    """« Créer un compte » (/auth/signup), waiting for the admin's « Accepter » / « Refuser ».
    An email without an account also gets a `pending` user (no pharmacy, no permission): it logs
    in and sees an empty menu until « Accepter ». `pharmacy_code` set = join that pharmacy; else
    `pharmacy_name` + `pharmacy_city` (+ address) = a new one."""

    __tablename__ = "signup_requests"
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'employee')", name="ck_signup_requests_role"),
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in SIGNUP_STATUSES) + ")", name="ck_signup_requests_status"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    pharmacy_code: Mapped[str | None] = mapped_column(String, nullable=True)
    pharmacy_name: Mapped[str | None] = mapped_column(String, nullable=True)
    pharmacy_city: Mapped[str | None] = mapped_column(String, nullable=True)
    pharmacy_address: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)
    # The account: `pending` from the sign-up (email free then), active after « Accepter ».
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)


class PharmacyFeature(Base):
    __tablename__ = "pharmacy_features"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "feature", name="uq_pharmacy_features_pharmacy_feature"),
        CheckConstraint(f"feature IN {_FEATURES_SQL}", name="ck_pharmacy_features_feature"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    feature: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    pharmacy: Mapped[Pharmacy] = relationship(back_populates="features")


class UserPermission(Base):
    __tablename__ = "user_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "permission", name="uq_user_permissions_user_permission"),
        CheckConstraint(f"permission IN {_FEATURES_SQL}", name="ck_user_permissions_permission"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="CASCADE"), nullable=False)
    permission: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

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
    __table_args__ = (
        Index("ix_medicament_category", "category"),
        # Mirrors migration 0019's expression index (same name — keeps a
        # fresh `create_all()` bootstrap and an `alembic upgrade` on an
        # existing DB converging on identical schema). Must stay byte-for-
        # byte in sync with csv_parse._normalized_name_expr(), or Postgres
        # won't match this index to that query and falls back to a full
        # scan of this cross-pharmacy-shared table. Needs immutable_unaccent()
        # to already exist — see bootstrap.py / conftest.py.
        Index(
            "ix_medicaments_normalized_name",
            text("lower(regexp_replace(trim(immutable_unaccent(product)), '\\s+', ' ', 'g'))"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pid: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    product: Mapped[str] = mapped_column(String, nullable=False)
    tva: Mapped[str | None] = mapped_column(String, nullable=True)
    pph: Mapped[float | None] = mapped_column(Float, nullable=True)  # purchase price (catalog)
    ppv: Mapped[float | None] = mapped_column(Float, nullable=True)  # selling price
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    zone: Mapped[str | None] = mapped_column(String, nullable=True)
    barcode1: Mapped[str | None] = mapped_column(String, nullable=True)
    barcode2: Mapped[str | None] = mapped_column(String, nullable=True)
    laboratoire: Mapped[str | None] = mapped_column(String, nullable=True)
    # From Sobrus' product list (admin « Produits Sobrus »): the active substance, the galenic form (« Comprimé »).
    dci: Mapped[str | None] = mapped_column(String, nullable=True)
    galenic_form: Mapped[str | None] = mapped_column(String, nullable=True)
    product_type: Mapped[str | None] = mapped_column(String, nullable=True)  # pharmacie | parapharmacie | None
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)


class ProductInfo(Base):
    """Photos + description scraped from parapharmacy shops (`backend/data/product_infos.json`).
    Global and read-only: `scripts/load_product_infos.py` replaces every row at each start.
    A product finds its row when shown (« Produits »): same PID first, then a same barcode."""

    __tablename__ = "product_infos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # file priority: the lower id wins a shared code
    pid: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    barcode1: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    barcode2: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    brand: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)  # the shop's, e.g. « Soins visage »
    images: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # photo URLs, best first
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # [{label: « Gamme », value}, …]
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)


class ImportBatch(Base):
    """Per-import audit row. Drives the Imports tab and cascade-delete UX.

    Status semantics (Page 2 audit, Decision 1):
      - "in_progress" → first chunk inserted; later chunks haven't flipped it yet
      - "success"     → finished cleanly. Default for backward-compat with one-shot
                        CSV uploads that existed before the chunked extension flow.
      - "cancelled"   → user cancelled mid-upload (page wizard or Sobrus robot)
      - "error"       → unexpected failure; error_message carries the reason
    """

    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    file_type: Mapped[str] = mapped_column(String, nullable=False)  # achat | vente | stock | closing | returns
    filename: Mapped[str | None] = mapped_column(String, nullable=True)
    rows_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="success")
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Newest chunk received (migration 0020): no chunk for 1 min while `in_progress` = interrupted.
    last_chunk_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Audit columns added in migration 0014. Soft-delete: a non-NULL `deleted_at`
    # marks the batch as removed but keeps the row visible on /imports as history.
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True, index=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True
    )


class Achat(Base):
    """One line on a purchase delivery note (Bon de Livraison)."""

    __tablename__ = "achats"
    __table_args__ = (Index("ix_achat_pharmacy_date", "pharmacy_id", "delivery_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=True, index=True)
    medicament_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=True, index=True)
    import_batch_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_IMPORT_BATCHES_ID), nullable=True, index=True
    )
    created_at_source: Mapped[str | None] = mapped_column(String, nullable=True)
    delivery_date: Mapped[str | None] = mapped_column(String, nullable=True)
    delivery_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    supplier: Mapped[str | None] = mapped_column(String, nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    expiry_date: Mapped[str | None] = mapped_column(String, nullable=True)
    stock_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    stock_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    total: Mapped[float | None] = mapped_column(Float, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    medicament: Mapped[Medicament | None] = relationship()


class Vente(Base):
    """One line on a sales transaction."""

    __tablename__ = "ventes"
    __table_args__ = (Index("ix_vente_pharmacy_date", "pharmacy_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=True, index=True)
    medicament_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=True, index=True)
    import_batch_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_IMPORT_BATCHES_ID), nullable=True, index=True
    )
    date: Mapped[str | None] = mapped_column(String, nullable=True)
    transaction_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    client: Mapped[str | None] = mapped_column(String, nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    discount: Mapped[float | None] = mapped_column(Float, nullable=True)  # "Remise" (percentage value)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    total: Mapped[float | None] = mapped_column(Float, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    medicament: Mapped[Medicament | None] = relationship()


class PharmacyStock(Base):
    """Per-pharmacy product stock snapshot. Updated by `/uploads/stock`. `import_batch_id` =
    the stock import that wrote the row last: deleting / cancelling that import removes it."""

    __tablename__ = "pharmacy_stock"
    __table_args__ = (UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_stock"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    medicament_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=False, index=True)
    current_stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stock_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stock_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    zone: Mapped[str | None] = mapped_column(String, nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    import_batch_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_IMPORT_BATCHES_ID, ondelete="SET NULL"), nullable=True, index=True
    )


class PharmacyProductEdit(Base):
    """A pharmacy's own values for one product: the owner's « Modifier » on the product sheet.
    Shown in « Produits » only (Rapport, Stock, Comptabilité keep the imported values). NULL =
    not edited. Imports never write here, so a hand edit stays until « Revenir à la valeur
    importée ». The type (pharmacie / parapharmacie) is not editable. Deleted with the
    pharmacy or the product (CASCADE)."""

    __tablename__ = "pharmacy_product_edits"
    __table_args__ = (UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_product_edit"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False, index=True
    )
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), nullable=False, index=True
    )
    product: Mapped[str | None] = mapped_column(String, nullable=True)
    laboratoire: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)  # its text only: the type stays the catalogue's
    tva: Mapped[str | None] = mapped_column(String, nullable=True)
    ppv: Mapped[float | None] = mapped_column(Float, nullable=True)
    pph: Mapped[float | None] = mapped_column(Float, nullable=True)
    zone: Mapped[str | None] = mapped_column(String, nullable=True)
    current_stock: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stock_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stock_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    barcode1: Mapped[str | None] = mapped_column(String, nullable=True)
    barcode2: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    # « Remise comptoir » (%): the owner's discount at the counter, shown in « Promis ». No imported value.
    counter_discount: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)


# « À traiter » → « Rendu au fournisseur » / « Détruit »; « Remis en vente » = declared by mistake (back to stock).
DAMAGE_STATUSES = ("pending", "returned", "destroyed", "back_on_sale")


class StockDamage(Base):
    """« Boîtes abîmées »: boxes the pharmacy declared damaged. Sobrus keeps counting them forever, so PharmaGest takes
    them off its free stock forever (returned, destroyed too); only « Remis en vente » gives them back."""

    __tablename__ = "stock_damages"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_damages_quantity"),
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in DAMAGE_STATUSES) + ")", name="ck_stock_damages_status"
        ),
        Index("ix_stock_damages_pharmacy_medicament", "pharmacy_id", "medicament_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)
    created_by_name: Mapped[str] = mapped_column(String, nullable=False)  # kept if the account is deleted
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# Créé → (À commander) → Commandé → Reçu → Prêt (reserved, 7 days) → Retiré; Reçu → Incident → Commandé;
# Prêt → Expiré (7 days passed) → Rendu au stock; any state before Retiré → Annulé.
PROMIS_STATES = (
    "created",
    "to_order",
    "ordered",
    "received",
    "incident",
    "ready",
    "picked_up",
    "expired",
    "returned",
    "cancelled",
)


class Customer(Base):
    """A customer of one pharmacy (Promis): name, phone (+212…), whether WhatsApp messages are OK."""

    __tablename__ = "customers"
    __table_args__ = (Index("ix_customers_pharmacy_name", "pharmacy_id", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    whatsapp_ok: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Promis(Base):
    """« Promis »: what a customer asked for that the pharmacy could not give at once, followed until the customer
    takes it (`PROMIS_STATES`). `number` counts per pharmacy (« Promis n° 42 »); `pickup_deadline` = 7 days after
    « Prêt », fixed. Every change is a `PromisEvent`."""

    __tablename__ = "promis"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "number", name="uq_promis_pharmacy_number"),
        CheckConstraint("state IN (" + ", ".join(f"'{s}'" for s in PROMIS_STATES) + ")", name="ck_promis_state"),
        Index("ix_promis_pharmacy_state", "pharmacy_id", "state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False, default="created")
    unreachable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # « client injoignable »
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pickup_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)
    created_by_name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)


class PromisLine(Base):
    """One product of a Promis: from the catalogue (`medicament_id`) or typed (`name` only); `reserved_qty` = boxes
    kept for the customer while « Prêt »; `shelf_place` = where the box waits (« tiroir B »)."""

    __tablename__ = "promis_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_promis_lines_quantity"),
        Index("ix_promis_lines_medicament", "medicament_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    promis_id: Mapped[int] = mapped_column(Integer, ForeignKey("promis.id", ondelete="CASCADE"), nullable=False)
    medicament_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    shelf_place: Mapped[str | None] = mapped_column(String, nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)  # PPV at creation
    counter_discount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # % at creation


class PromisEvent(Base):
    """One step of a Promis (never edited): from → to, who, why."""

    __tablename__ = "promis_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    promis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("promis.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_state: Mapped[str | None] = mapped_column(String, nullable=True)
    to_state: Mapped[str] = mapped_column(String, nullable=False)
    actor_name: Mapped[str] = mapped_column(String, nullable=False)  # « Robot » for the automatic J+7 expiry
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


PROMIS_MESSAGE_KINDS = ("created", "ready", "reminder", "returned")


class PromisMessage(Base):
    """One WhatsApp message a person sent to the customer of a promis (« Envoyer sur WhatsApp »): the dashboard
    lists the ones still due today. `reminder`: from 2 days before the pickup deadline, once a day."""

    __tablename__ = "promis_messages"
    __table_args__ = (
        CheckConstraint(
            "kind IN (" + ", ".join(f"'{k}'" for k in PROMIS_MESSAGE_KINDS) + ")", name="ck_promis_messages_kind"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    promis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("promis.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)
    sent_by_name: Mapped[str] = mapped_column(String, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ProductNote(Base):
    """« Observations »: a pharmacy's notes on one product (« à vendre avec … »), shown in a window
    when its page opens. Anyone with Produits adds one; its author or the owner deletes it (the
    history keeps its text). `author_name` stays if the account is deleted."""

    __tablename__ = "product_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False, index=True
    )
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)
    author_name: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Notification(Base):
    """One line of a user's bell (top bar). `kind` + `params` → the text (`notifications.<kind>` in fr.ts / es.ts),
    `link` → the page it opens. Kinds that are a running count (« 12 produits à classer ») keep ONE unread line per
    user, updated in place (`app/notifications/service.py`)."""

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    link: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    """« Historique des modifications »: who changed what in a pharmacy, kept as proof — never edited
    or deleted. `action` = a code the page translates (`history.<action>`), `details` = its values
    (file, field before → after, note text…). `user_name` stays if the account is deleted."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_pharmacy_created", "pharmacy_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)
    user_name: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    medicament_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="SET NULL"), nullable=True, index=True
    )
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


SOBRUS_CONNECTION_STATUSES = ("active", "needs_login", "invalid")
SOBRUS_RUN_MODES = ("full", "new", "check", "range", "products", "suppliers")
# The admin's runs (Catalogue « Produits Sobrus », « Fournisseurs »): one owner's account, the next one if refused.
SOBRUS_ADMIN_MODES = ("products", "suppliers")
SOBRUS_RUN_STATUSES = ("queued", "running", "success", "error", "cancelled")


class SobrusConnection(Base):
    """« Connexion Sobrus »: the owner's Sobrus login, so the worker (`app/sobrus/worker.py`) imports
    the pharmacy's achats + ventes by itself. Password and Sobrus session cookies are encrypted
    (`SOBRUS_SECRET_KEY`, `app/sobrus/crypto.py`) and never sent back. `invalid` = Sobrus refused the
    password (never retried until the owner types a new one); `needs_login` = Sobrus asks a check."""

    __tablename__ = "sobrus_connections"
    __table_args__ = (
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in SOBRUS_CONNECTION_STATUSES) + ")",
            name="ck_sobrus_connections_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False, unique=True
    )
    email: Mapped[str] = mapped_column(String, nullable=False)
    password_enc: Mapped[str] = mapped_column(String, nullable=False)
    session_enc: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_code: Mapped[str | None] = mapped_column(String, nullable=True)
    # The owner was emailed about the current problem (once per problem); failed nights in a row.
    problem_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_nights: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # « Clôture de caisse » report: None = not tried yet, False = this Sobrus account may not read it (only the
    # owner's login can), True = read at the last run.
    closing_access: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # « Retours clients (avoirs) » (`/salesreturns`): same meaning as `closing_access`.
    returns_access: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Admin « Importer les produits depuis Sobrus »: the last page an import cut before the end saved (None = none
    # cut, or the last one read the whole list): the next import resumes there.
    products_page: Mapped[int | None] = mapped_column(Integer, nullable=True)


class SobrusImportedYear(Base):
    """A past year of achats or ventes the Sobrus robot imported in full: the next imports skip it (« déjà importé »),
    unless « Réimporter quand même ». Removed when an import of that year is deleted (« Gestion des imports ») or the
    admin changes the pharmacy's Sobrus email."""

    __tablename__ = "sobrus_imported_years"
    __table_args__ = (UniqueConstraint("pharmacy_id", "kind", "year", name="uq_sobrus_imported_years"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # achat | vente
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    batch_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class SobrusCashClosing(Base):
    """Sobrus' « Clôture de caisse » of one day (report `cashdeskclosing`, read by the worker at every run): the
    sales, paid / unpaid, credit, returns, net; `by_method` = {sobrus code: {label, cash_sales, settlements,
    advances, expenses, other}}; `by_customer` = [{name, credit, balance}] (credit sales of the day). One row per
    pharmacy and day, replaced at each fetch. Shown read-only in Comptabilité."""

    __tablename__ = "sobrus_cash_closings"
    __table_args__ = (UniqueConstraint("pharmacy_id", "day", name="uq_sobrus_cash_closings_pharmacy_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    invoices: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    paid: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    unpaid: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    discount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cash_sales: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    credit_sales: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    unpaid_credit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    returns: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    net: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    gross_total: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    by_method: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    by_customer: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class SobrusSalesReturn(Base):
    """One Sobrus « Retour client » (avoir, `RV-7162`), read by the worker at every run (`/salesreturns`): its day,
    customer, how the money went back (« Restituer en argent »), status, amount, and its products
    [{name, quantity, unit_price}] (read once, from its sheet). One row per pharmacy and return, replaced at each
    fetch. Shown read-only in Comptabilité."""

    __tablename__ = "sobrus_sales_returns"
    __table_args__ = (
        UniqueConstraint("pharmacy_id", "sobrus_id", name="uq_sobrus_sales_returns_pharmacy_sobrus"),
        Index("ix_sobrus_sales_returns_pharmacy_day", "pharmacy_id", "day"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    sobrus_id: Mapped[str] = mapped_column(String, nullable=False)
    number: Mapped[str] = mapped_column(String, nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    customer: Mapped[str | None] = mapped_column(String, nullable=True)
    refund: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str | None] = mapped_column(String, nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    products: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class SobrusRun(Base):
    """One run of the Sobrus robot: `full` = every year back to the pharmacy's start, `new` = the last
    days (every night), `check` = login test only, `range` = the owner's dates (`date_from` →
    `date_to`, year by year). The page follows it live: `phase` + the counters,
    and `events` = each step done (« Connexion à Sobrus », « Ventes 2026 : 12 345 lignes »…). One
    queued / running run per pharmacy (partial unique index)."""

    __tablename__ = "sobrus_runs"
    __table_args__ = (
        CheckConstraint("mode IN (" + ", ".join(f"'{m}'" for m in SOBRUS_RUN_MODES) + ")", name="ck_sobrus_runs_mode"),
        CheckConstraint(
            "status IN (" + ", ".join(f"'{s}'" for s in SOBRUS_RUN_STATUSES) + ")", name="ck_sobrus_runs_status"
        ),
        Index(
            "uq_sobrus_runs_active",
            "pharmacy_id",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
        Index("ix_sobrus_runs_pharmacy_created", "pharmacy_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    mode: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="queued")
    cancel_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    force_reimport: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # « Réimporter quand même »
    date_from: Mapped[date | None] = mapped_column(Date, nullable=True)  # mode `range` only
    date_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Now: login | download | import (+ kind / year), with its counters.
    phase: Mapped[str | None] = mapped_column(String, nullable=True)
    kind: Mapped[str | None] = mapped_column(String, nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bytes_received: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_current: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lines_added: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    events: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # [{at, code, kind?, year?, n?}]
    error_code: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Written at every step while running: silent 10 min = its robot stopped (app/sobrus/worker.py).
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PharmacyMedicamentStatus(Base):
    """Per-pharmacy non-declared (= 'spécial') flag. Row with declared=False
    ⇒ medicament excluded from this pharmacy's stats. Absence of row ⇒ declared
    (included). Owner-managed directly via /v1/special-products — no admin
    approval needed (per 2026-06-23 product decision)."""

    __tablename__ = "pharmacy_medicament_status"
    __table_args__ = (UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_medicament"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False)
    medicament_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_MEDICAMENTS_ID), nullable=False)
    declared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)  # the owner's reason (« Ajouter une note »)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    suffix: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PharmacyBlExclusion(Base):
    """A delivery_ref the pharmacy excluded. In Comptabilité only, every product
    on that BL drops from ventes and achats (exclusions.py)."""

    __tablename__ = "pharmacy_bl_exclusions"
    __table_args__ = (UniqueConstraint("pharmacy_id", "delivery_ref", name="uq_pharmacy_bl"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    delivery_ref: Mapped[str] = mapped_column(String, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PharmacyBlLineExclusion(Base):
    """One product's lines on one BL the pharmacy excluded (« Exclure un produit d'un BL »: the same
    product bought on several BLs, only some of them left out). In Comptabilité only, those achat
    lines drop; the product's other BLs and all its ventes stay (exclusions.py)."""

    __tablename__ = "pharmacy_bl_line_exclusions"
    __table_args__ = (UniqueConstraint("pharmacy_id", "delivery_ref", "medicament_id", name="uq_pharmacy_bl_line"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    delivery_ref: Mapped[str] = mapped_column(String, nullable=False)
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


SUPPLIER_KINDS = ("laboratoire", "grossiste", "societe")
# How the pharmacy orders from it: téléphone, fax, e-mail, WhatsApp, EDI, the lab's delegate.
ORDER_CHANNELS = ("phone", "fax", "email", "whatsapp", "edi", "delegate")


class Supplier(Base):
    """« Fournisseurs »: one list shared by every pharmacy (laboratoires, grossistes, sociétés). Filled from Sobrus'
    supplier directory (run mode `suppliers`); same name = same supplier (`name_key` = `csv_parse.normalized_name`)."""

    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint(
            "kind IS NULL OR kind IN (" + ", ".join(f"'{k}'" for k in SUPPLIER_KINDS) + ")", name="ck_suppliers_kind"
        ),
        CheckConstraint(
            "order_channel IS NULL OR order_channel IN (" + ", ".join(f"'{c}'" for c in ORDER_CHANNELS) + ")",
            name="ck_suppliers_order_channel",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    name_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    kind: Mapped[str | None] = mapped_column(String, nullable=True)
    sobrus_id: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    # What ordering needs (typed by the admin; Sobrus gives none of it). None = « inconnu » on the screen.
    contact_name: Mapped[str | None] = mapped_column(String, nullable=True)
    order_channel: Mapped[str | None] = mapped_column(String, nullable=True)  # ORDER_CHANNELS
    delivery_days: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["mon", "thu"]
    cutoff_time: Mapped[str | None] = mapped_column(
        String, nullable=True
    )  # « 11:00 »: order before, delivered next day
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(String, nullable=True)  # « chèque comptant », « 60 jours »
    transport_fee: Mapped[float | None] = mapped_column(Float, nullable=True)  # MAD per order
    free_transport_from: Mapped[float | None] = mapped_column(Float, nullable=True)  # MAD: no fee from this amount
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now(), nullable=True)


CONDITION_KINDS = (
    "minimum_order",  # « Commande minimum : 5 000 MAD » (basis + value)
    "qty_tiers",  # « Dès 100 unités : 20 % · dès 200 : 23 % » (tiers on units)
    "amount_tiers",  # « Dès 4 000 MAD : 7 % » (tiers on MAD)
    "product_discount",  # « Remise : 10 % » (value)
    "pack",  # « 36 achetées + 6 offertes » (value = bought, days unused, tiers unused, text = how)
    "payment_discount",  # « Escompte 2 % si payé sous 60 jours » (value %, days)
    "transport",  # « Transport offert dès 1 500 MAD » (value MAD)
    "packaging",  # « Par multiple de 12 (colisage) » (value)
    "return_rule",  # « Ni repris ni échangés » (text)
)
CONDITION_STATES = ("confirmed", "unverified", "missing")  # « Confirmée », « À vérifier », « Manquante »
CONDITION_BASES = ("units", "mad", "references")


class SupplierCondition(Base):
    """One commercial rule of a supplier, the same for every pharmacy (typed by the admin). Its products: the exact
    list in `condition_products` (none = every product of the supplier). « À vérifier » rules are shown, never applied
    by the engine. Every change: a new `version`, the old one in `condition_history`. Deleted = `deleted_at`."""

    __tablename__ = "supplier_conditions"
    __table_args__ = (
        CheckConstraint(
            "kind IN (" + ", ".join(f"'{k}'" for k in CONDITION_KINDS) + ")", name="ck_supplier_conditions_kind"
        ),
        CheckConstraint(
            "state IN (" + ", ".join(f"'{s}'" for s in CONDITION_STATES) + ")", name="ck_supplier_conditions_state"
        ),
        CheckConstraint(
            "basis IS NULL OR basis IN (" + ", ".join(f"'{b}'" for b in CONDITION_BASES) + ")",
            name="ck_supplier_conditions_basis",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)
    basis: Mapped[str | None] = mapped_column(String, nullable=True)
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tiers: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{"from": 100, "pct": 20}, …], ascending
    text: Mapped[str | None] = mapped_column(String, nullable=True)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    state: Mapped[str] = mapped_column(String, nullable=False, default="unverified")
    source: Mapped[str | None] = mapped_column(String, nullable=True)  # « Board 2024 », a document's name
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_by_name: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ConditionProduct(Base):
    """A product a condition covers (ticked by the admin: never « all the lab »)."""

    __tablename__ = "condition_products"

    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("supplier_conditions.id", ondelete="CASCADE"), primary_key=True
    )
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), primary_key=True
    )


class ConditionHistory(Base):
    """An old version of a condition (never edited, never deleted): what it said, who changed it, when."""

    __tablename__ = "condition_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    condition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("supplier_conditions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    changed_by_name: Mapped[str] = mapped_column(String, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PurchasingGroup(Base):
    """« Groupement »: pharmacies that buy together (their own conditions come later, when one is known)."""

    __tablename__ = "purchasing_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PurchasingGroupMember(Base):
    __tablename__ = "purchasing_group_members"

    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("purchasing_groups.id", ondelete="CASCADE"), primary_key=True
    )
    pharmacy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), primary_key=True
    )


ORDER_STATES = ("draft", "validated", "sent", "confirmed", "partial", "refused", "delivered", "cancelled")
ORDER_GROUPS = ("urgent", "restock", "promis", "check")  # « Urgences », « Réassort », « Promis », « À vérifier »


class PurchaseOrder(Base):
    """An order of the pharmacy to one supplier (`supplier_id` None = supplier unknown: « À vérifier »). « Commandes
    du jour »: the drafts, one per supplier, rebuilt by « Recalculer » (a quantity the person changed stays).
    « Valider »: `frozen` = the lines and the conditions applied that day, never changed after."""

    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint(
            "state IN (" + ", ".join(f"'{s}'" for s in ORDER_STATES) + ")", name="ck_purchase_orders_state"
        ),
        Index("ix_purchase_orders_pharmacy_state", "pharmacy_id", "state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    supplier_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    frozen: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_by_name: Mapped[str | None] = mapped_column(String, nullable=True)


class PurchaseOrderLine(Base):
    """One product of an order: `suggested` = what the calculation says, `quantity` = what will be ordered (`edited`:
    the person changed it, or added it from the product sheet: « Recalculer » keeps it)."""

    __tablename__ = "purchase_order_lines"
    __table_args__ = (
        UniqueConstraint("order_id", "medicament_id", name="uq_purchase_order_lines_product"),
        CheckConstraint("quantity > 0", name="ck_purchase_order_lines_quantity"),
        CheckConstraint(
            '"group" IN (' + ", ".join(f"'{g}'" for g in ORDER_GROUPS) + ")", name="ck_purchase_order_lines_group"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    suggested: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    group: Mapped[str] = mapped_column(String, nullable=False, default="restock")
    for_shelf: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    for_promis: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    customers: Mapped[list | None] = mapped_column(JSON, nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Float, nullable=True)  # PPH: last purchase price, else catalogue


class PharmacySupplierExclusion(Base):
    """A supplier (fournisseur) name the pharmacy excluded. In Comptabilité only,
    every product bought from it (accent/case-insensitive match) drops from ventes
    and achats (exclusions.py). Supplier is free text on Achat.supplier — there is
    no supplier entity."""

    __tablename__ = "pharmacy_supplier_exclusions"
    __table_args__ = (UniqueConstraint("pharmacy_id", "supplier", name="uq_pharmacy_supplier"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    supplier: Mapped[str] = mapped_column(String, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False)
    month: Mapped[str] = mapped_column(String, nullable=False)  # "YYYY-MM"
    method: Mapped[str] = mapped_column(String, nullable=False)  # one of PAYMENT_METHODS
    pharmacie_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    parapharmacie_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ─── "Ma boutique en ligne" — store website request + customization ─────────


class StoreWebsiteRequest(Base):
    """Owner's landing-page brief. Constraint at DB level: one active (non
    cloturee) request per pharmacy — enforced by a partial unique index in
    the migration."""

    __tablename__ = "store_website_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_PHARMACIES_ID), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey(FK_USERS_ID), nullable=False, index=True)

    # Brief content (owner-authored)
    store_name: Mapped[str] = mapped_column(String, nullable=False)
    slogan: Mapped[str | None] = mapped_column(String, nullable=True)
    brand_palette: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # ["#hex", ...] 2-3
    phone: Mapped[str] = mapped_column(String, nullable=False)
    custom_domain: Mapped[str | None] = mapped_column(String, nullable=True)
    vision: Mapped[str | None] = mapped_column(String, nullable=True)

    # Lifecycle
    state: Mapped[str] = mapped_column(String, nullable=False, default="soumise", index=True)
    claimed_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True, index=True
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    customization: Mapped["StoreCustomization | None"] = relationship(
        back_populates="request",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Store(Base):
    """A pharmacy's online store (one per pharmacy), created with its first request; lives on after it is delivered.
    What the request holds (name, logo, WhatsApp, colors) stays on the request; here: what makes the live site work
    and what the owner changes at any time (shown categories, products: `StoreProduct`, packs: `StorePack`).

    The site reaches our API with a secret key (its `.env`) from its domain only: only the key's hash is kept.
    Deleting the store deletes its key: the site gets no data any more."""

    __tablename__ = "stores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pharmacy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_PHARMACIES_ID, ondelete="CASCADE"), nullable=False, unique=True
    )
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("store_website_requests.id", ondelete="SET NULL"), nullable=True
    )
    domain: Mapped[str | None] = mapped_column(String, nullable=True)  # « pharmacie-exemple.ma », typed by Support
    key_hash: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)  # sha256 of the secret key
    key_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # null = every category shows; else only these names (« Soins visage », « Parapharmacie »…)
    shown_categories: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StoreProduct(Base):
    """The owner's choice for one product of the shelf: hidden from the site, and / or a promo price (MAD). A product
    without a row shows at its PPV."""

    __tablename__ = "store_products"
    __table_args__ = (UniqueConstraint("store_id", "medicament_id", name="uq_store_products"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_id: Mapped[int] = mapped_column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), nullable=False
    )
    hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    promo_price: Mapped[float | None] = mapped_column(Float, nullable=True)


class StorePack(Base):
    """A pack the owner makes from several products, sold together at one price (« Pack bébé : 3 produits, 199 MAD »)."""

    __tablename__ = "store_packs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    store_id: Mapped[int] = mapped_column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    items: Mapped[list["StorePackItem"]] = relationship(cascade="all, delete-orphan", order_by="StorePackItem.id")


class StorePackItem(Base):
    __tablename__ = "store_pack_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pack_id: Mapped[int] = mapped_column(Integer, ForeignKey("store_packs.id", ondelete="CASCADE"), nullable=False)
    medicament_id: Mapped[int] = mapped_column(
        Integer, ForeignKey(FK_MEDICAMENTS_ID, ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class StoreCustomization(Base):
    """Support-authored styling state, 1:1 with a request. Created in the
    same transaction as the request with defaults derived from the picked
    palette."""

    __tablename__ = "store_customizations"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("store_website_requests.id", ondelete="CASCADE"),
        primary_key=True,
    )
    template: Mapped[str] = mapped_column(String, nullable=False, default="lumiere")
    sections: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # { hero:{visible:true}, ... }
    brand_colors: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # { primary, secondary, accent }
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)  # GET /store-website/logo/{id}?v=…
    logo_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)  # the file, ≤ 2 MB
    logo_type: Mapped[str | None] = mapped_column(String, nullable=True)  # its content type, e.g. "image/png"
    font_pairing: Mapped[str] = mapped_column(String, nullable=False, default="moderne")
    featured_category_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # owner-managed later
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    request: Mapped[StoreWebsiteRequest] = relationship(back_populates="customization")
