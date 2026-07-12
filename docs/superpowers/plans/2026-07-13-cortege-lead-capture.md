# Cortège Lead Capture (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a client shows real booking intent, the bot asks for name + phone in the same reply (`capture_lead` tool, same pattern as `escalate_to_human`/`flag_knowledge_gap`), then saves whatever it collects — name, phone, preferred date, guest count, budget — into a new `leads` table. The owner works the pipeline (new → contacted → booked → lost) from a new "Лиды" section of the desktop dashboard; marking a lead "booked" automatically marks its date unavailable in `availability_cache`.

**Architecture:** New `leads` Supabase table, written by the Python backend when the tool fires (mirrors `escalations`/`knowledge_gaps`), read/updated by the dashboard's own Supabase client. `capture_lead` upserts on `conversation_id` — the handler reads the existing row (if any), merges in only the non-null fields the model just supplied, then writes the merged result, so a later call with just `budget` never blanks out an earlier `name`/`phone`. `test_mode` short-circuits the write exactly like the other two tools. Marking a lead "booked" in the dashboard reuses the existing `upsertAvailability` function from `lib/availability.ts` — no new availability-writing code path.

**Tech Stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend), Supabase, GPT-4o.

**Read before starting:** `docs/superpowers/specs/2026-07-13-cortege-lead-capture-design.md`.

**Note on test coverage:** Same convention as the prior phase (see `docs/superpowers/plans/2026-07-12-cortege-knowledge-gaps.md`'s header note) — `backend/app/functions/handlers.py` and `backend/app/ai/engine.py` get full pytest coverage for `capture_lead`, including `test_mode`. `dashboard/src/lib/leads.ts` gets no new unit tests, consistent with `lib/escalations.ts` and `lib/knowledgeGaps.ts` — Supabase-touching CRUD wrappers aren't where this codebase spends test effort. Verification for that layer is the manual end-to-end pass in the final task.

**Workflow note:** The user wants to see progress land on GitHub as it happens, not all at once at the end — push the branch after every 2-3 tasks (not just at the very end) rather than batching all commits into a single late push.

---

### Task 1: Add the `leads` table migration

**Files:**
- Create: `supabase/migrations/0005_add_leads.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0005_add_leads.sql`:

```sql
-- 0005_add_leads.sql
-- Guests who showed booking intent (capture_lead tool, backend/app/ai/engine.py).
-- One row per conversation — capture_lead upserts as more fields are learned
-- over the conversation. Owner works the pipeline from the dashboard's new
-- Leads page; marking a lead "booked" also marks its date unavailable in
-- availability_cache.

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  conversation_id uuid references conversations(id) unique,
  name text,
  phone text,
  preferred_date date,
  guest_count integer,
  budget text,
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'lost')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_leads_tenant_status on leads(tenant_id, status);
```

- [ ] **Step 2: Apply the migration**

Run this SQL against the project's Supabase instance (via the Supabase SQL editor or CLI — same process used for `0001`–`0004`, no automated migration runner exists in this repo yet).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_add_leads.sql
git commit -m "feat(db): add leads table"
```

---

### Task 2: Add the `capture_lead` backend handler

**Files:**
- Modify: `backend/app/functions/handlers.py`
- Test: `backend/tests/test_handlers.py`

- [ ] **Step 1: Add `upsert` support to the test fake**

`backend/tests/test_handlers.py` has a shared `_FakeQuery` class (used by every handler test). It currently supports `select`/`eq`/`limit`/`insert`/`execute` but not `upsert`. Add an `upsert` method right after the existing `insert` method (around line 40):

```python
    def upsert(self, payload, on_conflict=None):
        self._data = [payload]
        return self
```

The full method should now read, in order: `select`, `eq`, `limit`, `insert`, `upsert`, `execute`.

- [ ] **Step 2: Write the failing tests**

Add to `backend/tests/test_handlers.py`, near `test_flag_knowledge_gap_inserts_and_returns_row`:

```python
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
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `cd backend && pytest tests/test_handlers.py -k capture_lead -v`
Expected: FAIL with `AttributeError: module 'app.functions.handlers' has no attribute 'capture_lead'`

- [ ] **Step 4: Implement**

Add to `backend/app/functions/handlers.py`, directly after `flag_knowledge_gap`:

```python
async def capture_lead(tenant_id: str, conversation_id: str, **fields: Any) -> dict[str, Any] | None:
    client = get_supabase_client()
    new_fields = {k: v for k, v in fields.items() if v is not None}

    existing = (
        client.table("leads")
        .select("*")
        .eq("conversation_id", conversation_id)
        .limit(1)
        .execute()
    ).data

    merged = (
        {**existing[0], **new_fields}
        if existing
        else {"tenant_id": tenant_id, "conversation_id": conversation_id, **new_fields}
    )

    response = client.table("leads").upsert(merged, on_conflict="conversation_id").execute()
    rows = response.data
    return rows[0] if rows else None
```

- [ ] **Step 5: Run the tests again**

Run: `cd backend && pytest tests/test_handlers.py -k capture_lead -v`
Expected: all 3 PASS

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && pytest -v`
Expected: all pass (no regressions from the `_FakeQuery.upsert` addition)

- [ ] **Step 7: Commit**

```bash
git add backend/app/functions/handlers.py backend/tests/test_handlers.py
git commit -m "feat(backend): add capture_lead handler"
```

---

### Task 3: Wire `capture_lead` into the guest-bot engine

**Files:**
- Modify: `backend/app/ai/engine.py`
- Test: `backend/tests/test_ai_engine.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_ai_engine.py`, near the existing `flag_knowledge_gap` tests:

```python
async def test_generate_reply_captures_lead_with_tenant_and_conversation_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_lead", {"name": "Анна", "phone": "+998901234567"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо, Анна! Передал заявку администратору."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_capture(tenant_id, conversation_id, **fields):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert fields == {"name": "Анна", "phone": "+998901234567"}
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, **fields}

    monkeypatch.setattr(engine.handlers, "capture_lead", fake_capture)

    result = await engine.generate_reply(
        "tenant-1", "conv-1", [{"role": "user", "content": "Меня зовут Анна, номер +998901234567"}]
    )

    assert result.reply == "Спасибо, Анна! Передал заявку администратору."


