# Cortège CRM Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multi-language guest replies, a Kanban leads board, owner-triggered broadcasts, and opportunistic review capture — the tractable subset of the BRAI competitive-gap list, per `docs/superpowers/specs/2026-07-14-cortege-crm-expansion-design.md`.

**Architecture:** One prompt-only change to `backend/app/ai/engine.py` (language). One presentation-only rewrite of `dashboard/src/components/LeadsList.tsx` (Kanban). Two new Supabase tables (`broadcasts`, `reviews`) each with a matching backend read/write path (`capture_review` follows the exact `flag_knowledge_gap` pattern; broadcast-sending is a new internal FastAPI endpoint reusing the existing `aiogram.Bot`) and a matching dashboard read/write path (`lib/reviews.ts`, `lib/broadcasts.ts`, new API routes, new `/d/reviews` and `/d/broadcasts` pages, two new Sidebar entries).

**Tech Stack:** FastAPI / pytest (backend), Next.js 14 App Router / TypeScript / vitest (dashboard), Supabase, GPT-4o, aiogram.

**Read before starting:** `docs/superpowers/specs/2026-07-14-cortege-crm-expansion-design.md`.

**Note on test coverage:** Matches every prior phase's convention. `backend/app/functions/handlers.py` and `backend/app/ai/engine.py` get full pytest coverage (TDD). The new `backend/app/routers/internal.py` broadcast endpoint gets pytest coverage mirroring `test_internal_test_chat.py`. Dashboard `lib/*.ts` Supabase-touching CRUD wrappers get **no** new unit test, consistent with `leads.ts`/`knowledgeGaps.ts` today (Supabase-touching code isn't unit-tested in this codebase — no local Postgres/Supabase test double exists). Presentational React changes (Kanban board, new pages) get no automated test either, consistent with every prior phase — verification is `npm run build` plus a manual pass in the final task.

**Important — read before Task 4:** `backend/tests/test_ai_engine.py` has two tests that assert the *exact set* of tool names offered to the model (`test_generate_reply_offers_all_tools_when_nothing_disabled` and `test_generate_reply_excludes_tools_for_disabled_skills`) — adding `capture_review` to `ALWAYS_ON_TOOLS` means **both existing assertions need `"capture_review"` added to their expected sets**, or they'll fail. This is spelled out explicitly in Task 4 below — don't skip it.

---

### Task 1: Multi-language guest replies

**Files:**
- Modify: `backend/app/ai/engine.py`

- [ ] **Step 1: Replace the Russian-only instruction**

In `backend/app/ai/engine.py`, find this line inside `SYSTEM_PROMPT_BASE`:

```python
    "Отвечай клиенту только на русском языке, всегда — независимо от того, на каком языке он "
    "написал.\n"
```

Replace with:

```python
    "Отвечай клиенту на том языке, на котором написано его последнее сообщение (например, если "
    "оно на английском — отвечай по-английски; если на русском — по-русски). Если язык неочевиден "
    "(однословное сообщение, эмодзи, номер телефона) — отвечай по-русски по умолчанию.\n"
```

- [ ] **Step 2: Update the one existing test that asserts Russian-only behavior, if any**

Run: `cd backend && grep -rn "только на русском\|русском языке" tests/`
Expected: no matches (this instruction text isn't asserted verbatim anywhere) — if the grep does find a match, read that test and update the assertion to match the new instruction text instead of guessing; don't skip this check.

- [ ] **Step 3: Run the backend test suite**

Run: `cd backend && python -m pytest -q`
Expected: all tests pass (this is a prompt-string change; no test should have depended on the old wording beyond what Step 2 already checked).

- [ ] **Step 4: Commit**

```bash
git add backend/app/ai/engine.py
git commit -m "feat(backend): reply in the guest's language instead of forcing Russian"
```

---

### Task 2: Kanban board for Leads

**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/src/components/LeadsList.tsx`

- [ ] **Step 1: Add the Kanban CSS**

Append this section at the end of `dashboard/src/app/globals.css`:

```css

/* --- Leads Kanban board --- */

.kanban-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 1rem;
  align-items: start;
  overflow-x: auto;
}

