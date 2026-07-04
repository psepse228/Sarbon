# Wedding Bot — Phase 0 Backend Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Phase 0 backend skeleton for the wedding restaurant chatbot: multi-tenant Supabase schema, a FastAPI service on Railway with a Telegram webhook wired to an aiogram echo bot, and stubbed function-calling handlers — all runnable and tested locally before any real client data arrives.

**Architecture:** A single FastAPI app (`backend/app`) exposes a `/health` check and a `/webhook/telegram` route. The webhook route hands raw Telegram updates to an aiogram `Dispatcher`, which currently only echoes messages back (infra smoke test — real dialogue logic comes in Phase 2). Function-calling handlers live in their own module as typed stubs returning `None`, so Phase 2 can fill in real Supabase-backed logic without touching call sites. The Postgres schema is a plain SQL migration applied directly in Supabase; app code does not touch it yet beyond a lazily-constructed Supabase client.

**Tech Stack:** Python 3.12, FastAPI, aiogram 3.x, pydantic-settings, supabase-py, pytest + pytest-asyncio, Railway (Procfile-based deploy), Supabase (Postgres).

---

## File Structure

```
Sarbon/
  .gitignore
  supabase/
    migrations/
      0001_init_schema.sql        # tenants, company_profile, conversations, messages,
                                   # client_profiles, availability_cache, escalations
  backend/
    pyproject.toml                # pytest config (asyncio_mode, pythonpath)
    requirements.txt
    .env.example
    Procfile                      # Railway start command
    runtime.txt                   # pins Railway's Python build to match local dev (3.12)
    app/
      __init__.py
      config.py                   # Settings (env vars) via pydantic-settings
      db.py                       # lazy Supabase client factory
      main.py                     # FastAPI app, router registration
      routers/
        __init__.py
        health.py                 # GET /health
        telegram.py                # POST /webhook/telegram
      bot/
        __init__.py
        dispatcher.py              # aiogram Bot + Dispatcher + echo handler
      functions/
        __init__.py
        stubs.py                   # 5 function-calling stubs from the spec
    tests/
      conftest.py                  # sets fake TELEGRAM_BOT_TOKEN/SUPABASE_URL/SUPABASE_KEY for test runs
      test_config.py
      test_health.py
      test_dispatcher.py
      test_telegram_webhook.py
      test_stubs.py
      test_db.py
```

Each router/module has one responsibility: `health.py` and `telegram.py` never share code beyond the `FastAPI` app wiring in `main.py`; `dispatcher.py` owns all aiogram state; `stubs.py` owns the function-calling contract Phase 2 will implement against; `db.py` is the only place `supabase-py` is imported.

---

### Task 1: Initialize the repository

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Initialize git**

Run: `git init`
Expected: `Initialized empty Git repository in .../Sarbon/.git/`

- [ ] **Step 2: Create `.gitignore`**

```gitignore
__pycache__/
*.pyc
.venv/
venv/
.env
.pytest_cache/
node_modules/
.next/
*.egg-info/
```

- [ ] **Step 3: Stage and commit existing files**

Run: `git add .gitignore WEDDING-BOT-CONTEXT.md .claude docs`
Run: `git status`
Expected: `.gitignore`, `WEDDING-BOT-CONTEXT.md`, `.claude/...`, `docs/...` staged, nothing else.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: initialize repository"
```

---

### Task 2: Supabase multi-tenant schema migration

**Files:**
- Create: `supabase/migrations/0001_init_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0001_init_schema.sql
-- Multi-tenant schema for the wedding restaurant chatbot pilot.

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  telegram_bot_token text,
  instagram_account_id text,
  created_at timestamptz default now()
);

create table company_profile (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  packages jsonb,
  faq jsonb,
  partners jsonb,
  policies text,
  updated_at timestamptz default now()
);
create index idx_company_profile_tenant_id on company_profile(tenant_id);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  channel text check (channel in ('telegram', 'instagram')),
  client_id text not null,
  status text default 'active',
  last_message_at timestamptz,
  created_at timestamptz default now()
);
create index idx_conversations_tenant_id on conversations(tenant_id);
create index idx_conversations_tenant_client on conversations(tenant_id, client_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  role text check (role in ('client', 'bot', 'human')),
  content text not null,
  created_at timestamptz default now()
);
create index idx_messages_conversation_id on messages(conversation_id);

