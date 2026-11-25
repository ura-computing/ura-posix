"""One supplier, several spellings: Sobrus writes « Laboratoire BOTTU », a purchase file « BOTTU », the board
« Laboratoires Bottu ». Compared without the leading word (exact otherwise: « BOTTU MARCHE » is another one)."""

from __future__ import annotations

import re

from app.ingestion.csv_parse import normalized_name


def bare_name(name: str | None) -> str:
    """« Laboratoire BOTTU » → « bottu »; « Société BP PHARM » → « bp pharm »."""
    return re.sub(r"^(laboratoires?|labo|societe|grossiste)\s+", "", normalized_name(name))