.kanban-column-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-faint);
  margin-bottom: 0.8rem;
}

.kanban-column .card {
  margin-bottom: 0.7rem;
  padding: 1rem 1.1rem;
}

.kanban-card-name {
  font-weight: 600;
  margin-bottom: 0.3rem;
}

.kanban-card-meta {
  font-size: 0.82rem;
  color: var(--color-text-soft);
  margin-bottom: 0.7rem;
}

.kanban-card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

@media (max-width: 1100px) {
  .kanban-board {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

- [ ] **Step 2: Rewrite `LeadsList.tsx` as a Kanban board**

`dashboard/src/components/LeadsList.tsx` currently renders a flat list with a status `<select>` per card (read it if you need the exact current content). Replace the whole file with:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Lead } from "@/lib/types";

const COLUMNS: { status: Lead["status"]; label: string }[] = [
  { status: "new", label: "Новые" },
  { status: "contacted", label: "В работе" },
  { status: "booked", label: "Забронировано" },
  { status: "lost", label: "Потеряно" },
];

const NEXT_STATUS: Partial<Record<Lead["status"], Lead["status"]>> = {
  new: "contacted",
  contacted: "booked",
};

const PREV_STATUS: Partial<Record<Lead["status"], Lead["status"]>> = {
  contacted: "new",
  booked: "contacted",
};

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmaFetch("/api/leads")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить лиды (${res.status})`);
        return (await res.json()) as Lead[];
      })
      .then((data) => {
        if (!cancelled) setLeads(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить лиды");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeStatus(lead: Lead, status: Lead["status"]) {
    setBusyId(lead.id);
    setError(null);
    try {
      const res = await tmaFetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось обновить статус (${res.status})`);
      }
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Лиды</h1>
      <p className="muted">
        Клиенты, которые проявили намерение забронировать. Двигайте карточку по мере работы с заявкой.
      </p>

      {error && <ErrorBanner message={error} />}

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnLeads = leads.filter((lead) => lead.status === column.status);
          const prev = PREV_STATUS[column.status];
          const next = NEXT_STATUS[column.status];

          return (
            <div key={column.status} className="kanban-column">
              <div className="kanban-column-title">
                {column.label} ({columnLeads.length})
              </div>
              {columnLeads.map((lead) => (
                <div key={lead.id} className="card">
                  <div className="kanban-card-name">{lead.name ?? "Без имени"}</div>
                  <div className="kanban-card-meta">
                    {lead.phone ?? "—"} · {lead.preferredDate ?? "дата не указана"} · {lead.guestCount ?? "—"} гостей
                  </div>
                  <div className="kanban-card-actions">
                    <a href={`/d/conversations/${lead.conversationId}`} className="btn btn-ghost">
                      Диалог
                    </a>
                    {prev && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, prev)}
                      >
                        ← {COLUMNS.find((c) => c.status === prev)?.label}
                      </button>
                    )}
                    {next && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, next)}
                      >
                        {COLUMNS.find((c) => c.status === next)?.label} →
                      </button>
                    )}
                    {column.status !== "lost" && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, "lost")}
                      >
                        Потерян
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {columnLeads.length === 0 && <p className="muted">Пусто</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/globals.css dashboard/src/components/LeadsList.tsx
git commit -m "feat(dashboard): turn the Leads page into a Kanban board"
```

---

### Task 3: Add the `broadcasts` and `reviews` tables

**Files:**
- Create: `supabase/migrations/0007_add_broadcasts.sql`
- Create: `supabase/migrations/0008_add_reviews.sql`

- [ ] **Step 1: Write the broadcasts migration**

`supabase/migrations/0007_add_broadcasts.sql`:

```sql
-- 0007_add_broadcasts.sql
-- Owner-triggered, send-now messages to a filtered guest audience (see
-- dashboard/src/lib/broadcasts.ts and backend POST /internal/broadcast).
-- No scheduling — this is a log of sends, not a queue.

create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  message text not null,
  audience text not null check (audience in ('all', 'leads_new', 'leads_contacted', 'leads_booked')),
  recipient_count integer not null default 0,
  created_at timestamptz default now()
);
create index idx_broadcasts_tenant on broadcasts(tenant_id);
```

- [ ] **Step 2: Write the reviews migration**

`supabase/migrations/0008_add_reviews.sql`:

```sql
-- 0008_add_reviews.sql
-- Ratings/feedback a guest volunteers unprompted during a conversation
-- (capture_review tool, backend/app/ai/engine.py). No unique constraint on
-- conversation_id — unlike leads, a review isn't incrementally built up, so
-- if a guest leaves feedback twice both rows are kept as-is.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  conversation_id uuid references conversations(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
create index idx_reviews_tenant on reviews(tenant_id);
```

- [ ] **Step 3: Apply both migrations**

Run this combined SQL against the project's Supabase instance via the SQL editor (same manual process used for every migration since `0001` — no automated runner exists in this repo):

```sql
create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  message text not null,
  audience text not null check (audience in ('all', 'leads_new', 'leads_contacted', 'leads_booked')),
  recipient_count integer not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_broadcasts_tenant on broadcasts(tenant_id);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  conversation_id uuid references conversations(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
create index if not exists idx_reviews_tenant on reviews(tenant_id);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_add_broadcasts.sql supabase/migrations/0008_add_reviews.sql
git commit -m "feat(db): add broadcasts and reviews tables"
```

---

### Task 4: Backend `capture_review` tool

**Files:**
- Modify: `backend/app/functions/handlers.py`
- Modify: `backend/app/ai/engine.py`
- Test: `backend/tests/test_handlers.py`
- Test: `backend/tests/test_ai_engine.py`

- [ ] **Step 1: Write the failing handler test**

Add to `backend/tests/test_handlers.py`, near `test_flag_knowledge_gap_inserts_and_returns_row`:

```python
async def test_capture_review_inserts_and_returns_row(monkeypatch):
    client = _client_with(reviews=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.capture_review(TENANT_ID, "conv-1", rating=5, comment="Всё отлично, спасибо!")

    assert result == {
        "tenant_id": TENANT_ID,
        "conversation_id": "conv-1",
        "rating": 5,
        "comment": "Всё отлично, спасибо!",
    }


async def test_capture_review_without_comment(monkeypatch):
    client = _client_with(reviews=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.capture_review(TENANT_ID, "conv-1", rating=4, comment=None)

    assert result == {
        "tenant_id": TENANT_ID,
        "conversation_id": "conv-1",
        "rating": 4,
        "comment": None,
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_handlers.py -k capture_review -v`
Expected: FAIL — `handlers.capture_review` doesn't exist yet.

- [ ] **Step 3: Implement `capture_review`**

In `backend/app/functions/handlers.py`, add after `capture_lead`:

```python


async def capture_review(tenant_id: str, conversation_id: str, rating: int, comment: str | None = None) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("reviews")
        .insert({"tenant_id": tenant_id, "conversation_id": conversation_id, "rating": rating, "comment": comment})
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_handlers.py -k capture_review -v`
Expected: PASS, 2/2.

- [ ] **Step 5: Write the failing engine tests**

Add to `backend/tests/test_ai_engine.py`, near the `capture_lead` tests:

```python
async def test_generate_reply_captures_review_with_tenant_and_conversation_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_review", {"rating": 5, "comment": "Всё супер!"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо большое за отзыв!"),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_capture_review(tenant_id, conversation_id, rating, comment=None):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert rating == 5
        assert comment == "Всё супер!"
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "rating": rating, "comment": comment}

    monkeypatch.setattr(engine.handlers, "capture_review", fake_capture_review)

    result = await engine.generate_reply(
        "tenant-1", "conv-1", [{"role": "user", "content": "Спасибо, всё было супер! Оценю на 5"}]
    )

    assert result.reply == "Спасибо большое за отзыв!"


async def test_generate_reply_test_mode_review_does_not_write(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_review", {"rating": 5, "comment": None})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо!"),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    capture_calls = []

    async def fake_capture_review(tenant_id, conversation_id, rating, comment=None):
        capture_calls.append((tenant_id, conversation_id, rating, comment))
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "rating": rating, "comment": comment}

    monkeypatch.setattr(engine.handlers, "capture_review", fake_capture_review)

    result = await engine.generate_reply(
        "tenant-1", "test-conv", [{"role": "user", "content": "5 из 5!"}], test_mode=True
    )

    assert result.reply == "Спасибо!"
    assert capture_calls == []
    assert result.tool_calls == [
        engine.ToolCallRecord("capture_review", {"rating": 5, "comment": None}, {"would_capture_review": True, "rating": 5, "comment": None})
    ]
```

Then update the two existing tool-set assertions in the same file:

In `test_generate_reply_offers_all_tools_when_nothing_disabled`, change:
```python
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "get_faq",
        "get_partners",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
    }
```
to:
```python
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "get_faq",
        "get_partners",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
        "capture_review",
    }
