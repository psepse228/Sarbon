from types import SimpleNamespace

from app.functions import handlers

TENANT_ID = "005ece7a-2af4-4f22-84f7-25d5e743af9e"

COMPANY_PROFILE_ROW = {
    "packages": [
        {"name": "Стандарт", "price": 250000, "currency": "RUB"},
        {"name": "Премиум", "price": 450000, "currency": "RUB"},
    ],
    "faq": [
        {"question": "Можно ли привезти свой алкоголь?", "answer": "Да, корковый сбор 500 ₽."},
        {"question": "Есть ли парковка?", "answer": "Да, бесплатная на 40 мест."},
    ],
    "partners": [
        {"category": "Кортеж", "name": "АвтоПрестиж"},
        {"category": "Флористы", "name": "Цветочная мастерская Роза"},
    ],
}


class _FakeQuery:
    def __init__(self, data):
        self._data = data

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self._data = [payload]
        return self

    def execute(self):
        return SimpleNamespace(data=self._data)


class _FakeClient:
    def __init__(self, table_data):
        self._table_data = table_data

    def table(self, name):
        return _FakeQuery(self._table_data.get(name, []))


def _client_with(**table_data):
    return _FakeClient(table_data)


async def test_get_package_price_returns_matching_package(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_package_price(TENANT_ID, "Стандарт")

    assert result == {"name": "Стандарт", "price": 250000, "currency": "RUB"}


async def test_get_package_price_returns_none_when_package_not_found(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_package_price(TENANT_ID, "Голд")

    assert result is None


async def test_check_date_availability_returns_cached_row(monkeypatch):
    client = _client_with(
        availability_cache=[{"is_available": False, "event_details": "Забронировано"}]
    )
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.check_date_availability(TENANT_ID, "2026-08-15")

    assert result == {"is_available": False, "event_details": "Забронировано"}


async def test_check_date_availability_returns_none_when_not_cached(monkeypatch):
    client = _client_with(availability_cache=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.check_date_availability(TENANT_ID, "2099-01-01")

    assert result is None


async def test_get_faq_returns_matching_entry(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_faq(TENANT_ID, "алкоголь")

    assert result == {"question": "Можно ли привезти свой алкоголь?", "answer": "Да, корковый сбор 500 ₽."}


async def test_get_faq_returns_none_when_no_match(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_faq(TENANT_ID, "вертолётная площадка")

    assert result is None


async def test_get_partners_returns_matching_category(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_partners(TENANT_ID, "Кортеж")

    assert result == [{"category": "Кортеж", "name": "АвтоПрестиж"}]


async def test_get_partners_returns_none_when_no_match(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_partners(TENANT_ID, "Фейерверк")

    assert result is None


async def test_escalate_to_human_inserts_and_returns_row(monkeypatch):
    client = _client_with(escalations=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.escalate_to_human("conv-1", "price_negotiation")

    assert result == {"conversation_id": "conv-1", "reason": "price_negotiation"}