async def test_generate_reply_test_mode_lead_does_not_write(monkeypatch):
    tool_call = _FakeToolCall("call_1", "capture_lead", {"name": "Анна", "phone": "+998901234567"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Спасибо, Анна!"),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    capture_calls = []

    async def fake_capture(tenant_id, conversation_id, **fields):
        capture_calls.append((tenant_id, conversation_id, fields))
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, **fields}

    monkeypatch.setattr(engine.handlers, "capture_lead", fake_capture)

    result = await engine.generate_reply(
        "tenant-1",
        "test-conv",
        [{"role": "user", "content": "Меня зовут Анна, номер +998901234567"}],
        test_mode=True,
    )

    assert result.reply == "Спасибо, Анна!"
    assert capture_calls == []
    assert result.tool_calls == [
        engine.ToolCallRecord(
            "capture_lead",
            {"name": "Анна", "phone": "+998901234567"},
            {"would_capture_lead": True, "name": "Анна", "phone": "+998901234567"},
        )
    ]
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend && pytest tests/test_ai_engine.py -k "lead" -v`
Expected: FAIL — `capture_lead` is not a recognized tool, `_call_tool` raises `ValueError: Unknown tool: capture_lead`

- [ ] **Step 3: Implement the engine changes**

In `backend/app/ai/engine.py`:

1. Add the system-prompt paragraph. In `SYSTEM_PROMPT_BASE`, insert a new paragraph directly after the `flag_knowledge_gap` paragraph (the one starting `"ЕСЛИ КЛИЕНТ ЗАДАЛ ФАКТИЧЕСКИЙ ВОПРОС..."`) and before the `"ДАТЫ:..."` paragraph:

```python
    "ЕСЛИ ДАТА, КОТОРУЮ СПРОСИЛ КЛИЕНТ, ОКАЗАЛАСЬ СВОБОДНА (check_date_availability вернул "
    "доступность), или клиент явно говорит, что хочет забронировать — в этом же ответе попроси "
    "у него имя и номер телефона, чтобы администратор мог связаться и оформить бронь. Как только "
    "клиент их укажет — вызови capture_lead с этими данными и любыми другими деталями, которые он "
    "упомянул (дата, кол-во гостей, бюджет). Не спрашивай контакты повторно в каждом сообщении, "
    "если клиент уже дал их или проигнорировал вопрос — просто продолжай отвечать по существу.\n"
```

2. Add the tool definition to `TOOLS`, after the `flag_knowledge_gap` entry:

```python
    {
        "type": "function",
        "function": {
            "name": "capture_lead",
            "description": "Сохранить или дополнить данные клиента, проявившего намерение забронировать (имя, телефон, дата, кол-во гостей, бюджет).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "phone": {"type": "string"},
                    "preferred_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "guest_count": {"type": "integer"},
                    "budget": {"type": "string"},
                },
                "required": [],
            },
        },
    },
