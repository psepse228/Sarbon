import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app import calendar_sync

SERVICE_ACCOUNT_JSON = json.dumps({"client_email": "cortege-calendar@my-project.iam.gserviceaccount.com"})


def test_get_service_account_email_reads_client_email(monkeypatch):
    monkeypatch.setattr(
        calendar_sync,
        "get_settings",
        lambda: SimpleNamespace(google_service_account_json=SERVICE_ACCOUNT_JSON),
    )

    email = calendar_sync.get_service_account_email()

    assert email == "cortege-calendar@my-project.iam.gserviceaccount.com"


def test_get_service_account_email_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr(calendar_sync, "get_settings", lambda: SimpleNamespace(google_service_account_json=None))

    with pytest.raises(RuntimeError, match="GOOGLE_SERVICE_ACCOUNT_JSON"):
        calendar_sync.get_service_account_email()


async def test_sync_calendar_marks_days_with_events_as_unavailable(monkeypatch):
    monkeypatch.setattr(
        calendar_sync,
        "get_settings",
        lambda: SimpleNamespace(google_service_account_json=SERVICE_ACCOUNT_JSON),
    )

    fake_events = {
        "items": [
            {"summary": "Свадьба Ивановых", "start": {"date": "2026-08-15"}},
            {"summary": "Юбилей", "start": {"date": "2026-08-20"}},
        ]
    }
    fake_events_resource = MagicMock()
    fake_events_resource.list.return_value.execute.return_value = fake_events
    fake_service = MagicMock()
    fake_service.events.return_value = fake_events_resource

    monkeypatch.setattr(calendar_sync, "_build_calendar_service", lambda: fake_service)

    upserted = []

    async def fake_upsert(tenant_id, date, is_available, event_details):
        upserted.append((tenant_id, date, is_available, event_details))

    monkeypatch.setattr(calendar_sync, "upsert_availability", fake_upsert)

    synced_count = await calendar_sync.sync_calendar("tenant-1", "owner@example.com")

    assert synced_count == 2
    assert upserted == [
        ("tenant-1", "2026-08-15", False, "Свадьба Ивановых"),
        ("tenant-1", "2026-08-20", False, "Юбилей"),
    ]
    fake_events_resource.list.assert_called_once()
    call_kwargs = fake_events_resource.list.call_args.kwargs
    assert call_kwargs["calendarId"] == "owner@example.com"


async def test_sync_calendar_combines_multiple_events_on_the_same_day(monkeypatch):
    monkeypatch.setattr(
        calendar_sync,
        "get_settings",
        lambda: SimpleNamespace(google_service_account_json=SERVICE_ACCOUNT_JSON),
    )

    fake_events = {
        "items": [
            {"summary": "Утренняя репетиция", "start": {"date": "2026-08-15"}},
            {"summary": "Свадьба Ивановых", "start": {"date": "2026-08-15"}},
        ]
    }
    fake_events_resource = MagicMock()
    fake_events_resource.list.return_value.execute.return_value = fake_events
    fake_service = MagicMock()
    fake_service.events.return_value = fake_events_resource
    monkeypatch.setattr(calendar_sync, "_build_calendar_service", lambda: fake_service)

    upserted = []

    async def fake_upsert(tenant_id, date, is_available, event_details):
        upserted.append((tenant_id, date, is_available, event_details))

    monkeypatch.setattr(calendar_sync, "upsert_availability", fake_upsert)

    synced_count = await calendar_sync.sync_calendar("tenant-1", "owner@example.com")

    assert synced_count == 1
    assert upserted == [("tenant-1", "2026-08-15", False, "Утренняя репетиция, Свадьба Ивановых")]