create table client_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  client_id text not null,
  summary text,
  tags text[],
  last_interaction timestamptz
);
create index idx_client_profiles_tenant_id on client_profiles(tenant_id);
create unique index idx_client_profiles_tenant_client on client_profiles(tenant_id, client_id);

create table availability_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  date date not null,
  is_available boolean,
  event_details text,
  synced_at timestamptz default now()
);
create index idx_availability_cache_tenant_date on availability_cache(tenant_id, date);

create table escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  reason text,
  notified_owner boolean default false,
  created_at timestamptz default now()
);
create index idx_escalations_conversation_id on escalations(conversation_id);
```

- [ ] **Step 2: Manual verification (no automated test — pure DDL)**

Once a Supabase project exists, paste this file into the Supabase SQL editor (or `supabase db push` if the CLI is linked) and confirm all 7 tables + indexes are created with no errors. Record the project URL/keys for later tasks' `.env`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init_schema.sql
git commit -m "feat: add initial multi-tenant supabase schema"
```

---

### Task 3: Backend project scaffolding (requirements, pytest config, settings)

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Test: `backend/tests/test_config.py`

- [ ] **Step 1: Create the virtualenv and requirements file**

```
backend/requirements.txt
```
```
fastapi>=0.115,<1.0
uvicorn[standard]>=0.30,<1.0
aiogram>=3.13,<4.0
pydantic-settings>=2.4,<3.0
supabase>=2.6,<3.0
pytest>=8.0,<9.0
pytest-asyncio>=0.24,<1.0
httpx>=0.27,<1.0
```

Run (from `backend/`):
```bash
py -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
```
Expected: all packages install without errors.

- [ ] **Step 2: Create pytest config**

```toml
# backend/pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
```

- [ ] **Step 3: Create `.env.example`**

```
TELEGRAM_BOT_TOKEN=
SUPABASE_URL=
SUPABASE_KEY=
ENVIRONMENT=development
```

- [ ] **Step 4: Create `app/__init__.py`** (empty file)

- [ ] **Step 5: Write the failing test**

```python
# backend/tests/test_config.py
from app.config import Settings


def test_settings_reads_from_env(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "999:real-token")
    monkeypatch.setenv("SUPABASE_URL", "https://tenant.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "secret-key")

    settings = Settings()

    assert settings.telegram_bot_token == "999:real-token"
    assert settings.supabase_url == "https://tenant.supabase.co"
    assert settings.supabase_key == "secret-key"
```

- [ ] **Step 6: Run test to verify it fails**

Run (from `backend/`, venv active): `pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 7: Write minimal implementation**

```python
# backend/app/config.py
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    telegram_bot_token: str
    supabase_url: str
    supabase_key: str
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

`telegram_bot_token`, `supabase_url`, and `supabase_key` are required (no default) so a misconfigured deployment fails immediately with a clear `pydantic.ValidationError` instead of silently booting on fake credentials. Only `environment` (not a secret) gets a default.

- [ ] **Step 8: Add the fail-fast test and a conftest so other tests don't need real secrets**

```python
# backend/tests/conftest.py
import os

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456:TEST-fake-token-for-tests")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-service-role-key")
```

This runs at module level, before pytest imports any test module, so later tasks' modules that construct `Settings()`/`Bot()` at import time still work in tests without a real `.env`. In production (Railway), no such file runs, so missing env vars fail loudly as intended.

```python
# backend/tests/test_config.py
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_reads_from_env(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "999:real-token")
    monkeypatch.setenv("SUPABASE_URL", "https://tenant.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "secret-key")

    settings = Settings()

    assert settings.telegram_bot_token == "999:real-token"
    assert settings.supabase_url == "https://tenant.supabase.co"
    assert settings.supabase_key == "secret-key"


def test_settings_requires_telegram_credentials(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)
```

