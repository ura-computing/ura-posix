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


# Keywords matched against `Medicament.category` to classify Pharmacie vs Parapharmacie.
# Must stay in sync with `_pharma_expr()` in backend/routers/stats/queries.py — the SQL
# version is the source of truth used by aggregates; this Python helper is for per-row
# serialisation (PG-019 / Achat export `category_type`).
_PHARMA_CATEGORY_KEYWORDS = ("edicament", "édicament", "oméopath", "omeopath", "iététique", "ietetique")


def classify_pharma_type(category: str | None, product_type: str | None = None) -> str:
    """Return ``"pharmacie"`` or ``"parapharmacie"`` for a Medicament.

    Admin override via `Medicament.product_type` ("pharmacie" / "parapharmacie")
    wins; otherwise we keyword-match the category string (Médicament, Homéopathie,
    Diététique → pharmacie; anything else → parapharmacie). Mirrors `_pharma_expr()`.
    """
    if product_type == "pharmacie":
        return "pharmacie"
    if product_type == "parapharmacie":
        return "parapharmacie"
    cat = (category or "").lower()
    return "pharmacie" if any(kw in cat for kw in _PHARMA_CATEGORY_KEYWORDS) else "parapharmacie"


# ── Mojibake fix ──────────────────────────────────────────────────────────────
# Sobrus exports sometimes arrive double-encoded: original UTF-8 bytes were
# decoded as MacRoman (or cp1252) and then re-saved as UTF-8. The result is
# strings like "Cat√©gorie" instead of "Catégorie".

_MOJIBAKE_FIXES = {
    "√©": "é",
    "√®": "è",
    "√à": "è",   # alt rendering
    "√™": "ê",
    "√Æ": "î",
    "√è": "ï",
    "√Ø": "ï",   # alt
    "√†": "à",
    "√§": "ä",
    "√≥": "ó",
    "√µ": "õ",
    "√º": "ü",
    "√â": "É",
    "√ä": "Ë",
    "√Ä": "À",
    "√î": "Ô",
    "√ô": "Ù",
    "√ª": "û",
    "√Ç": "Â",
    "¬∞": "º",
    "¬µ": "µ",
    "¬¥": "´",
    "¬Æ": "®",
    "¬©": "©",
    "¬†": " ",   # NBSP → regular space
}


_SEARCH_TOKEN_SPLIT = re.compile(r"[\s*]+")


def tokenize_search(query: str | None) -> list[str]:
    """Split a search query into tokens for AND matching.

    Splits on whitespace and `*` so users can write Google-style queries
    (`la roche posay`) or wildcard-style (`*roche*posay`). Tokens are
    lowercased and de-duplicated while preserving order.
    """
    if not query:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for raw in _SEARCH_TOKEN_SPLIT.split(query.strip()):
        tok = raw.strip().lower()
        if tok and tok not in seen:
            seen.add(tok)
            out.append(tok)
    return out


def fix_mojibake(s: str | None) -> str | None:
    """Reverse double-encoded mojibake (UTF-8 → MacRoman/cp1252 → UTF-8)."""
    if not s:
        return s
    # Cheap early-out
    if "√" not in s and "¬" not in s:
        return s
    # Try round-trip via cp1252 then macroman
    for enc in ("cp1252", "macroman"):
        try:
            fixed = s.encode(enc).decode("utf-8")
            if "√" not in fixed and "¬" not in fixed:
                return fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    # Fallback: substitution table
    for bad, good in _MOJIBAKE_FIXES.items():
        s = s.replace(bad, good)
    return s