```

In `test_generate_reply_excludes_tools_for_disabled_skills`, change:
```python
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
    }
```
to:
```python
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
        "capture_review",
    }
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_ai_engine.py -v`
Expected: the two new tests FAIL (`Unknown tool: capture_review`), and the two updated assertion tests FAIL (missing `"capture_review"` from the actual set) — confirming the test changes are wired correctly before implementing.

- [ ] **Step 7: Add the tool definition and system-prompt instruction**

In `backend/app/ai/engine.py`, add one new sentence to `SYSTEM_PROMPT_BASE`, right after the existing capture_lead paragraph (the one ending "...просто продолжай отвечать по существу.\n"):

```python
    "ЕСЛИ КЛИЕНТ САМ (без вопроса с твоей стороны) оставил оценку или отзыв о качестве "
    "обслуживания (например «спасибо, всё супер, 5 из 5» или «было долго ждать ответа») — вызови "
    "capture_review с оценкой (1-5) и текстом отзыва, если он был. Никогда не спрашивай оценку "
    "первым — только фиксируй то, что клиент дал добровольно.\n"
```

Then add the tool definition to `ALWAYS_ON_TOOLS`, after the `capture_lead` entry:

```python
    {
        "type": "function",
        "function": {
            "name": "capture_review",
            "description": "Зафиксировать оценку/отзыв, который клиент оставил добровольно о качестве обслуживания (не спрашивать самому, только если клиент сам оценил).",
            "parameters": {
                "type": "object",
                "properties": {
                    "rating": {"type": "integer", "description": "Оценка от 1 до 5"},
                    "comment": {"type": "string"},
                },
                "required": ["rating"],
            },
        },
    },
