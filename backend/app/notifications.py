from functools import lru_cache

from aiogram import Bot

from app.config import get_settings


@lru_cache
def _get_notifier_bot() -> Bot:
    return Bot(token=get_settings().telegram_bot_token)


async def notify_admin(text: str) -> None:
    settings = get_settings()
    if not settings.admin_telegram_chat_id:
        return
    bot = _get_notifier_bot()
    await bot.send_message(chat_id=settings.admin_telegram_chat_id, text=text)