`_env_file=None` disables pydantic-settings' `.env` file fallback for this one instantiation, so the test's "missing config" assertion stays deterministic regardless of whether a real `backend/.env` (with actual secrets, gitignored) exists on disk — which it will, once real Supabase/Telegram credentials are added for later phases.

- [ ] **Step 9: Run tests to verify they pass**

Run: `pytest tests/test_config.py -v`
Expected: 2 passed

- [ ] **Step 10: Commit**

```bash
git add backend/requirements.txt backend/pyproject.toml backend/.env.example backend/app/__init__.py backend/app/config.py backend/tests/conftest.py backend/tests/test_config.py
git commit -m "feat: add backend scaffolding and settings"
```

---

### Task 4: FastAPI app skeleton with health check

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/health.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: Create `app/routers/__init__.py`** (empty file)

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_health.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 4: Write minimal implementation**

```python
# backend/app/routers/health.py
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
```

```python
# backend/app/main.py
from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Wedding Bot Backend")
app.include_router(health.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/__init__.py backend/app/routers/health.py backend/app/main.py backend/tests/test_health.py
git commit -m "feat: add FastAPI app skeleton with health check"
```

---

### Task 5: aiogram bot dispatcher with echo handler

**Files:**
- Create: `backend/app/bot/__init__.py`
- Create: `backend/app/bot/dispatcher.py`
- Test: `backend/tests/test_dispatcher.py`

- [ ] **Step 1: Create `app/bot/__init__.py`** (empty file)

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_dispatcher.py
from unittest.mock import AsyncMock

from app.bot.dispatcher import echo_handler


async def test_echo_handler_replies_with_same_text():
    message = AsyncMock()
    message.text = "hello"

    await echo_handler(message)

    message.answer.assert_awaited_once_with("hello")
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_dispatcher.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.bot.dispatcher'`

- [ ] **Step 4: Write minimal implementation**

```python
# backend/app/bot/dispatcher.py
from aiogram import Bot, Dispatcher, F, Router
from aiogram.types import Message

from app.config import get_settings

router = Router()


@router.message(F.text)
async def echo_handler(message: Message) -> None:
    await message.answer(message.text)


def create_bot() -> Bot:
    settings = get_settings()
    return Bot(token=settings.telegram_bot_token)


def create_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(router)
    return dp


bot = create_bot()
dp = create_dispatcher()
```

No `parse_mode` default is set — plain-text echo needs no HTML/Markdown parsing, and defaulting to HTML would make Telegram reject any echoed text containing `<`, `&`, or unbalanced tags. The handler is filtered to `F.text` so non-text updates (photos, stickers, voice) never reach it — echoing an empty string for those would also be rejected by Telegram's `sendMessage`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_dispatcher.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/bot/__init__.py backend/app/bot/dispatcher.py backend/tests/test_dispatcher.py
git commit -m "feat: add aiogram dispatcher with echo handler"
```

---

### Task 6: Telegram webhook route

**Files:**
- Create: `backend/app/routers/telegram.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_telegram_webhook.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_telegram_webhook.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_telegram_webhook.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.routers.telegram'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/routers/telegram.py
from fastapi import APIRouter, Request
from aiogram.types import Update

from app.bot.dispatcher import bot, dp

router = APIRouter()


@router.post("/webhook/telegram")
async def telegram_webhook(request: Request) -> dict[str, bool]:
    payload = await request.json()
    update = Update.model_validate(payload)
    await dp.feed_update(bot=bot, update=update)
    return {"ok": True}
```

```python
# backend/app/main.py
from fastapi import FastAPI

from app.routers import health, telegram

