from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import app.routers.telegram as telegram_router
from app.main import app

client = TestClient(app)

RAW_UPDATE = {
    "update_id": 1,
    "message": {
        "message_id": 1,
        "date": 1700000000,
        "chat": {"id": 123, "type": "private"},
        "text": "hello",
    },
}

_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"


def _fake_settings(secret: str = "test-webhook-secret") -> SimpleNamespace:
    return SimpleNamespace(telegram_webhook_secret=secret)


def test_webhook_feeds_update_to_dispatcher(monkeypatch):
    monkeypatch.setattr(telegram_router, "get_settings", lambda: _fake_settings())
    feed_update_mock = AsyncMock()
    monkeypatch.setattr(telegram_router.dp, "feed_update", feed_update_mock)

    response = client.post(
        "/webhook/telegram", json=RAW_UPDATE, headers={_SECRET_HEADER: "test-webhook-secret"}
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    feed_update_mock.assert_awaited_once()
    _, kwargs = feed_update_mock.call_args
    assert kwargs["update"].update_id == 1
    assert kwargs["update"].message.text == "hello"


def test_webhook_rejects_missing_secret_header(monkeypatch):
    """Regression guard for the unauthenticated-webhook finding: without the
    correct secret, the update must never reach the dispatcher at all."""
    monkeypatch.setattr(telegram_router, "get_settings", lambda: _fake_settings())
    feed_update_mock = AsyncMock()
    monkeypatch.setattr(telegram_router.dp, "feed_update", feed_update_mock)

    response = client.post("/webhook/telegram", json=RAW_UPDATE)

    assert response.status_code == 401
    feed_update_mock.assert_not_awaited()


def test_webhook_rejects_wrong_secret_header(monkeypatch):
    monkeypatch.setattr(telegram_router, "get_settings", lambda: _fake_settings())
    feed_update_mock = AsyncMock()
    monkeypatch.setattr(telegram_router.dp, "feed_update", feed_update_mock)

    response = client.post(
        "/webhook/telegram", json=RAW_UPDATE, headers={_SECRET_HEADER: "wrong-secret"}
    )

    assert response.status_code == 401
    feed_update_mock.assert_not_awaited()


def test_webhook_rejects_everything_when_no_secret_configured(monkeypatch):
    """If TELEGRAM_WEBHOOK_SECRET was never set (e.g. before the one-time
    setup script has been run), the endpoint must fail closed, not open."""
    monkeypatch.setattr(telegram_router, "get_settings", lambda: _fake_settings(secret=None))
    feed_update_mock = AsyncMock()
    monkeypatch.setattr(telegram_router.dp, "feed_update", feed_update_mock)

    response = client.post(
        "/webhook/telegram", json=RAW_UPDATE, headers={_SECRET_HEADER: "anything"}
    )

    assert response.status_code == 401
    feed_update_mock.assert_not_awaited()
