from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_PLACEHOLDER_SECRET_PREFIXES = ("change-me", "example", "dev-", "placeholder")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
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