app = FastAPI(title="Wedding Bot Backend")
app.include_router(health.router)
app.include_router(telegram.router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_telegram_webhook.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/telegram.py backend/app/main.py backend/tests/test_telegram_webhook.py
git commit -m "feat: wire telegram webhook route to aiogram dispatcher"
```

---

### Task 7: Function-calling stubs

**Files:**
- Create: `backend/app/functions/__init__.py`
- Create: `backend/app/functions/stubs.py`
- Test: `backend/tests/test_stubs.py`

- [ ] **Step 1: Create `app/functions/__init__.py`** (empty file)

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_stubs.py
from app.functions import stubs


async def test_all_stub_functions_return_none():
    assert await stubs.get_package_price("tenant-1", "silver") is None
    assert await stubs.check_date_availability("tenant-1", "2026-08-01") is None
    assert await stubs.get_faq("tenant-1", "cancellation") is None
    assert await stubs.get_partners("tenant-1", "florist") is None
    assert await stubs.escalate_to_human("conv-1", "price_negotiation") is None
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_stubs.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.functions.stubs'`

- [ ] **Step 4: Write minimal implementation**

```python
# backend/app/functions/stubs.py
from typing import Any


async def get_package_price(tenant_id: str, package_name: str) -> dict[str, Any] | None:
    return None


async def check_date_availability(tenant_id: str, date: str) -> dict[str, Any] | None:
    return None


async def get_faq(tenant_id: str, topic: str) -> dict[str, Any] | None:
    return None


async def get_partners(tenant_id: str, category: str) -> dict[str, Any] | None:
    return None


async def escalate_to_human(conversation_id: str, reason: str) -> dict[str, Any] | None:
    return None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_stubs.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/functions/__init__.py backend/app/functions/stubs.py backend/tests/test_stubs.py
git commit -m "feat: add function-calling stub handlers"
```

---

### Task 8: Supabase client skeleton

**Files:**
- Create: `backend/app/db.py`
- Test: `backend/tests/test_db.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_db.py
from unittest.mock import MagicMock

from app import db


def test_get_supabase_client_uses_settings(monkeypatch):
    db.get_supabase_client.cache_clear()
    create_client_mock = MagicMock(return_value="fake-client")
    monkeypatch.setattr(db, "create_client", create_client_mock)

    try:
        client = db.get_supabase_client()

        assert client == "fake-client"
        create_client_mock.assert_called_once_with(
            "https://example.supabase.co", "test-service-role-key"
        )
    finally:
        db.get_supabase_client.cache_clear()
```

The `finally` clears the `lru_cache` after the test too — otherwise the mocked `"fake-client"` value stays cached for the rest of the pytest process and leaks into any later test that calls `get_supabase_client()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_db.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.db'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/db.py
from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_db.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/db.py backend/tests/test_db.py
git commit -m "feat: add lazy supabase client factory"
```

---

### Task 9: Railway deploy config and full verification

**Files:**
- Create: `backend/Procfile`

- [ ] **Step 1: Create the Procfile**

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 2: Run the full test suite**

Run (from `backend/`, venv active): `pytest -v`
Expected: all tests across `test_config.py`, `test_health.py`, `test_dispatcher.py`, `test_telegram_webhook.py`, `test_stubs.py`, `test_db.py` PASS.

- [ ] **Step 3: Run the server locally and smoke-test it**

Run: `uvicorn app.main:app --reload`
In another terminal: `curl http://127.0.0.1:8000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 4: Manual Railway setup (one-time, dashboard)**

Create a Railway project, connect this repo, set **Root Directory** to `backend` (monorepo — Railway needs this to find `Procfile`/`requirements.txt`), and set the `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY` environment variables from the values recorded in Task 2. Deploy and confirm `/health` responds on the public Railway URL.

- [ ] **Step 5: Commit**

```bash
git add backend/Procfile
git commit -m "feat: add railway deploy config"
```

---

## After This Plan

Phase 0 also calls for a Mini App skeleton (Telegram Mini App auth + UI shell) — that's tracked as a separate plan since it's an independent subsystem (own Next.js project, deployed to Vercel). Real Telegram webhook registration (`setWebhook` call to the deployed Railway URL) and wiring the function stubs to real Supabase queries happen in Phase 2, once data arrives from the restaurant owner.
