"""Admin permission-management endpoints — backs the /admin/pharmacies pages.

Every endpoint requires admin role. Three-layer permission model (per locked
spec): admin manages OWNER permissions; employee permissions stay with the
owner (via /owner/employees, separate router — not in this push).

Pharmacy soft-delete: `DELETE` sets `archived_at`; list excludes archived
by default. Re-create with the same code/email is allowed because the
archived row is hidden from listings + the unique constraint applies only
to ACTIVE rows by convention (we don't clear the archived row's code, so a
unique-violation surfaces if admin tries to reuse — they can rename the
archived row first or restore it instead).

Member lifecycle (create / status / reset-password) + shared helpers live in
members/service.py (also used by owner_router.py); this router only does the admin
auth + lookup checks.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Path, Query
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import DbDep
from app.core.email_service import send_signup_decision
from app.core.errors import ApiError, ErrorCode
from app.identity.members.service import (
    activate_member,
    apply_permissions_bulk,
    add_pharmacy,
    create_member,
    granted_permissions_map,
    member_out,
    member_to_out,
    reset_member_password,
    set_member_status,
)
from app.core.models import (
    ALLOWED_FEATURES,
    Pharmacy,
    PharmacyFeature,
    SignupRequest,
    User,
    UserPermission,
)
from app.core.permissions import AdminDep, admin_only
from app.identity.members.schemas import (
    AdminUserRow,
    AssignPharmacyIn,
    CreateUserIn,
    CreateUserOut,
    FeaturesBulkSet,
    MemberOut,
    PermissionsBulkSet,
    PharmacyDetail,
    PharmacyIn,
    PharmacyListRow,
    ResetPasswordIn,
    ResetPasswordOut,
    SignupAcceptOut,
    SignupPharmacyRef,
    SignupRequestRow,
    StatusPatchIn,
    UserPharmacyRef,
)


router = APIRouter(tags=["admin-pharmacies"], dependencies=[admin_only])


# ── Helpers ──────────────────────────────────────────────────────────────────


def _enabled_features(db, pharmacy_id: int) -> list[str]:
    rows = (
        db.query(PharmacyFeature.feature)
        .filter(PharmacyFeature.pharmacy_id == pharmacy_id, PharmacyFeature.enabled.is_(True))
        .all()
    )
    return sorted({r[0] for r in rows})


def _initials(name: str | None, email: str) -> str:
    """Two-letter initials for the avatar stack. Falls back to email when no
    name is set."""
    src = (name or email.split("@", 1)[0]).strip()
    parts = src.split()
    if len(parts) >= 2:
        return (parts[0][:1] + parts[1][:1]).upper()
    return src[:2].upper()


def _get_pharmacy_or_404(db, pharmacy_id: int) -> Pharmacy:
    pharm = db.query(Pharmacy).filter(Pharmacy.id == pharmacy_id).first()
    if not pharm:
        raise ApiError(404, ErrorCode.PHARMACY_NOT_FOUND, "Pharmacie introuvable.")
    return pharm


def _apply_features_bulk(db, pharmacy_id: int, features: dict[str, bool]) -> None:
    """Upsert one PharmacyFeature row per key in `features`. Unknown keys are
    silently ignored (we trust the frontend to only send ALLOWED_FEATURES)."""
    existing = {
        f.feature: f for f in db.query(PharmacyFeature).filter(PharmacyFeature.pharmacy_id == pharmacy_id).all()
    }
    for key, enabled in features.items():
        if key not in ALLOWED_FEATURES:
            continue
        if key in existing:
            existing[key].enabled = bool(enabled)
        else:
            db.add(PharmacyFeature(pharmacy_id=pharmacy_id, feature=key, enabled=bool(enabled)))


def _get_member_or_404(db, user_id: int) -> User:
    """Target user by id, else 404. Callers add their own admin-role guard. A `pending`
    account (sign-up not accepted yet) is handled in « Demandes » only."""
    target = db.query(User).filter(User.id == user_id, User.status != "pending").first()
    if not target:
        raise ApiError(404, ErrorCode.USER_NOT_FOUND, "Utilisateur introuvable.")
    return target


# ── List + Detail ────────────────────────────────────────────────────────────


@router.get("/admin/pharmacies", response_model=list[PharmacyListRow])
def list_pharmacies(
    db: DbDep,
    include_archived: Annotated[bool, Query()] = False,
) -> list[PharmacyListRow]:
    """All pharmacies + members count + enabled-features summary. Archived
    rows are excluded by default."""
    q = db.query(Pharmacy)
    if not include_archived:
        q = q.filter(Pharmacy.archived_at.is_(None))
    pharmacies = q.order_by(Pharmacy.name).all()
    if not pharmacies:
        return []

    pharm_ids = [p.id for p in pharmacies]

    # Members per pharmacy (single query, group by pharmacy)
    member_counts: dict[int, int] = dict(
        db.query(User.pharmacy_id, func.count(User.id))
        .filter(User.pharmacy_id.in_(pharm_ids))
        .group_by(User.pharmacy_id)
        .all()
    )

    # First few members per pharmacy for the avatar-stack initials
    initials_map: dict[int, list[str]] = {pid: [] for pid in pharm_ids}
    members_for_initials = (
        db.query(User.pharmacy_id, User.name, User.email, User.role)
        .filter(User.pharmacy_id.in_(pharm_ids))
        .order_by(User.role.desc(), User.id.asc())  # owners first (role "owner" > "employee" alpha)
        .all()
    )
    for pid, name, email, _role in members_for_initials:
        if len(initials_map.get(pid, [])) < 4:
            initials_map.setdefault(pid, []).append(_initials(name, email))

    # Enabled features per pharmacy
    feat_rows = (
        db.query(PharmacyFeature.pharmacy_id, PharmacyFeature.feature)
        .filter(PharmacyFeature.pharmacy_id.in_(pharm_ids), PharmacyFeature.enabled.is_(True))
        .all()
    )
    features_map: dict[int, set[str]] = {pid: set() for pid in pharm_ids}
    for pid, feat in feat_rows:
        features_map.setdefault(pid, set()).add(feat)

    return [
        PharmacyListRow(
            id=p.id,
            name=p.name,
            code=p.code,
            city=p.city,
            members_count=member_counts.get(p.id, 0),
            member_initials=initials_map.get(p.id, []),
            enabled_features=sorted(features_map.get(p.id, set())),
            archived_at=p.archived_at.isoformat() if p.archived_at else None,
        )
        for p in pharmacies
    ]


@router.get("/admin/pharmacies/{pharmacy_id}", response_model=PharmacyDetail)
def get_pharmacy(
    db: DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> PharmacyDetail:
    """Full pharmacy payload — info + enabled features + every member with
    their granted permissions."""
    pharm = _get_pharmacy_or_404(db, pharmacy_id)

    members = (
        db.query(User)
        .filter(User.pharmacy_id == pharmacy_id, User.role.in_(("owner", "employee")))
        .order_by(User.role.desc(), User.id.asc())
        .all()
    )
    granted = granted_permissions_map(db, [m.id for m in members])

    # Union of active owners' enabled permissions — same definition the
    # backend uses in effective_permissions for the employee ceiling.
    # Powers the second ceiling pill in the admin's permission dialog for
    # employees, so admin sees what would actually be effective.
    owners_union: set[str] = set()
    for m in members:
        if m.role == "owner" and m.status == "active":
            owners_union.update(granted.get(m.id, []))

    return PharmacyDetail(
        id=pharm.id,
        name=pharm.name,
        code=pharm.code,
        city=pharm.city,
        address=pharm.address,
        phone=pharm.phone,
        email=pharm.email,
        archived_at=pharm.archived_at.isoformat() if pharm.archived_at else None,
        enabled_features=_enabled_features(db, pharm.id),
        members=[member_to_out(m, granted.get(m.id, [])) for m in members],
        owners_union_permissions=sorted(owners_union),
    )


# ── Create / update / soft-delete ────────────────────────────────────────────


@router.post("/admin/pharmacies", response_model=PharmacyDetail)
def create_pharmacy(body: PharmacyIn, db: DbDep) -> PharmacyDetail:
    """Create with every feature on. The pharmacy `code` is auto-generated from
    `city` (e.g. Bouskoura → BOU0001); any client-sent `body.code` is ignored on
    create (members/service.add_pharmacy)."""
    pharm = add_pharmacy(db, name=body.name, city=body.city, address=body.address, phone=body.phone, email=body.email)
    db.commit()
    return get_pharmacy(db, pharm.id)


@router.patch("/admin/pharmacies/{pharmacy_id}", response_model=PharmacyDetail)
def update_pharmacy(
    body: PharmacyIn,
    db: DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> PharmacyDetail:
    """Edit pharmacy info — name/code/city/address/phone/email."""
    pharm = _get_pharmacy_or_404(db, pharmacy_id)
    pharm.name = body.name
    pharm.code = body.code
    pharm.city = body.city
    pharm.address = body.address
    pharm.phone = body.phone
    pharm.email = body.email
    db.commit()
    return get_pharmacy(db, pharm.id)


@router.delete("/admin/pharmacies/{pharmacy_id}", status_code=204)
def archive_pharmacy(
    db: DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> None:
    """Soft-delete: set archived_at. Reversible via PATCH (clear archived_at
    out-of-band for now; restore endpoint can land later if needed)."""
    pharm = _get_pharmacy_or_404(db, pharmacy_id)
    if pharm.archived_at is None:
        pharm.archived_at = datetime.now(timezone.utc)
        db.commit()


# ── Bulk-set toggles ─────────────────────────────────────────────────────────


@router.put("/admin/pharmacies/{pharmacy_id}/features", response_model=PharmacyDetail)
def set_pharmacy_features(
    body: FeaturesBulkSet,
    db: DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> PharmacyDetail:
    """Single bulk write of the 10 PharmacyFeature toggles. Frontend builds
    the full dict (saves 9 separate round-trips) and POSTs it on the
    'Enregistrer' click in Screen 2 Section A."""
    _get_pharmacy_or_404(db, pharmacy_id)
    _apply_features_bulk(db, pharmacy_id, body.features)
    db.commit()
    return get_pharmacy(db, pharmacy_id)


@router.put("/admin/users/{user_id}/permissions", response_model=MemberOut)
def set_user_permissions(
    body: PermissionsBulkSet,
    db: DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Admin sets one user's 10 permissions in bulk — owners OR employees.
    The 3-layer intersection at read time still applies, so an admin-granted
    employee permission only becomes effective when the pharmacy AND at least
    one active owner also have it (see effective_permissions in
    backend/core/permissions.py)."""
    target = _get_member_or_404(db, user_id)
    if target.role == "admin":
        raise ApiError(
            400,
            ErrorCode.ADMIN_NO_PERMISSIONS,
            "Les administrateurs n'ont pas de permissions configurables.",
        )
    apply_permissions_bulk(db, target.id, body.permissions)
    db.commit()
    return member_out(db, target)


