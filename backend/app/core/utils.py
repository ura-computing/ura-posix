import hashlib
import secrets
from datetime import date, datetime
from zoneinfo import ZoneInfo

# Every pharmacy is in Morocco: « today » (expiry windows, 12-month ranges, « aujourd'hui »)
# is their date, not the server clock (UTC on DigitalOcean) — at 00:30 in Casablanca the
# server would still say « yesterday ».
PHARMACY_TZ = ZoneInfo("Africa/Casablanca")


def today() -> date:
    """Today's date for the pharmacies (Africa/Casablanca)."""
    return datetime.now(PHARMACY_TZ).date()


def generate_token(byte_len: int = 32) -> str:
    """Returns a URL-safe random string (~43 chars for byte_len=32, 256 bits of entropy).
    Used for both magic-link tokens and session tokens."""
    return secrets.token_urlsafe(byte_len)


def hash_token(raw: str) -> str:
    """Returns SHA-256 hex hash. We store the hash, never the raw token, so a DB
    leak doesn't expose live magic links or session tokens."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_user_agent(ua: str | None) -> str:
    """Cheap, no-dep UA → 'Browser on OS' label. Falls back to 'Inconnu'."""
    if not ua:
        return "Inconnu"

    if "Mac OS X" in ua or "Macintosh" in ua:
        os_name = "Mac"
    elif "Windows" in ua:
        os_name = "Windows"
    elif "Android" in ua:
        os_name = "Android"
    elif "iPhone" in ua:
        os_name = "iPhone"
    elif "iPad" in ua:
        os_name = "iPad"
    elif "Linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Inconnu"

    if "Edg/" in ua:
        browser = "Edge"
    elif "Chrome/" in ua and "Chromium" not in ua:
        browser = "Chrome"
    elif "Firefox/" in ua:
        browser = "Firefox"
    elif "Safari/" in ua and "Chrome" not in ua:
        browser = "Safari"
    else:
        browser = "Navigateur"

    return f"{browser} sur {os_name}"