```

- [ ] **Step 8: Wire it into `_call_tool`**

In `backend/app/ai/engine.py`'s `_call_tool`, add this branch right after the `capture_lead` branch (before `raise ValueError(...)`):

```python
    if name == "capture_review":
        if test_mode:
            # No DB row — Test Console surfaces this as "would capture" in
            # its own UI, same treatment as the other ALWAYS_ON_TOOLS.
            return {"would_capture_review": True, "rating": arguments["rating"], "comment": arguments.get("comment")}
        return await handlers.capture_review(tenant_id, conversation_id, arguments["rating"], arguments.get("comment"))
```

- [ ] **Step 9: Run the full backend suite to verify everything passes**

Run: `cd backend && python -m pytest -q`
Expected: PASS, all tests green (including the 4 new ones and the 2 updated assertions).

- [ ] **Step 10: Commit**

```bash
git add backend/app/functions/handlers.py backend/app/ai/engine.py backend/tests/test_handlers.py backend/tests/test_ai_engine.py
git commit -m "feat(backend): add capture_review tool for opportunistic feedback"
```

---

### Task 5: Backend `/internal/broadcast` endpoint

**Files:**
- Modify: `backend/app/notifications.py`
- Modify: `backend/app/routers/internal.py`
- Test: `backend/tests/test_internal_broadcast.py`

- [ ] **Step 1: Expose a reusable bot getter**

`backend/app/notifications.py` currently reads:

```python
from functools import lru_cache

from aiogram import Bot

from app.config import get_settings


@lru_cache
def _get_notifier_bot() -> Bot:
    return Bot(token=get_settings().telegram_bot_token)


