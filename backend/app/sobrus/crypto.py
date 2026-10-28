"""The Sobrus password and session cookies, encrypted (Fernet: AES + HMAC). Key = `SOBRUS_SECRET_KEY`
when set, else derived from `JWT_SECRET` (HKDF): nothing more to set on the server. The key lives
only in the environment: a stolen database alone gives nothing. Another JWT_SECRET later = the saved
passwords can't be read any more: the robot asks the owner to type it again (`sync.Robot.login`)."""

from __future__ import annotations

import base64
from functools import cache

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings


@cache
def _fernet() -> Fernet:
    if settings.SOBRUS_SECRET_KEY:
        return Fernet(settings.SOBRUS_SECRET_KEY.encode())
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"pharmagest sobrus").derive(
        settings.JWT_SECRET.encode()
    )
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    """Raises `cryptography.fernet.InvalidToken` when saved with another key."""
    return _fernet().decrypt(token.encode()).decode()
