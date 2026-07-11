from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import app.routers.internal as internal_router
from app.ai.engine import GeneratedReply, ToolCallRecord
from app.main import app

client = TestClient(app)


def _fake_settings(secret: str = "test-secret") -> SimpleNamespace:
    return SimpleNamespace(internal_api_secret=secret)


def test_test_chat_returns_reply_and_tool_calls_with_valid_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    fake_generate_reply = AsyncMock(
        return_value=GeneratedReply(
            "Пакет «Стандарт» стоит 250 000 ₽.",
            [ToolCallRecord("get_package_price", {"package_name": "Стандарт"}, {"price": 250000})],
        )
    )
    monkeypatch.setattr(internal_router, "generate_reply", fake_generate_reply)

    response = client.post(
        "/internal/test-chat",
        json={"tenant_id": "tenant-1", "history": [{"role": "user", "content": "Сколько стоит Стандарт?"}]},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Пакет «Стандарт» стоит 250 000 ₽."
    assert body["tool_calls"] == [
        {"name": "get_package_price", "arguments": {"package_name": "Стандарт"}, "result": {"price": 250000}}
    ]
    fake_generate_reply.assert_awaited_once_with(
        "tenant-1",
        "test-tenant-1",
        [{"role": "user", "content": "Сколько стоит Стандарт?"}],
        test_mode=True,
    )


def test_test_chat_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/test-chat",
        json={"tenant_id": "tenant-1", "history": [{"role": "user", "content": "Привет"}]},
        headers={"X-Internal-Secret": "wrong-secret"},
    )

    assert response.status_code == 401


def test_test_chat_rejects_missing_secret_header(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/test-chat",
        json={"tenant_id": "tenant-1", "history": [{"role": "user", "content": "Привет"}]},
    )

    assert response.status_code == 422
