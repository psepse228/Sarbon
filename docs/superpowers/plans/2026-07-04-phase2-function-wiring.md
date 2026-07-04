# Phase 2 — Wire Function-Calling Stubs to Real Supabase Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5 bare `return None` stubs from Phase 0 (`backend/app/functions/stubs.py`) with real Supabase-backed logic, so the bot can answer from actual `company_profile`/`availability_cache`/`escalations` data instead of always deferring.

**Architecture:** All 5 functions live in a renamed `backend/app/functions/handlers.py` (no longer stubs). Four of them read from `company_profile`'s jsonb columns (`packages`, `faq`, `partners`) or `availability_cache`, scoped by `tenant_id`; the fifth (`escalate_to_human`) writes a row to `escalations`. A shared private helper `_fetch_company_profile(tenant_id)` avoids repeating the same Supabase query. Every function still returns `None` (or an empty-implying `None` for `get_partners`) when nothing matches — this preserves the Phase 0 contract that "no data → bot says it'll check and get back to you," now backed by real absence-of-data instead of an unconditional stub.

**Tech Stack:** Same as Phase 0 (Python/FastAPI, `supabase-py`), using the existing `get_supabase_client()` from `backend/app/db.py`. Test data already seeded in Supabase: tenant `005ece7a-2af4-4f22-84f7-25d5e743af9e` ("Ресторан «Сарбон» (тест)") with 2 packages, 10 FAQ entries, 8 partners, and 2 `availability_cache` rows (`2026-08-15` booked, `2026-08-22` free).

---

## File Structure

```
backend/
  app/
    functions/
      __init__.py                 # unchanged
      handlers.py                 # renamed from stubs.py; real Supabase-backed logic
  tests/
    test_handlers.py              # renamed from test_stubs.py; real logic tests with a fake Supabase client double
```

`stubs.py`/`test_stubs.py` are deleted as part of the rename (git tracks it as a rename when old/new content overlaps enough, otherwise as delete+add — either is fine).

---

### Task 1: Real Supabase-backed function handlers

**Files:**
- Delete: `backend/app/functions/stubs.py`
- Delete: `backend/tests/test_stubs.py`
- Create: `backend/app/functions/handlers.py`
- Test: `backend/tests/test_handlers.py`

- [ ] **Step 1: Delete the old stub files**

```bash
git rm backend/app/functions/stubs.py backend/tests/test_stubs.py
```
(Run from project root.)

- [ ] **Step 2: Write the failing tests**

```python
# backend/tests/test_handlers.py
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
```

All test functions are `async def` — `pyproject.toml`'s `asyncio_mode = "auto"` (set in Phase 0) means no `@pytest.mark.asyncio` marker is needed.

- [ ] **Step 3: Run tests to verify they fail**

Run (from `backend/`, venv active): `pytest tests/test_handlers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.functions.handlers'`

- [ ] **Step 4: Write the implementation**

```python
# backend/app/functions/handlers.py
from typing import Any

from app.db import get_supabase_client


def _fetch_company_profile(tenant_id: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("company_profile")
        .select("packages,faq,partners,policies")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None


async def get_package_price(tenant_id: str, package_name: str) -> dict[str, Any] | None:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    target = package_name.strip().lower()
    for package in profile.get("packages") or []:
        if package.get("name", "").strip().lower() == target:
            return package
    return None


async def check_date_availability(tenant_id: str, date: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("availability_cache")
        .select("is_available,event_details")
        .eq("tenant_id", tenant_id)
        .eq("date", date)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None


async def get_faq(tenant_id: str, topic: str) -> dict[str, Any] | None:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    target = topic.strip().lower()
    for entry in profile.get("faq") or []:
        if target in entry.get("question", "").lower():
            return entry
    return None


async def get_partners(tenant_id: str, category: str) -> list[dict[str, Any]] | None:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    target = category.strip().lower()
    matches = [
        partner
        for partner in profile.get("partners") or []
        if partner.get("category", "").strip().lower() == target
    ]
    return matches or None


async def escalate_to_human(conversation_id: str, reason: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("escalations")
        .insert({"conversation_id": conversation_id, "reason": reason})
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None
```

Note the type signature change from Phase 0: `get_partners` now returns `list[dict[str, Any]] | None` (a category can have multiple partners), not `dict[str, Any] | None` like the other four. This is a deliberate, documented deviation from the original stub contract.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_handlers.py -v`
Expected: all PASS (10 tests)

- [ ] **Step 6: Run the full suite**

Run: `pytest -v` from `backend/`
Expected: all tests pass (7 pre-existing minus the 1 deleted `test_stubs.py` test, plus 10 new = 16 total)

- [ ] **Step 7: Commit**

```bash
git add backend/app/functions/handlers.py backend/tests/test_handlers.py
git commit -m "feat: wire function-calling handlers to real Supabase queries"
```
(`git rm` from Step 1 is already staged — include it in the same commit, or let it ride along since it's already `git rm`'d and staged.)

---

## After This Plan

The 5 functions are not yet wired into the aiogram dispatcher/LLM function-calling loop — that's a separate, larger task (GPT-4o function-calling integration + system prompt with the "never guess, always call a function" rule from `WEDDING-BOT-CONTEXT.md`). This plan only makes the functions themselves real; hooking them into the conversation engine is Phase 2's next slice.