```

3. Add the `_call_tool` branch, after the `flag_knowledge_gap` branch:

```python
    if name == "capture_lead":
        if test_mode:
            # No DB row — Test Console surfaces this as "would capture" in
            # its own UI, same treatment as the other two tools' test_mode.
            return {"would_capture_lead": True, **arguments}
        return await handlers.capture_lead(tenant_id, conversation_id, **arguments)
```

- [ ] **Step 4: Run all backend tests**

Run: `cd backend && pytest -v`
Expected: all pass, including the two new tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/engine.py backend/tests/test_ai_engine.py
git commit -m "feat(backend): capture leads on booking intent

New capture_lead tool, parallel to escalate_to_human and
flag_knowledge_gap: when a client asks about a date that turns out to
be free, or says outright they want to book, the bot asks for name +
phone and saves whatever it collects. test_mode short-circuits the
write, same as the existing tools."
```

---

### Task 4: Add the `Lead` type

**Files:**
- Modify: `dashboard/src/lib/types.ts`

- [ ] **Step 1: Add the type**

Add to `dashboard/src/lib/types.ts`, after the `KnowledgeGap` interface:

```typescript
export interface Lead {
  id: string;
  conversationId: string;
  name: string | null;
  phone: string | null;
  preferredDate: string | null;
  guestCount: number | null;
  budget: string | null;
  status: "new" | "contacted" | "booked" | "lost";
  createdAt: string;
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/types.ts
git commit -m "feat(dashboard): add Lead type"
```

---

### Task 5: Add `lib/leads.ts`

**Files:**
- Create: `dashboard/src/lib/leads.ts`

- [ ] **Step 1: Write the module**

`dashboard/src/lib/leads.ts`:

```typescript
import "server-only";

import { upsertAvailability } from "./availability";
import { getServiceSupabaseClient } from "./supabase/server";
import type { Lead } from "./types";

interface RawLeadRow {
  id: string;
  conversation_id: string;
  name: string | null;
  phone: string | null;
  preferred_date: string | null;
  guest_count: number | null;
  budget: string | null;
  status: "new" | "contacted" | "booked" | "lost";
  created_at: string;
}

export async function fetchLeads(tenantId: string): Promise<Lead[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("leads")
    .select("id,conversation_id,name,phone,preferred_date,guest_count,budget,status,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RawLeadRow[]>();

  if (error) {
    throw new Error(`Failed to load leads: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    name: row.name,
    phone: row.phone,
    preferredDate: row.preferred_date,
    guestCount: row.guest_count,
    budget: row.budget,
    status: row.status,
    createdAt: row.created_at,
  }));
}

async function fetchLeadForTenant(tenantId: string, leadId: string): Promise<RawLeadRow> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("leads")
    .select("id,conversation_id,name,phone,preferred_date,guest_count,budget,status,created_at")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle<RawLeadRow>();

  if (error) {
    throw new Error(`Failed to load lead: ${error.message}`);
  }
  if (!data) {
    throw new Error("Lead not found for this tenant");
  }
  return data;
}

/** Updates a lead's status. When moving to "booked" with a preferred_date
 * set, also marks that date unavailable in availability_cache — so the
 * bot's own check_date_availability immediately reflects it. Moving off
 * "booked" does not auto-revert availability_cache; the owner handles that
 * manually via the existing Calendar tab, same as any other availability
 * change. */
