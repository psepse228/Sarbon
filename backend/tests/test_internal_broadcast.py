from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import app.routers.internal as internal_router
from app.main import app

client = TestClient(app)


def _fake_settings(secret: str = "test-secret") -> SimpleNamespace:
    return SimpleNamespace(internal_api_secret=secret)


def test_broadcast_sends_to_every_chat_id_and_returns_sent_count(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    fake_bot = SimpleNamespace(send_message=AsyncMock())
    monkeypatch.setattr(internal_router, "get_notifier_bot", lambda: fake_bot)

    response = client.post(
        "/internal/broadcast",
        json={"chat_ids": ["111", "222", "333"], "message": "У нас акция на будни!"},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"sent_count": 3}
    assert fake_bot.send_message.await_count == 3
    fake_bot.send_message.assert_any_await(chat_id="111", text="У нас акция на будни!")


def test_broadcast_counts_successes_only_when_some_sends_fail(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    async def flaky_send(chat_id, text):
        if chat_id == "bad":
            raise RuntimeError("blocked by user")

    fake_bot = SimpleNamespace(send_message=AsyncMock(side_effect=flaky_send))
    monkeypatch.setattr(internal_router, "get_notifier_bot", lambda: fake_bot)

    response = client.post(
        "/internal/broadcast",
        json={"chat_ids": ["good1", "bad", "good2"], "message": "Привет!"},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"sent_count": 2}


def test_broadcast_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/broadcast",
        json={"chat_ids": ["111"], "message": "Привет!"},
        headers={"X-Internal-Secret": "wrong-secret"},
    )

    assert response.status_code == 401
