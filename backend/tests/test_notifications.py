from types import SimpleNamespace
from unittest.mock import AsyncMock

from app import notifications


async def test_notify_admin_sends_message_when_configured(monkeypatch):
    monkeypatch.setattr(
        notifications,
        "get_settings",
        lambda: SimpleNamespace(admin_telegram_chat_id="12345", telegram_bot_token="123:token"),
    )
    fake_bot = AsyncMock()
    monkeypatch.setattr(notifications, "get_notifier_bot", lambda: fake_bot)

    await notifications.notify_admin("test message")

    fake_bot.send_message.assert_awaited_once_with(chat_id="12345", text="test message")


async def test_notify_admin_noop_when_not_configured(monkeypatch):
    monkeypatch.setattr(
        notifications,
        "get_settings",
        lambda: SimpleNamespace(admin_telegram_chat_id=None, telegram_bot_token="123:token"),
    )
    fake_bot = AsyncMock()
    monkeypatch.setattr(notifications, "get_notifier_bot", lambda: fake_bot)

    await notifications.notify_admin("test message")

    fake_bot.send_message.assert_not_awaited()
