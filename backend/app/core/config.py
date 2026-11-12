from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_PLACEHOLDER_SECRET_PREFIXES = ("change-me", "example", "dev-", "placeholder")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    # Connections of ONE process (app/core/database.py). The managed Postgres gives the app 22 (25 − 3 reserved):
    # API 2 processes × (4 + 4) = 16, worker (entrypoint.sh worker: 2 + 1) + its LISTEN = 4 → 20, 2 left over.
    DB_POOL_SIZE: int = 4
    DB_MAX_OVERFLOW: int = 4
    JWT_SECRET: str
    # JWT access-token lifetime in minutes. 7 days by default so users aren't
    # interrupted by "Session expirée" popups during normal work. Revocation
    # still works on password reset / status flip via `token_version` rotation
    # in `security.py`, so a longer TTL doesn't break those flows.
    JWT_ACCESS_EXPIRY_MIN: int = 60 * 24 * 7
    COOKIE_SECURE: bool = False
    FRONTEND_URL: str
    # Demo recordings only: « today » for every rule that depends on it (YYYY-MM-DD, e.g. the last
    # day of the imported files). Empty = the real date in Casablanca (dev, E2E, production).
    TODAY: str = ""

    # « Connexion Sobrus » (app/sobrus/). SOBRUS_SECRET_KEY = Fernet key that encrypts the Sobrus
    # passwords + sessions (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`);
    # empty = a key derived from JWT_SECRET (app/sobrus/crypto.py). The URLs are the real Sobrus;
    # the E2E stack points them to its fake Sobrus.
    SOBRUS_SECRET_KEY: str = ""
    SOBRUS_API_URL: str = "https://api.pharmav4.sobrus.com"
    SOBRUS_ACCOUNT_API_URL: str = "https://api.account.sobrus.com"
    SOBRUS_COUNTRY: str = "MA"

    @field_validator("SOBRUS_SECRET_KEY")
    @classmethod
    def _sobrus_key_valid(cls, v: str) -> str:
        """Fail at boot on a key Fernet can't use (a wrong key would make every saved password unreadable)."""
        if v:
            from cryptography.fernet import Fernet

            try:
                Fernet(v.encode())
            except ValueError as e:
                raise ValueError("SOBRUS_SECRET_KEY is not a Fernet key (32 url-safe base64 bytes)") from e
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def _jwt_secret_strength(cls, v: str) -> str:
        """Fail fast at boot if JWT_SECRET is weak or the .env.example placeholder."""
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters long")
        if v.lower().startswith(_PLACEHOLDER_SECRET_PREFIXES):
            raise ValueError(
                "JWT_SECRET looks like a placeholder — set a real random secret "
                "(e.g. `python -c 'import secrets; print(secrets.token_urlsafe(48))'`)"
            )
        return v

    # SMTP — optional. When MAIL_USERNAME is empty, the email service falls back
    # to stdout (useful for tests + when no SMTP creds are configured yet).
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False


settings = Settings()  # type: ignore[call-arg]
