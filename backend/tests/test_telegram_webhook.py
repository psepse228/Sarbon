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


def test_webhook_feeds_update_to_dispatcher(monkeypatch):
    feed_update_mock = AsyncMock()
    monkeypatch.setattr(telegram_router.dp, "feed_update", feed_update_mock)

    response = client.post("/webhook/telegram", json=RAW_UPDATE)

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    feed_update_mock.assert_awaited_once()
    _, kwargs = feed_update_mock.call_args
    assert kwargs["update"].update_id == 1
    assert kwargs["update"].message.text == "hello"