export async function updateLeadStatus(tenantId: string, leadId: string, status: Lead["status"]): Promise<void> {
  const lead = await fetchLeadForTenant(tenantId, leadId);

  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) {
    throw new Error(`Failed to update lead: ${error.message}`);
  }

  if (status === "booked" && lead.preferred_date) {
    await upsertAvailability(tenantId, lead.preferred_date, false, `Бронь: ${lead.name ?? "без имени"}`);
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors. (No new unit test here — see the plan header's note on test coverage convention.)

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/leads.ts
git commit -m "feat(dashboard): add leads lib (fetch/updateStatus, syncs availability_cache on booked)"
```

---

### Task 6: Add `GET /api/leads`

**Files:**
- Create: `dashboard/src/app/api/leads/route.ts`

- [ ] **Step 1: Build the route**

`dashboard/src/app/api/leads/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { fetchLeads } from "@/lib/leads";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchLeads(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/leads/route.ts
git commit -m "feat(dashboard): add GET /api/leads"
```

---

### Task 7: Add `PATCH /api/leads/[id]`

**Files:**
- Create: `dashboard/src/app/api/leads/[id]/route.ts`

- [ ] **Step 1: Build the route**

`dashboard/src/app/api/leads/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { updateLeadStatus } from "@/lib/leads";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ status: z.enum(["new", "contacted", "booked", "lost"]) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { status } = bodySchema.parse(await request.json());
    await updateLeadStatus(tenantId, params.id, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "dashboard/src/app/api/leads/[id]/route.ts"
git commit -m "feat(dashboard): add PATCH /api/leads/[id]"
```

---

### Task 8: Add the `LeadsList` component

**Files:**
- Create: `dashboard/src/components/LeadsList.tsx`

- [ ] **Step 1: Build it**

`dashboard/src/components/LeadsList.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Lead } from "@/lib/types";

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "Новый",
  contacted: "Связались",
  booked: "Забронировано",
  lost: "Потерян",
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
        Клиенты, которые проявили намерение забронировать. Обновляйте статус по мере работы с заявкой.
      </p>

      {error && <ErrorBanner message={error} />}

      {leads.length === 0 && <p className="muted">Пока нет лидов.</p>}

      {leads.map((lead) => (
        <div key={lead.id} className="card">
          <div className="card-title-row">
            <strong>{lead.name ?? "Без имени"}</strong>
            <a href={`/d/conversations/${lead.conversationId}`}>Открыть диалог</a>
          </div>
          <p className="muted">
            {lead.phone ?? "—"} · {lead.preferredDate ?? "дата не указана"} · {lead.guestCount ?? "—"} гостей ·{" "}
            {lead.budget ?? "—"}
          </p>
          <div className="field">
            <label>Статус</label>
            <select
              value={lead.status}
              onChange={(e) => changeStatus(lead, e.target.value as Lead["status"])}
              disabled={busyId === lead.id}
            >
              {(Object.keys(STATUS_LABELS) as Lead["status"][]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/LeadsList.tsx
git commit -m "feat(dashboard): add LeadsList component"
```

---

### Task 9: Add the "Лиды" nav item and `/d/leads` page

**Files:**
- Modify: `dashboard/src/components/Sidebar.tsx`
- Create: `dashboard/src/app/d/leads/page.tsx`

- [ ] **Step 1: Add the nav item**

In `dashboard/src/components/Sidebar.tsx`, the current content is:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChatIcon, FlaskIcon, GearIcon, HomeIcon, SparkleIcon } from "@/components/icons";

const ITEMS = [
  { href: "/d", label: "Обзор", Icon: HomeIcon },
  { href: "/d/conversations", label: "Диалоги", Icon: ChatIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;
```

Replace it with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

(`UsersIcon` already exists in `dashboard/src/components/icons.tsx` and is currently unused — no new icon needs to be created.)

The rest of `Sidebar.tsx` (the `Sidebar` component function itself) is unchanged.

- [ ] **Step 2: Add the page**

`dashboard/src/app/d/leads/page.tsx`:

```tsx
import { LeadsList } from "@/components/LeadsList";

export default function LeadsPage() {
  return <LeadsList />;
}
```

- [ ] **Step 3: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/Sidebar.tsx dashboard/src/app/d/leads/page.tsx
git commit -m "feat(dashboard): add Лиды nav item and /d/leads page"
```

---

### Task 10: Surface `capture_lead` in the Test Console's tool trace

**Files:**
- Modify: `dashboard/src/app/d/test-console/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add CSS for the lead-captured chip**

Append to `dashboard/src/app/globals.css`, directly after the existing `.tool-call-chip[data-gap-flagged="true"]` rule:

```css
.tool-call-chip[data-lead-captured="true"] {
  color: var(--color-warning);
  border-color: rgba(251, 191, 36, 0.3);
  background: var(--color-warning-tint);
}
```

- [ ] **Step 2: Update `ToolCallTrace`**

In `dashboard/src/app/d/test-console/page.tsx`, replace the `ToolCallTrace` function:

```tsx
function ToolCallTrace({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="tool-call-trace">
      {toolCalls.map((call, index) => {
        const escalated = call.name === "escalate_to_human";
        const gapFlagged = call.name === "flag_knowledge_gap";
        const leadCaptured = call.name === "capture_lead";
        const argsText = Object.entries(call.arguments)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(", ");
        let label: string;
        if (escalated) {
          label = `Бот бы передал администратору: ${String((call.result as { reason?: string })?.reason ?? "")}`;
        } else if (gapFlagged) {
          label = `Бот бы зафиксировал пробел в знаниях: ${String((call.result as { question?: string })?.question ?? "")}`;
        } else if (leadCaptured) {
          const lead = call.result as { name?: string; phone?: string };
          const parts = [lead?.name, lead?.phone].filter(Boolean);
          label = `Бот бы сохранил лид: ${parts.join(", ")}`;
        } else {
          label = `${call.name}(${argsText}) → ${JSON.stringify(call.result)}`;
        }
        return (
          <div
            key={index}
            className="tool-call-chip"
            data-escalated={escalated}
            data-gap-flagged={gapFlagged}
            data-lead-captured={leadCaptured}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd dashboard && npx tsc --noEmit && npm test`
Expected: build clean, all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/d/test-console/page.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): surface capture_lead in Test Console trace"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run both automated suites**

Run: `cd backend && pytest -v`
Expected: all pass, including the new `capture_lead` tests from Tasks 2–3.

Run: `cd dashboard && npm run build && npm test`
Expected: build clean, all existing vitest tests pass, new `/d/leads` and `/api/leads*` routes appear in the build output.

- [ ] **Step 2: Live walkthrough**

With both servers running (same setup as prior phases — matching `INTERNAL_API_SECRET` on both sides, `DEV_BYPASS_INIT_DATA` set for local dev):

1. Open `/d/test-console`, ask about a date that's free per the seeded test tenant's `availability_cache` (e.g. "Есть ли свободная дата 20 августа?"). Confirm the bot asks for name and phone in the same reply.
2. Reply with a name and phone number. Confirm the amber "Бот бы сохранил лид: ..." trace line appears, and confirm in Supabase that **no** row was added to `leads` — Test Console must never pollute the real queue.
3. In a real (non-test) conversation — either via the actual Telegram bot or by inserting a `conversations`/`messages` row directly and calling `generate_reply` without `test_mode` — trigger the same flow (available date → name/phone). Confirm a `leads` row is created with `status='new'`.
4. Open `/d/leads`. Confirm the lead appears with the captured name, phone, and preferred date, with a working link to its conversation.
5. Change the status dropdown to "Забронировано". Confirm in Supabase that `availability_cache` now has a row for that date with `is_available=false`.
6. Back in `/d/test-console`, ask about that same date again. Confirm `check_date_availability` now reports it unavailable — proving the loop actually closes.

- [ ] **Step 3: Commit**

No code changes in this task — if Step 2 surfaces any issues, fix them in the relevant task's files and commit there instead.

---

## Self-review notes (checked while writing this plan)

**Spec coverage:** data model (Task 1), `capture_lead` tool + merge behavior + `test_mode` (Tasks 2–3), dashboard type + data layer + booking→availability sync (Tasks 4–5), resolution API (Tasks 6–7), dashboard UI + nav (Tasks 8–9), Test Console integration (Task 10), end-to-end proof the loop closes (Task 11) — every section of `docs/superpowers/specs/2026-07-13-cortege-lead-capture-design.md` maps to a task. The spec's "explicitly out of scope" list (AI follow-up, manual lead creation, multiple leads per conversation, `client_profiles`, mobile UI) has no corresponding tasks, as intended.

**Type consistency:** `handlers.capture_lead` (Task 2, Python, returns the merged dict with snake_case-free keys since Python fields are passed straight through) → `engine.py`'s `_call_tool` test_mode branch (Task 3, returns `{would_capture_lead, **arguments}` on the fake path, the real dict on the real path) → `Lead` (Task 4, TypeScript, camelCase) → `RawLeadRow` (Task 5, snake_case wire shape) → `ToolCall` in the Test Console (Task 10, matches the existing interface unchanged, just a new `call.name` case reading `result.name`/`result.phone`, which match the raw arguments' `name`/`phone` keys the model would have passed). The snake→camel boundary is at `lib/leads.ts`, consistent with `lib/escalations.ts`/`lib/knowledgeGaps.ts`.

**Placeholder scan:** none — every step has complete code, exact file paths, and exact commands.

**Deliberate scope boundary carried from the spec:** no AI follow-up (auto-nudge) in this plan — it needs scheduling infrastructure this repo doesn't have; that's a future spec, not a task here.