async def notify_admin(text: str) -> None:
    settings = get_settings()
    if not settings.admin_telegram_chat_id:
        return
    bot = _get_notifier_bot()
    await bot.send_message(chat_id=settings.admin_telegram_chat_id, text=text)
```

Replace with (renames the private helper to a public one so the broadcast endpoint can reuse the exact same bot instance, no behavior change to `notify_admin`):

```python
from functools import lru_cache

from aiogram import Bot

from app.config import get_settings


@lru_cache
def get_notifier_bot() -> Bot:
    return Bot(token=get_settings().telegram_bot_token)


async def notify_admin(text: str) -> None:
    settings = get_settings()
    if not settings.admin_telegram_chat_id:
        return
    bot = get_notifier_bot()
    await bot.send_message(chat_id=settings.admin_telegram_chat_id, text=text)
```

- [ ] **Step 2: Write the failing endpoint tests**

Create `backend/tests/test_internal_broadcast.py`:

```python
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import app.routers.internal as internal_router
from app.main import app

client = TestClient(app)


def _fake_settings(secret: str = "test-secret") -> SimpleNamespace:
    return SimpleNamespace(internal_api_secret=secret)


def test_broadcast_sends_to_every_chat_id_and_returns_sent_count(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    fake_bot = SimpleNamespace(send_message=AsyncMock())
    monkeypatch.setattr(internal_router, "get_notifier_bot", lambda: fake_bot)

    response = client.post(
        "/internal/broadcast",
        json={"chat_ids": ["111", "222", "333"], "message": "У нас акция на будни!"},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"sent_count": 3}
    assert fake_bot.send_message.await_count == 3
    fake_bot.send_message.assert_any_await(chat_id="111", text="У нас акция на будни!")


def test_broadcast_counts_successes_only_when_some_sends_fail(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    async def flaky_send(chat_id, text):
        if chat_id == "bad":
            raise RuntimeError("blocked by user")

    fake_bot = SimpleNamespace(send_message=AsyncMock(side_effect=flaky_send))
    monkeypatch.setattr(internal_router, "get_notifier_bot", lambda: fake_bot)

    response = client.post(
        "/internal/broadcast",
        json={"chat_ids": ["good1", "bad", "good2"], "message": "Привет!"},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"sent_count": 2}


def test_broadcast_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/broadcast",
        json={"chat_ids": ["111"], "message": "Привет!"},
        headers={"X-Internal-Secret": "wrong-secret"},
    )

    assert response.status_code == 401
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_internal_broadcast.py -v`
Expected: FAIL — `/internal/broadcast` doesn't exist yet (404s).

- [ ] **Step 4: Implement the endpoint**

`backend/app/routers/internal.py` currently ends after the `test_chat` function. Add these imports at the top (extending the existing `fastapi`/`pydantic` import lines) and the new route at the end:

Change:
```python
import hmac
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.ai.engine import generate_reply
from app.config import get_settings
```
to:
```python
import hmac
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.ai.engine import generate_reply
from app.config import get_settings
from app.notifications import get_notifier_bot
```

Then append at the end of the file:

```python


class BroadcastRequest(BaseModel):
    chat_ids: list[str]
    message: str


class BroadcastResponse(BaseModel):
    sent_count: int


@router.post("/broadcast", response_model=BroadcastResponse)
async def broadcast(
    body: BroadcastRequest,
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> BroadcastResponse:
    """Owner-triggered, send-now message to a filtered guest audience — see
    dashboard/src/lib/broadcasts.ts for the only caller. Per-recipient
    failures (blocked bot, invalid chat id) don't abort the batch."""
    settings = get_settings()
    if not settings.internal_api_secret or not hmac.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    bot = get_notifier_bot()
    sent_count = 0
    for chat_id in body.chat_ids:
        try:
            await bot.send_message(chat_id=chat_id, text=body.message)
            sent_count += 1
        except Exception:
            continue

    return BroadcastResponse(sent_count=sent_count)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_internal_broadcast.py -v`
Expected: PASS, 3/3.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: all tests pass, including `test_notifications.py` (still passes since `notify_admin`'s behavior is unchanged, only the private helper was renamed).

- [ ] **Step 7: Commit**

```bash
git add backend/app/notifications.py backend/app/routers/internal.py backend/tests/test_internal_broadcast.py
git commit -m "feat(backend): add POST /internal/broadcast endpoint"
```

---

### Task 6: Dashboard Reviews section

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/lib/reviews.ts`
- Create: `dashboard/src/app/api/reviews/route.ts`
- Modify: `dashboard/src/components/icons.tsx`
- Create: `dashboard/src/app/d/reviews/page.tsx`

- [ ] **Step 1: Add the `Review` type**

In `dashboard/src/lib/types.ts`, add after the `AvailabilityEntry` interface:

```ts

export interface Review {
  id: string;
  conversationId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Add `dashboard/src/lib/reviews.ts`**

```ts
import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { Review } from "./types";

interface RawReviewRow {
  id: string;
  conversation_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function fetchReviews(tenantId: string): Promise<Review[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("reviews")
    .select("id,conversation_id,rating,comment,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RawReviewRow[]>();

  if (error) {
    throw new Error(`Failed to load reviews: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }));
}
```

- [ ] **Step 3: Add `dashboard/src/app/api/reviews/route.ts`**

```ts
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { fetchReviews } from "@/lib/reviews";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchReviews(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 4: Add a `StarIcon`**

In `dashboard/src/components/icons.tsx`, add after `SparkleIcon`:

```tsx

export function StarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 3.3 13.6 8.6l5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L11 3.3Z" />
    </svg>
  );
}
```

- [ ] **Step 5: Add `dashboard/src/app/d/reviews/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { StarIcon } from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";
import type { Review } from "@/lib/types";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmaFetch("/api/reviews")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить отзывы (${res.status})`);
        return (await res.json()) as Review[];
      })
      .then((data) => {
        if (!cancelled) setReviews(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить отзывы");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const average = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Отзывы</h1>
      <p className="muted">Оценки и отзывы, которые гости оставили добровольно в переписке с ботом.</p>

      {error && <ErrorBanner message={error} />}

      <div className="desktop-kpi-row">
        <div className="kpi-tile">
          <div className="kpi-value kpi-value-good">{average ? average.toFixed(1) : "—"}</div>
          <div className="kpi-label">средняя оценка</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-value">{reviews.length}</div>
          <div className="kpi-label">всего отзывов</div>
        </div>
      </div>

      {reviews.length === 0 && <p className="muted">Пока нет отзывов.</p>}

      {reviews.map((review) => (
        <div key={review.id} className="card">
          <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.5rem" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <StarIcon key={n} className={n <= review.rating ? "review-star-filled" : "review-star-empty"} />
            ))}
          </div>
          {review.comment && <p>{review.comment}</p>}
          <p className="muted">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Add the star-color CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Reviews --- */

.review-star-filled {
  color: var(--color-gold);
}

.review-star-empty {
  color: var(--color-text-faint);
  opacity: 0.4;
}
```

- [ ] **Step 7: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/reviews.ts dashboard/src/app/api/reviews/route.ts dashboard/src/components/icons.tsx dashboard/src/app/d/reviews/page.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add Отзывы (Reviews) page"
```

---

### Task 7: Dashboard Broadcasts section

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/lib/broadcasts.ts`
- Create: `dashboard/src/app/api/broadcasts/route.ts`
- Create: `dashboard/src/app/d/broadcasts/page.tsx`

- [ ] **Step 1: Add the `Broadcast` type**

In `dashboard/src/lib/types.ts`, add after the new `Review` interface from Task 6:

```ts

export type BroadcastAudience = "all" | "leads_new" | "leads_contacted" | "leads_booked";

export interface Broadcast {
  id: string;
  message: string;
  audience: BroadcastAudience;
  recipientCount: number;
  createdAt: string;
}
```

- [ ] **Step 2: Add `dashboard/src/lib/broadcasts.ts`**

```ts
import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { Broadcast, BroadcastAudience, Lead } from "./types";

interface RawBroadcastRow {
  id: string;
  message: string;
  audience: BroadcastAudience;
  recipient_count: number;
  created_at: string;
}

export async function fetchBroadcasts(tenantId: string): Promise<Broadcast[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("broadcasts")
    .select("id,message,audience,recipient_count,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RawBroadcastRow[]>();

  if (error) {
    throw new Error(`Failed to load broadcasts: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    message: row.message,
    audience: row.audience,
    recipientCount: row.recipient_count,
    createdAt: row.created_at,
  }));
}

async function resolveAudience(tenantId: string, audience: BroadcastAudience): Promise<string[]> {
  const client = getServiceSupabaseClient();

  if (audience === "all") {
    const { data, error } = await client.from("conversations").select("client_id").eq("tenant_id", tenantId);
    if (error) throw new Error(`Failed to resolve audience: ${error.message}`);
    return [...new Set((data ?? []).map((row) => row.client_id as string))];
  }

  const status = audience.replace("leads_", "") as Lead["status"];
  const { data: leadRows, error: leadsError } = await client
    .from("cortege_leads")
    .select("conversation_id")
    .eq("tenant_id", tenantId)
    .eq("status", status);
  if (leadsError) throw new Error(`Failed to resolve audience: ${leadsError.message}`);

  const conversationIds = (leadRows ?? []).map((row) => row.conversation_id as string);
  if (conversationIds.length === 0) return [];

  const { data: convRows, error: convError } = await client
    .from("conversations")
    .select("client_id")
    .in("id", conversationIds);
  if (convError) throw new Error(`Failed to resolve audience: ${convError.message}`);

  return [...new Set((convRows ?? []).map((row) => row.client_id as string))];
}

export async function sendBroadcast(tenantId: string, audience: BroadcastAudience, message: string): Promise<number> {
  const chatIds = await resolveAudience(tenantId, audience);

  const backendUrl = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!backendUrl || !secret) {
    throw new Error("BACKEND_URL/INTERNAL_API_SECRET is not configured on the server");
  }

  let sentCount = 0;
  if (chatIds.length > 0) {
    const response = await fetch(`${backendUrl}/internal/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
      body: JSON.stringify({ chat_ids: chatIds, message }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Backend broadcast failed (${response.status})`);
    }
    const data: { sent_count: number } = await response.json();
    sentCount = data.sent_count;
  }

  const client = getServiceSupabaseClient();
  const { error } = await client.from("broadcasts").insert({
    tenant_id: tenantId,
    message,
    audience,
    recipient_count: sentCount,
  });
  if (error) {
    throw new Error(`Failed to log broadcast: ${error.message}`);
  }

  return sentCount;
}
```

- [ ] **Step 3: Add `dashboard/src/app/api/broadcasts/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { fetchBroadcasts, sendBroadcast } from "@/lib/broadcasts";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const sendSchema = z.object({
  audience: z.enum(["all", "leads_new", "leads_contacted", "leads_booked"]),
  message: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchBroadcasts(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { audience, message } = sendSchema.parse(body);
    const recipientCount = await sendBroadcast(tenantId, audience, message);
    return NextResponse.json({ recipientCount });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 4: Add `dashboard/src/app/d/broadcasts/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Broadcast, BroadcastAudience } from "@/lib/types";

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: "Все диалоги",
  leads_new: "Лиды: новые",
  leads_contacted: "Лиды: в работе",
  leads_booked: "Лиды: забронировано",
};

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  function loadBroadcasts() {
    tmaFetch("/api/broadcasts")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить рассылки (${res.status})`);
        return (await res.json()) as Broadcast[];
      })
      .then(setBroadcasts)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить рассылки"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBroadcasts();
  }, []);

  async function send() {
    setSending(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await tmaFetch("/api/broadcasts", {
        method: "POST",
        body: JSON.stringify({ audience, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось отправить рассылку (${res.status})`);
      }
      const body: { recipientCount: number } = await res.json();
      setLastResult(body.recipientCount);
      setMessage("");
      loadBroadcasts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить рассылку");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Рассылки</h1>
      <p className="muted">Отправьте сообщение сразу нескольким гостям или лидам.</p>

      {error && <ErrorBanner message={error} />}

      <div className="card">
        <div className="field">
          <label>Кому</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as BroadcastAudience)}>
            {(Object.keys(AUDIENCE_LABELS) as BroadcastAudience[]).map((key) => (
              <option key={key} value={key}>
                {AUDIENCE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Сообщение</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Например: У нас акция — скидка 10% на будни в этом месяце"
          />
        </div>
        <button type="button" className="btn btn-primary" disabled={sending || message.trim().length === 0} onClick={send}>
          {sending ? "Отправка…" : "Отправить"}
        </button>
        {lastResult !== null && <p className="muted">Отправлено получателям: {lastResult}</p>}
      </div>

      <h3>История рассылок</h3>
      {broadcasts.length === 0 && <p className="muted">Пока нет рассылок.</p>}
      {broadcasts.map((b) => (
        <div key={b.id} className="card">
          <p>{b.message}</p>
          <p className="muted">
            {AUDIENCE_LABELS[b.audience]} · {b.recipientCount} получателей ·{" "}
            {new Date(b.createdAt).toLocaleString("ru-RU")}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/broadcasts.ts dashboard/src/app/api/broadcasts/route.ts dashboard/src/app/d/broadcasts/page.tsx
git commit -m "feat(dashboard): add Рассылки (Broadcasts) page"
```

---

### Task 8: Wire up navigation and final verification

**Files:**
- Modify: `dashboard/src/components/Sidebar.tsx`

- [ ] **Step 1: Add the two new nav items**

`dashboard/src/components/Sidebar.tsx` currently reads:

```tsx
import { ChatIcon, FlaskIcon, GearIcon, HomeIcon, SparkleIcon, UsersIcon } from "@/components/icons";

const ITEMS = [
  { href: "/d", label: "Обзор", Icon: HomeIcon },
  { href: "/d/conversations", label: "Диалоги", Icon: ChatIcon },
  { href: "/d/leads", label: "Лиды", Icon: UsersIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;
```

Replace with:

```tsx
import { ChatIcon, FlaskIcon, GearIcon, HomeIcon, SendIcon, SparkleIcon, StarIcon, UsersIcon } from "@/components/icons";

const ITEMS = [
  { href: "/d", label: "Обзор", Icon: HomeIcon },
  { href: "/d/conversations", label: "Диалоги", Icon: ChatIcon },
  { href: "/d/leads", label: "Лиды", Icon: UsersIcon },
  { href: "/d/broadcasts", label: "Рассылки", Icon: SendIcon },
  { href: "/d/reviews", label: "Отзывы", Icon: StarIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;
```

- [ ] **Step 2: Verify the full build and test suite**

Run: `cd dashboard && npm run build && npm test`
Expected: build succeeds (now 8 desktop nav destinations), all tests pass.

Run: `cd backend && python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 3: Manual visual verification**

Run `cd dashboard && npm run dev`, open `http://localhost:3000/d` (with `DEV_BYPASS_INIT_DATA`/`TELEGRAM_OWNER_TENANT_MAP` from `.env.local`, as in every prior phase). If a real browser/screenshot tool is available in your environment, use it; if not, say so explicitly rather than claiming a visual check happened. Check:

1. Sidebar shows all 8 items including the new Рассылки and Отзывы entries with distinct icons.
2. `/d/leads` renders as a 4-column Kanban board; moving a lead between columns via its buttons persists (reload the page, the lead stays in its new column).
3. `/d/reviews` loads without error (empty state is fine if no `reviews` rows exist yet in this environment).
4. `/d/broadcasts` loads without error; composing and sending is fine to leave untested end-to-end if there's no real Telegram bot token in this environment — but confirm the page renders and the form is interactive.
5. Test Console (`/d/test-console`): send a message in English (e.g. "How much does the Standard package cost?") and confirm the bot replies in English, not Russian — this exercises Task 1's multi-language change end-to-end since Test Console calls the real engine.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/Sidebar.tsx
git commit -m "feat(dashboard): add Рассылки and Отзывы to desktop navigation"
```
