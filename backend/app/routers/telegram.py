import hmac

from fastapi import APIRouter, Header, HTTPException, Request
from aiogram.types import Update

from app.bot.dispatcher import bot, dp
from app.config import get_settings

router = APIRouter()


@router.post("/webhook/telegram")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, bool]:
    """Telegram signs every real webhook call with the secret_token registered
    via setWebhook, echoed back in this header -- without checking it, this
    endpoint accepted any well-formed Update JSON from anyone on the internet
    and fed it straight into the real AI/CRM pipeline (fake leads, fake
    escalations paging the owner, unlimited GPT-4o spend). See
    scripts/set_telegram_webhook.py for the one-time setup that registers
    this secret with Telegram -- this check is a no-op until that's run."""
    settings = get_settings()
    if not settings.telegram_webhook_secret or not hmac.compare_digest(
        x_telegram_bot_api_secret_token or "", settings.telegram_webhook_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    payload = await request.json()
    update = Update.model_validate(payload)
    await dp.feed_update(bot=bot, update=update)
    return {"ok": True}
