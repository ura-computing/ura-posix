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
    "labels",  # premium: « Étiquette » on the product page
    "orders",  # premium: « Commander » on the product page
)
# Premium: a new pharmacy gets them OFF (the admin switches them on); every other feature ON. Users always get the
# permission, so the pharmacy switch alone decides.
PREMIUM_FEATURES = ("labels", "orders")
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
    file_type: Mapped[str] = mapped_column(String, nullable=False)  # achat | vente | stock
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    updated_by: Mapped[int | None] = mapped_column(Integer, ForeignKey(FK_USERS_ID, ondelete="SET NULL"), nullable=True)


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
SOBRUS_RUN_MODES = ("full", "new", "check", "range", "products")
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
    # Admin « Importer les produits depuis Sobrus »: the last page an import cut before the end saved (None = none
    # cut, or the last one read the whole list): the next import resumes there.
    products_page: Mapped[int | None] = mapped_column(Integer, nullable=True)


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

STORE_REQUEST_STATES = ("soumise", "prise_en_charge", "en_cours", "livree", "cloturee")
STORE_URGENCIES = ("asap", "ce_mois", "flexible")


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
    urgency: Mapped[str] = mapped_column(String, nullable=False)  # STORE_URGENCIES
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


class StoreCustomization(Base):
    """Developer-authored styling state, 1:1 with a request. Created in the
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
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    font_pairing: Mapped[str] = mapped_column(String, nullable=False, default="moderne")
    featured_category_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # owner-managed later
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    request: Mapped[StoreWebsiteRequest] = relationship(back_populates="customization")
