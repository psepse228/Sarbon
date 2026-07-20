import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app import calendar_sync

SERVICE_ACCOUNT_JSON = json.dumps({"client_email": "cortege-calendar@my-project.iam.gserviceaccount.com"})

# A throwaway (non-production, freshly generated for this test) RSA key --
# real service-account credential construction validates the key format
# eagerly, so a minimal fake string won't exercise the real code path.
_FAKE_PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDr3n7n2xgIX2HT
SvBGLEMNqE7P4a2g1jVeTiSDlXwo+/SCALwb5RwvwHDIjwYGCXSz9nBYmEcxoHC4
eeIJW25CvKAvINGdPEISAtLneX6Cse2F/1y/xpr9ykuuwKuoogs+hkqq83gBE/Wf
qHfj0rgFx9U/z7eiibDW77uilgKnPzO3BhOOG5OZsLXNOH6FG6Aqu3wkB25z3RxT
dgacjIhjjoEnniomKxdAUvrKygzrX0VK3dJ17VrAlv1obRDDFl6S5qJAlHtVNEhK
LGh7w9fFsvS6SGRIx8bufkPIElT9PU2qACt/EiZrUrMTbto+zKpuvDZt9uuRSj4G
R7R96RO/AgMBAAECggEABF2jmlWsPeMRWZwrh1vkSJCouj44QqWhdkDPBcHBWCnE
Qt56tCPWzpXTg4CkwQkIltKFJTDW6w4ZgL/m+DVHKzuyeJnvUX7HztYsRXXs01AD
VinsXCfQ+T2CjnkAZdnMiHs8rB5fRn14CqLPU3cosupUHxlKqUOQLZx4oE/TgZB/
C9gx3Gv8M02uvazocG/uGqYpvUlHdmmdqL3fjQRZJ/PfouRsg7sTQwGum1exGiM6
lqXRyEZNho1wYejqNr1ij1ZLwOf7c/9r7Yaih1KIuwQvuwtJkWbMBVY/64jI4a0d
tpGj/aaRxMSQMQszfTH23O7z1eNhX2vAV8qljDN2JQKBgQD2PTAldz62iEnkGT7U
dJHbV/k0izTOskUc3Kip9YXQ6Ovr+x8rDE44QBBmS1NhB1uSOMx2PuuAJL279wgw
/PnNF/mDInIW9XDFnbWPXBw2igQwFGrHQQAQvQqorp6vK6gbKynoWR+wwEEdjTs2
KZeDcF2AiLq5n4YfQv1DVqJRowKBgQD1OBMsoNGfuCqYtFjC3ZcYDUj5lKy/YZfA
pwcCgR44fDFDxZA+nrPYQmAI0r3mM8ZiH/BnqITJzdzgT391SBc/jNZjDvT4vSCC
D62BXoMUgePPwWvx+Nz8RyGrIFz9BkG50Z1E5lgwG48pMM0vJB/fgHKFLdXB3fW0
5gS8sv3vNQKBgF0By5e7LLLhU5eWeYbh6N3CotxX4EBaUYSPTB22IS9BaysdFS67
XSgd+pPIy9uQXeQjFAdtyKIEPq4qpqtqQihXb+U6M4G8fzYFVbiqf/WRt/c5HwPX
52BrJwWDv2hGwx5P9WpPj4rBc1boK39PwmzhGlAcVPsb6BsSwHqY1IKlAoGBAMxn
mqwXvcTaej9iDZ8ZoQn+gPbyNHEvQ5TmZdRzlqJU+6fXdh6MobNB2NVh/cN3IwXG
Q9nUQiQJwvUDr2Yu2poxpr9Zx1/UHtXrhaCSDMe6YhBa1cUUwfhUvr7rsjeD0KO5
E9RMAfTP9CzMrix+e0cNxeg3xbfdciQBnK9CsKOFAoGBAK/0OAB98i43WFWuphLF
iIqyTRzQialXbDDjH3qV24GE2yTRat5P0OC0bSqE8Th28FNbk4faq3hL4q6+S4eX
zYkZxwZsmZxmNbV46zWTuHu9DiqdF+Md2e24wsqgMeflYdWJWQR2rRKYfrmYxex6
oW/vGyksOC7qbZuVHBZ8AmFK
-----END PRIVATE KEY-----
"""

REAL_SHAPED_SERVICE_ACCOUNT_JSON = json.dumps(
    {
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test-key-id",
        "private_key": _FAKE_PRIVATE_KEY,
        "client_email": "cortege-calendar@test-project.iam.gserviceaccount.com",
        "client_id": "123456789",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
)


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


def test_build_calendar_service_does_not_raise_with_real_credentials_construction(monkeypatch):
    """Regression guard: this used to pass cacheDiscovery=False (camelCase)
    to googleapiclient's build(), which raises TypeError against the
    installed library version (the real kwarg is cache_discovery). Every
    other test in this file monkeypatches _build_calendar_service away
    entirely, so none of them exercised the real call -- this is the only
    test that does, using a real (if throwaway) RSA key so
    Credentials.from_service_account_info doesn't short-circuit first."""
    monkeypatch.setattr(
        calendar_sync,
        "get_settings",
        lambda: SimpleNamespace(google_service_account_json=REAL_SHAPED_SERVICE_ACCOUNT_JSON),
    )

    service = calendar_sync._build_calendar_service()

    assert service is not None


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
