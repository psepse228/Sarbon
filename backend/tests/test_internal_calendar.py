from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import app.routers.internal as internal_router
from app.main import app

client = TestClient(app)


def _fake_settings(secret: str = "test-secret") -> SimpleNamespace:
    return SimpleNamespace(internal_api_secret=secret)


def test_get_service_account_email_returns_email(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())
    monkeypatch.setattr(internal_router, "get_service_account_email", lambda: "cortege-calendar@my-project.iam.gserviceaccount.com")

    response = client.get("/internal/calendar-service-account-email", headers={"X-Internal-Secret": "test-secret"})

    assert response.status_code == 200
    assert response.json() == {"email": "cortege-calendar@my-project.iam.gserviceaccount.com"}


def test_get_service_account_email_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.get("/internal/calendar-service-account-email", headers={"X-Internal-Secret": "wrong"})

    assert response.status_code == 401


def test_sync_calendar_endpoint_returns_synced_count(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())
    fake_sync = AsyncMock(return_value=3)
    monkeypatch.setattr(internal_router, "sync_calendar", fake_sync)

    response = client.post(
        "/internal/sync-calendar",
        json={"tenant_id": "tenant-1", "calendar_id": "owner@example.com"},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"synced_count": 3}
    fake_sync.assert_awaited_once_with("tenant-1", "owner@example.com")


def test_sync_calendar_endpoint_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/sync-calendar",
        json={"tenant_id": "tenant-1", "calendar_id": "owner@example.com"},
        headers={"X-Internal-Secret": "wrong"},
    )

    assert response.status_code == 401