# ── Member CRUD ──────────────────────────────────────────────────────────────


@router.post("/admin/pharmacies/{pharmacy_id}/users", response_model=CreateUserOut)
def create_user(
    body: CreateUserIn,
    db: DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> CreateUserOut:
    """Admin creates an owner or employee account directly, with the password
    the admin typed and every permission granted (see members.create_member).
    Email must be unique app-wide."""
    _get_pharmacy_or_404(db, pharmacy_id)
    if body.pharmacy_id != pharmacy_id:
        raise ApiError(400, ErrorCode.PHARMACY_ID_MISMATCH, "Incohérence: pharmacy_id du body et de l'URL.")
    if db.query(User).filter(User.email == body.email).first():
        raise ApiError(409, ErrorCode.EMAIL_TAKEN, "Un utilisateur avec cet email existe déjà.")

    new_user = create_member(
        db,
        email=body.email,
        name=body.full_name,
        password=body.password,
        role=body.role,
        pharmacy_id=pharmacy_id,
    )
    return CreateUserOut(member=member_out(db, new_user))


@router.post("/admin/users/{user_id}/reset-password", response_model=ResetPasswordOut)
def reset_user_password(
    body: ResetPasswordIn,
    db: DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> ResetPasswordOut:
    """Set the password the admin typed. Invalidates active sessions via
    token_version bump so the user must log in with the new password."""
    target = _get_member_or_404(db, user_id)
    reset_member_password(db, target, body.password)
    return ResetPasswordOut(user_id=target.id)


@router.patch("/admin/users/{user_id}/status", response_model=MemberOut)
def set_user_status(
    body: StatusPatchIn,
    db: DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Toggle active <-> inactive. Going inactive also bumps token_version
    so existing sessions die immediately."""
    target = _get_member_or_404(db, user_id)
    if target.role == "admin":
        raise ApiError(400, ErrorCode.ADMIN_STATUS_LOCKED, "Impossible de modifier le statut d'un administrateur.")
    set_member_status(db, target, body.status)
    return member_out(db, target)


# ── « Utilisateurs » tab: every account ──────────────────────────────────────


def _user_row(u: User, granted: list[str]) -> AdminUserRow:
    p = u.pharmacy
    return AdminUserRow(
        id=u.id,
        full_name=u.name,
        email=u.email,
        phone=u.phone,
        role=u.role,
        status=u.status,
        pharmacy=UserPharmacyRef(
            id=p.id,
            name=p.name,
            code=p.code,
            archived_at=p.archived_at.isoformat() if p.archived_at else None,
        )
        if p
        else None,
        last_login_at=u.last_login_at,
        granted_permissions=granted,
    )


@router.get("/admin/users", response_model=list[AdminUserRow])
def list_users(db: DbDep) -> list[AdminUserRow]:
    """Every account — any role, with or without a pharmacy (archived ones
    too). The pharmacy pages only show the owner/employee members of active
    pharmacies; this list is the one place where nobody is hidden, except the
    `pending` sign-ups (they are in « Demandes »)."""
    users = (
        db.query(User)
        .filter(User.status != "pending")
        .options(joinedload(User.pharmacy))
        .order_by(User.role.asc(), User.name.asc(), User.email.asc())
        .all()
    )
    granted = granted_permissions_map(db, [u.id for u in users])
    return [_user_row(u, granted.get(u.id, [])) for u in users]


@router.patch("/admin/users/{user_id}/pharmacy", response_model=AdminUserRow)
def assign_user_pharmacy(
    body: AssignPharmacyIn,
    db: DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> AdminUserRow:
    """Attach an owner / employee to an active pharmacy — the fix for accounts
    left without one (or on an archived one). A user with no permission rows
    gets every permission (client rule: everything ON by default)."""
    target = _get_member_or_404(db, user_id)
    if target.role not in ("owner", "employee"):
        raise ApiError(
            400,
            ErrorCode.ONLY_MEMBERS_HAVE_PHARMACY,
            "Seuls les propriétaires et les employés ont une pharmacie.",
        )
    pharm = _get_pharmacy_or_404(db, body.pharmacy_id)
    if pharm.archived_at is not None:
        raise ApiError(400, ErrorCode.PHARMACY_ARCHIVED, "Cette pharmacie est archivée.")
    target.pharmacy_id = pharm.id
    if not db.query(UserPermission).filter(UserPermission.user_id == target.id).first():
        apply_permissions_bulk(db, target.id, {f: True for f in ALLOWED_FEATURES})
    db.commit()
    db.refresh(target)
    return _user_row(target, granted_permissions_map(db, [target.id]).get(target.id, []))


@router.delete("/admin/users/{user_id}", status_code=204)
def delete_user(
    db: DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> None:
    """Hard-delete a non-admin user. Cascades drop UserPermission rows (FK
    ondelete=CASCADE). For 'soft remove access' use PATCH /status instead."""
    target = _get_member_or_404(db, user_id)
    if target.role == "admin":
        raise ApiError(400, ErrorCode.ADMIN_NOT_DELETABLE, "Impossible de supprimer un administrateur.")
    db.delete(target)
    db.commit()


# ── Sign-up requests (« Demandes » tab) ───────────────────────────────────────


def _pharmacy_by_code(db, code: str | None) -> Pharmacy | None:
    """Active pharmacy with this code (any case), else None."""
    if not code:
        return None
    return db.query(Pharmacy).filter(func.upper(Pharmacy.code) == code.upper(), Pharmacy.archived_at.is_(None)).first()


def _pending_signup_or_error(db, signup_id: int) -> SignupRequest:
    req = db.get(SignupRequest, signup_id)
    if req is None:
        raise ApiError(404, ErrorCode.SIGNUP_NOT_FOUND, "Demande introuvable.")
    if req.status != "pending":
        raise ApiError(409, ErrorCode.SIGNUP_ALREADY_DECIDED, "Cette demande a déjà été traitée.")
    return req


@router.get("/admin/signup-requests", response_model=list[SignupRequestRow])
def list_signup_requests(db: DbDep) -> list[SignupRequestRow]:
    """Pending « Créer un compte », newest first. Flags what « Accepter » would refuse:
    an email that already has an account (other than the request's own pending one),
    a code no active pharmacy has."""
    pending = (
        db.query(SignupRequest)
        .filter(SignupRequest.status == "pending")
        .order_by(SignupRequest.created_at.desc())
        .all()
    )
    accounts = db.query(User.email, User.id).filter(User.email.in_({r.email for r in pending})).all() if pending else []
    rows: list[SignupRequestRow] = []
    for r in pending:
        pharm = _pharmacy_by_code(db, r.pharmacy_code)
        rows.append(
            SignupRequestRow(
                id=r.id,
                created_at=r.created_at,
                role=r.role,
                full_name=r.full_name,
                email=r.email,
                phone=r.phone,
                pharmacy_code=r.pharmacy_code,
                pharmacy=SignupPharmacyRef(id=pharm.id, name=pharm.name, code=pharm.code, city=pharm.city)
                if pharm
                else None,
                new_pharmacy_name=r.pharmacy_name,
                new_pharmacy_city=r.pharmacy_city,
                new_pharmacy_address=r.pharmacy_address,
                email_taken=any(email == r.email and uid != r.user_id for email, uid in accounts),
                code_unknown=bool(r.pharmacy_code) and pharm is None,
            )
        )
    return rows


@router.post("/admin/signup-requests/{signup_id}/accept", response_model=SignupAcceptOut)
def accept_signup(signup_id: Annotated[int, Path(ge=1)], admin: AdminDep, db: DbDep) -> SignupAcceptOut:
    """Activate the request's pending account (or create it, older requests) with every
    permission on, in the pharmacy it names or in a new pharmacy (code from the city, every
    feature on), then email « Votre compte est prêt »."""
    req = _pending_signup_or_error(db, signup_id)
    own = db.get(User, req.user_id) if req.user_id else None
    others = db.query(User).filter(User.email == req.email)
    if own:
        others = others.filter(User.id != own.id)
    if others.first():
        raise ApiError(409, ErrorCode.EMAIL_TAKEN, "Un utilisateur avec cet email existe déjà.")
    if req.pharmacy_code:
        pharm = _pharmacy_by_code(db, req.pharmacy_code)
        if pharm is None:
            raise ApiError(
                409,
                ErrorCode.PHARMACY_CODE_UNKNOWN,
                f"Aucune pharmacie avec le code {req.pharmacy_code}.",
                pharmacy_code=req.pharmacy_code,
            )
    else:
        pharm = add_pharmacy(
            db, name=req.pharmacy_name or "", city=req.pharmacy_city or "", address=req.pharmacy_address
        )
    user = (
        activate_member(db, own, pharmacy_id=pharm.id)
        if own
        else create_member(
            db,
            email=req.email,
            name=req.full_name,
            password_hash=req.password_hash,
            phone=req.phone,
            role=req.role,
            pharmacy_id=pharm.id,
        )
    )
    req.status = "accepted"
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by = admin.id
    req.user_id = user.id
    db.commit()
    send_signup_decision(to=req.email, name=req.full_name, accepted=True, login_url=f"{settings.FRONTEND_URL}/login")
    return SignupAcceptOut(user_id=user.id, pharmacy_id=pharm.id, pharmacy_code=pharm.code or "")


@router.post("/admin/signup-requests/{signup_id}/refuse", status_code=204)
def refuse_signup(signup_id: Annotated[int, Path(ge=1)], admin: AdminDep, db: DbDep) -> None:
    """The pending account is deleted (logged out); the person gets an email saying the
    request was not accepted."""
    req = _pending_signup_or_error(db, signup_id)
    own = db.get(User, req.user_id) if req.user_id else None
    if own and own.status == "pending":
        db.delete(own)
        req.user_id = None
    req.status = "refused"
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by = admin.id
    db.commit()
    send_signup_decision(to=req.email, name=req.full_name, accepted=False, login_url=f"{settings.FRONTEND_URL}/login")
