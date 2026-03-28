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
