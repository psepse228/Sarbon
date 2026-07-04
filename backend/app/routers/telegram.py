from fastapi import APIRouter, Request
from aiogram.types import Update

from app.bot.dispatcher import bot, dp

router = APIRouter()


@router.post("/webhook/telegram")
async def telegram_webhook(request: Request) -> dict[str, bool]:
    payload = await request.json()
    update = Update.model_validate(payload)
    await dp.feed_update(bot=bot, update=update)
    return {"ok": True}
