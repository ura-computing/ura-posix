import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

_conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@apcm-pharma.com"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "True") == "True",
    MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "False") == "True",
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)


async def send_reset_email(to_email: str, token: str) -> None:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_url = f"{frontend_url}/reset-password?token={token}"
    body = (
        "Bonjour,\n\n"
        "Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe "
        "(valide 1 heure) :\n\n"
        f"{reset_url}\n\n"
        "Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\n"
        "— APCM Pharma"
    )
    message = MessageSchema(
        subject="Réinitialisation de mot de passe — APCM Pharma",
        recipients=[to_email],
        body=body,
        subtype=MessageType.plain,
    )
    fm = FastMail(_conf)
    await fm.send_message(message)


async def send_invite_email(
    to_email: str,
    token: str,
    inviter_name: str | None,
    pharmacy_name: str | None,
) -> None:
    """Initial-password invitation. Reuses the /reset-password page on the
    frontend (same form, same endpoint). Longer TTL than a forgot-password
    flow — the token lifetime is set on the User row."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    invite_url = f"{frontend_url}/reset-password?token={token}"
    inviter = inviter_name or "L'équipe APCM"
    pharm = f' "{pharmacy_name}"' if pharmacy_name else ""
    body = (
        "Bonjour,\n\n"
        f"{inviter} vous invite à rejoindre la pharmacie{pharm} sur APCM Pharma.\n\n"
        "Cliquez sur le lien ci-dessous pour définir votre mot de passe "
        "(valide 7 jours) :\n\n"
        f"{invite_url}\n\n"
        "Si vous n'attendiez pas cette invitation, ignorez simplement cet email.\n\n"
        "— APCM Pharma"
    )
    message = MessageSchema(
        subject="Invitation à rejoindre APCM Pharma",
        recipients=[to_email],
        body=body,
        subtype=MessageType.plain,
    )
    fm = FastMail(_conf)
    await fm.send_message(message)
