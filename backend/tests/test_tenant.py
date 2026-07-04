from types import SimpleNamespace

import pytest

from app import tenant


class _FakeQuery:
    def __init__(self, data):
        self._data = data
        self.eq_calls = []

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.eq_calls.append((column, value))
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self._data)


class _FakeClient:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        assert name == "tenants"
        return _FakeQuery(self._rows)


def test_get_tenant_id_returns_matching_tenant(monkeypatch):
    tenant.get_tenant_id.cache_clear()
    client = _FakeClient([{"id": "tenant-1"}])
    monkeypatch.setattr(tenant, "get_supabase_client", lambda: client)

    assert tenant.get_tenant_id("bot-token-1") == "tenant-1"


def test_get_tenant_id_raises_when_no_tenant_found(monkeypatch):
    tenant.get_tenant_id.cache_clear()
    client = _FakeClient([])
    monkeypatch.setattr(tenant, "get_supabase_client", lambda: client)

    with pytest.raises(RuntimeError):
        tenant.get_tenant_id("unknown-token")
