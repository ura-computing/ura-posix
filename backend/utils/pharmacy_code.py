"""Pharmacy code generation: `<3-letter-city-prefix><4-digit-counter>`.

Examples:
    Bouskoura → BOU0001 (first pharmacy in city), BOU0002 (second), …
    Casablanca → CAS0001
    Aïn → AIN0001 (accents stripped)
    Fès → FES0001
"""
from sqlalchemy.orm import Session

from models import Pharmacy
from utils.strings import strip_accents


def _prefix_from_city(city: str | None) -> str:
    """First 3 ASCII letters of *city*, uppercased. Pads with X if shorter."""
    if not city:
        return "XXX"
    cleaned = strip_accents(city).upper()
    letters = "".join(c for c in cleaned if c.isalpha())[:3]
    return letters.ljust(3, "X") if letters else "XXX"


def generate_pharmacy_code(db: Session, city: str | None) -> str:
    """Return the next available code for the given city prefix.

    Picks the highest existing 4-digit suffix among codes sharing the same
    3-letter prefix, then adds 1 (zero-padded). Safe to call inside the
    same transaction as the new pharmacy insert — collisions on the
    unique index will surface as IntegrityError.
    """
    prefix = _prefix_from_city(city)
    pattern = f"{prefix}%"
    rows = (
        db.query(Pharmacy.code)
        .filter(Pharmacy.code.like(pattern))
        .all()
    )
    max_n = 0
    for (code,) in rows:
        if not code:
            continue
        suffix = code[3:]
        if suffix.isdigit():
            n = int(suffix)
            if n > max_n:
                max_n = n
    return f"{prefix}{max_n + 1:04d}"
