from fastapi import APIRouter, HTTPException, status

from database import DbDep
from models import Session as UserSession
from schemas.sessions import SessionOut
from security import CurrentUserDep, SessionCookieDep
from utils import hash_token


router = APIRouter()


def _to_out(s: UserSession, current_hash: str | None) -> SessionOut:
    return SessionOut(
        id=str(s.id),
        device_label=s.device_label or "Inconnu",
        ip=s.ip or "—",
        last_active_at=s.last_used_at,
        is_current=(s.refresh_token_hash == current_hash) if current_hash else False,
    )


@router.get("")
def list_my_sessions(
    user: CurrentUserDep,
    db: DbDep,
    session_token: SessionCookieDep = None,
) -> list[SessionOut]:
    current_hash = hash_token(session_token) if session_token else None
    rows = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(UserSession.last_used_at.desc())
        .all()
    )
    return [_to_out(s, current_hash) for s in rows]


@router.delete("/{session_id}", status_code=204)
def kill_session(
    session_id: int,
    user: CurrentUserDep,
    db: DbDep,
) -> None:
    """Kill a specific session belonging to the caller. Use POST /auth/logout to
    end the CURRENT session — this endpoint is for killing other devices."""
    deleted = (
        db.query(UserSession)
        .filter(UserSession.id == session_id, UserSession.user_id == user.id)
        .delete()
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable")
    db.commit()


@router.post("/revoke-others", status_code=204)
def revoke_other_sessions(
    user: CurrentUserDep,
    db: DbDep,
    session_token: SessionCookieDep = None,
) -> None:
    """Delete every session of the caller EXCEPT the one matching session_token cookie."""
    q = db.query(UserSession).filter(UserSession.user_id == user.id)
    if session_token:
        q = q.filter(UserSession.refresh_token_hash != hash_token(session_token))
    q.delete()
    db.commit()