import logging
import os

import httpx

logger = logging.getLogger("apcm.whatsapp")

WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_API_URL = f"https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"


async def send_whatsapp_otp(phone: str, otp_code: str):
    """Send OTP via WhatsApp Cloud API using an authentication template."""
    if not WHATSAPP_PHONE_NUMBER_ID or not WHATSAPP_ACCESS_TOKEN:
        logger.error(
            "WhatsApp OTP requested but WHATSAPP_PHONE_NUMBER_ID or "
            "WHATSAPP_ACCESS_TOKEN is not configured. OTP not sent."
        )
        raise RuntimeError(
            "WhatsApp is not configured. Cannot send OTP."
        )

    headers = {
        "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": "password_reset_otp",
            "language": {"code": "fr"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": otp_code}],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": otp_code}],
                },
            ],
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(WHATSAPP_API_URL, json=payload, headers=headers)
        resp.raise_for_status()
