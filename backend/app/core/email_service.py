"""SMTP transactional email. Uses stdlib smtplib — sync, no async wrapper noise.

When MAIL_USERNAME is empty (dev without SMTP creds, tests), this module
prints the email to stdout instead of sending — same dev-loop UX as before.

Failures are caught + logged, never raised: the forgot-password endpoint MUST
stay 200 even when SMTP is broken, so the response doesn't leak whether the
account exists.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings


log = logging.getLogger(__name__)


def _render_magic_link_html(name: str, magic_link: str, is_setup: bool) -> str:
    """One template, two greetings. Vital Teal CTA, white card on neutral bg."""
    greeting = f"Bienvenue, {name} 👋" if is_setup else f"Bonjour {name},"
    body = (
        "Un compte a été créé pour vous. Cliquez sur le bouton ci-dessous "
        "pour définir votre mot de passe et activer votre accès."
        if is_setup
        else "Vous avez demandé la réinitialisation de votre mot de passe. "
        "Cliquez sur le bouton ci-dessous pour en choisir un nouveau."
    )
    cta = "Activer mon compte" if is_setup else "Réinitialiser mon mot de passe"

    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F4F6F8;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#121A18;">
  <div style="max-width:600px;margin:40px auto;padding:0 16px;">
    <div style="background:#fff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:18px;font-weight:700;color:#0E9E8C;">PharmaGest</span></div>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">{greeting}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">{body}</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{magic_link}" style="display:inline-block;background:#0E9E8C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:14px;">{cta}</a>
      </div>
      <p style="margin:0;font-size:12px;color:#5B6A67;line-height:1.6;">Ce lien expire dans 60 minutes. Si le bouton ne fonctionne pas, copiez ce lien :<br><a href="{magic_link}" style="color:#0E9E8C;word-break:break-all;">{magic_link}</a></p>
    </div>
    <p style="text-align:center;margin:24px 0 0;font-size:12px;color:#8A92A3;line-height:1.6;">PharmaGest — Gestion de pharmacie<br>Email automatique, merci de ne pas y répondre.</p>
  </div>
</body></html>"""


def send_magic_link(*, to: str, name: str, magic_link: str, is_setup: bool) -> None:
    if not settings.MAIL_USERNAME:
        # Dev / no-SMTP fallback: print, same as the previous behavior.
        flow = "WELCOME" if is_setup else "RESET"
        print(f"\n>>> [{flow}] MAGIC LINK for {to}: {magic_link}\n", flush=True)
        return

    subject = (
        "Bienvenue sur PharmaGest — Activez votre compte"
        if is_setup
        else "Réinitialisation de votre mot de passe PharmaGest"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.MAIL_FROM or settings.MAIL_USERNAME
    msg["To"] = to
    msg.set_content(f"{subject}\n\nLien d'activation : {magic_link}\n\n(Ce lien expire dans 60 minutes.)")
    msg.add_alternative(_render_magic_link_html(name=name, magic_link=magic_link, is_setup=is_setup), subtype="html")

    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as smtp:
            if settings.MAIL_STARTTLS:
                smtp.starttls(context=ssl.create_default_context())
            smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            smtp.send_message(msg)
        log.info("magic_link.sent to=%s is_setup=%s", to, is_setup)
    except Exception:
        log.exception("magic_link.send_failed to=%s", to)


def send_signup_decision(*, to: str, name: str, accepted: bool, login_url: str) -> None:
    """« Créer un compte » answered by the admin: the account is ready (with the login
    link), or the request was not accepted. Same no-SMTP fallback and same « never
    raise » rule as the magic links."""
    flow = "SIGNUP_ACCEPTED" if accepted else "SIGNUP_REFUSED"
    if not settings.MAIL_USERNAME:
        print(f"\n>>> [{flow}] EMAIL for {to}: {login_url}\n", flush=True)
        return

    if accepted:
        subject = "Votre compte PharmaGest est prêt"
        text = (
            f"Bonjour {name},\n\nVotre compte PharmaGest est prêt. Connectez-vous avec votre email "
            f"et le mot de passe choisi à l'inscription :\n{login_url}"
        )
    else:
        subject = "Votre demande de compte PharmaGest"
        text = (
            f"Bonjour {name},\n\nVotre demande de compte PharmaGest n'a pas été acceptée. "
            "Pour toute question, contactez votre administrateur."
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.MAIL_FROM or settings.MAIL_USERNAME
    msg["To"] = to
    msg.set_content(text)
    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10) as smtp:
            if settings.MAIL_STARTTLS:
                smtp.starttls(context=ssl.create_default_context())
            smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            smtp.send_message(msg)
        log.info("signup_decision.sent to=%s accepted=%s", to, accepted)
    except Exception:
        log.exception("signup_decision.send_failed to=%s", to)
