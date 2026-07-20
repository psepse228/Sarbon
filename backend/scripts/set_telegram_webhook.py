"""One-time setup: registers this bot's webhook URL with Telegram, including
a secret_token that Telegram echoes back on every real webhook call via the
X-Telegram-Bot-Api-Secret-Token header. Run this once per deploy target
(and again any time TELEGRAM_WEBHOOK_SECRET or the public URL changes) --
until it's run, app/routers/telegram.py's secret check has nothing to
compare against and will reject every request with 401.

    TELEGRAM_WEBHOOK_URL=https://<your-backend>/webhook/telegram python scripts/set_telegram_webhook.py
"""

import asyncio
import os

from app.bot.dispatcher import bot
from app.config import get_settings


async def main() -> None:
    settings = get_settings()
    webhook_url = os.environ["TELEGRAM_WEBHOOK_URL"]

    if not settings.telegram_webhook_secret:
        raise SystemExit(
            "TELEGRAM_WEBHOOK_SECRET is not set -- generate one (e.g. `openssl rand -hex 32`), "
            "set it in this environment's .env AND on the deployed backend's env vars, then re-run."
        )

    await bot.set_webhook(
        url=webhook_url,
        secret_token=settings.telegram_webhook_secret,
        drop_pending_updates=True,
    )
    info = await bot.get_webhook_info()
    print(f"Webhook registered: {info.url}")
    print(f"Pending update count: {info.pending_update_count}")


if __name__ == "__main__":
    asyncio.run(main())
