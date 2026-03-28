import re
import unicodedata

_PCT_RE = re.compile(r"\s*\(\d+\.?\d*%\)")


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def normalize_category(s: str) -> str:
    """Strip % suffix, strip accents, collapse whitespace. Returns None-safe result."""
    if not s:
        return s
    s = _PCT_RE.sub("", s)
    s = strip_accents(s)
    return " ".join(s.strip().split()) or s


def strip_percentage(s: str) -> str:
    """Remove '(xx%)' suffix from a category string."""
    return _PCT_RE.sub("", s).strip()
