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
        self.eq_calls = []

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.eq_calls.append((column, value))
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self._data = [payload]
        return self

    def upsert(self, payload, on_conflict=None):
        self._data = [payload]
        return self

    def execute(self):
        return SimpleNamespace(data=self._data)


class _FakeClient:
    def __init__(self, table_data):
        self._table_data = table_data
        self._queries = {}

    def table(self, name):
        if name not in self._queries:
            self._queries[name] = _FakeQuery(self._table_data.get(name, []))
        return self._queries[name]


def _client_with(**table_data):
    return _FakeClient(table_data)


async def test_get_package_price_returns_matching_package(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_package_price(TENANT_ID, "Стандарт")

    assert result == {"name": "Стандарт", "price": 250000, "currency": "RUB"}
    assert client.table("company_profile").eq_calls == [("tenant_id", TENANT_ID)]


async def test_get_package_price_returns_none_when_package_not_found(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_package_price(TENANT_ID, "Голд")

    assert result is None


async def test_list_packages_returns_all_packages(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.list_packages(TENANT_ID)

    assert result == COMPANY_PROFILE_ROW["packages"]


async def test_get_active_notice_returns_notice_when_set(monkeypatch):
    row = {**COMPANY_PROFILE_ROW, "active_notice": "Скидка 10% на будние дни в июле."}
    client = _client_with(company_profile=[row])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_active_notice(TENANT_ID)

    assert result == "Скидка 10% на будние дни в июле."


async def test_get_active_notice_returns_none_when_not_set(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_active_notice(TENANT_ID)

    assert result is None


async def test_get_active_notice_returns_none_when_no_company_profile(monkeypatch):
    client = _client_with(company_profile=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_active_notice(TENANT_ID)

    assert result is None


async def test_get_disabled_skills_returns_list_when_set(monkeypatch):
    row = {**COMPANY_PROFILE_ROW, "disabled_skills": ["partners", "faq"]}
    client = _client_with(company_profile=[row])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_disabled_skills(TENANT_ID)

    assert result == ["partners", "faq"]


async def test_get_disabled_skills_returns_empty_list_when_not_set(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_disabled_skills(TENANT_ID)

    assert result == []


async def test_get_disabled_skills_returns_empty_list_when_no_company_profile(monkeypatch):
    client = _client_with(company_profile=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_disabled_skills(TENANT_ID)

    assert result == []


async def test_get_company_info_returns_set_fields_only(monkeypatch):
    row = {
        **COMPANY_PROFILE_ROW,
        "company_name": "Cortège",
        "address": "Ташкент, ул. Examples 12",
        "phone": "+998 90 000-00-00",
        "socials": None,
    }
    client = _client_with(company_profile=[row])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_company_info(TENANT_ID)

    assert result == {
        "name": "Cortège",
        "address": "Ташкент, ул. Examples 12",
        "phone": "+998 90 000-00-00",
    }


async def test_get_company_info_returns_none_when_no_fields_set(monkeypatch):
    client = _client_with(company_profile=[COMPANY_PROFILE_ROW])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_company_info(TENANT_ID)

    assert result is None


async def test_get_company_info_returns_none_when_no_company_profile(monkeypatch):
    client = _client_with(company_profile=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.get_company_info(TENANT_ID)

    assert result is None


async def test_list_packages_returns_none_when_no_packages(monkeypatch):
    client = _client_with(company_profile=[{"packages": [], "faq": [], "partners": []}])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.list_packages(TENANT_ID)

    assert result is None


async def test_check_date_availability_returns_cached_row(monkeypatch):
    client = _client_with(
        availability_cache=[{"is_available": False, "event_details": "Забронировано"}]
    )
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.check_date_availability(TENANT_ID, "2026-08-15")

    assert result == {"is_available": False, "event_details": "Забронировано"}
    assert client.table("availability_cache").eq_calls == [
        ("tenant_id", TENANT_ID),
        ("date", "2026-08-15"),
    ]


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


async def test_flag_knowledge_gap_inserts_and_returns_row(monkeypatch):
    client = _client_with(knowledge_gaps=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.flag_knowledge_gap(TENANT_ID, "conv-1", "есть ли парковка для автобуса?")

    assert result == {
        "tenant_id": TENANT_ID,
        "conversation_id": "conv-1",
        "question": "есть ли парковка для автобуса?",
    }


async def test_capture_lead_creates_new_row_when_none_exists(monkeypatch):
    client = _client_with(leads=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.capture_lead(TENANT_ID, "conv-1", name="Анна", phone="+998901234567")

    assert result == {
        "tenant_id": TENANT_ID,
        "conversation_id": "conv-1",
        "name": "Анна",
        "phone": "+998901234567",
    }


async def test_capture_lead_merges_into_existing_row(monkeypatch):
    existing_row = {
        "id": "lead-1",
        "tenant_id": TENANT_ID,
        "conversation_id": "conv-1",
        "name": "Анна",
        "phone": "+998901234567",
        "preferred_date": None,
        "guest_count": None,
        "budget": None,
        "status": "new",
    }
    client = _client_with(leads=[existing_row])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.capture_lead(TENANT_ID, "conv-1", budget="300000-400000")

    assert result == {**existing_row, "budget": "300000-400000"}


async def test_capture_lead_ignores_none_values(monkeypatch):
    existing_row = {
        "id": "lead-1",
        "tenant_id": TENANT_ID,
        "conversation_id": "conv-1",
        "name": "Анна",
        "phone": "+998901234567",
        "preferred_date": None,
        "guest_count": None,
        "budget": None,
        "status": "new",
    }
    client = _client_with(leads=[existing_row])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.capture_lead(TENANT_ID, "conv-1", name=None, guest_count=50)

    assert result == {**existing_row, "guest_count": 50}


async def test_profile_dependent_functions_return_none_when_no_company_profile(monkeypatch):
    client = _client_with(company_profile=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    assert await handlers.get_package_price(TENANT_ID, "Стандарт") is None
    assert await handlers.list_packages(TENANT_ID) is None
    assert await handlers.get_faq(TENANT_ID, "алкоголь") is None
    assert await handlers.get_partners(TENANT_ID, "Кортеж") is None
