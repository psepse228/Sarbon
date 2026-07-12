# Cortège Knowledge Gaps (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the guest bot can't ground an answer, it flags the question instead of guessing (`flag_knowledge_gap` tool, same pattern as the existing `escalate_to_human`). The owner reviews flagged questions in a new "Пробелы" tab in desktop Configuration, and can either answer one (which appends it to the existing FAQ that the bot already reads) or dismiss it (duplicate/irrelevant, no FAQ entry created).

**Architecture:** New `knowledge_gaps` Supabase table, written by the Python backend when the tool fires (mirrors `escalations`), read/resolved by the dashboard's own Supabase client (mirrors how `company_profile` CRUD already works) — no new cross-service call needed beyond what Phase 1 already built. `test_mode` short-circuits the write exactly like `escalate_to_human` already does, so Test Console conversations never pollute the real queue.

**Tech Stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend), Supabase, GPT-4o.

**Read before starting:** `docs/superpowers/specs/2026-07-12-cortege-knowledge-gaps-design.md`.

**Note on test coverage:** `backend/app/functions/handlers.py` and `backend/app/ai/engine.py` have full pytest coverage for every existing tool, including `test_mode` behavior — this plan adds equivalent tests for `flag_knowledge_gap`. On the dashboard side, Supabase-touching modules (`lib/companyProfile.ts`, `lib/escalations.ts`) have **no** existing unit tests — only pure-logic modules (`lib/stats.ts`, `lib/session.ts`, etc.) do, because mocking the Supabase client for CRUD wrappers isn't where this codebase has chosen to spend test effort. This plan follows that existing convention: `lib/knowledgeGaps.ts` gets no new unit tests, consistent with `lib/escalations.ts`. Verification for that layer is the manual end-to-end pass in Task 12, same as how Phase 1's Test Console was verified.

---

### Task 1: Add the `knowledge_gaps` table migration

**Files:**
- Create: `supabase/migrations/0004_add_knowledge_gaps.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0004_add_knowledge_gaps.sql`:

```sql
-- 0004_add_knowledge_gaps.sql
-- Questions the guest bot couldn't ground an answer for (flag_knowledge_gap
-- tool, backend/app/ai/engine.py). Owner reviews/answers/dismisses these
-- from the dashboard's Configuration -> "Пробелы" tab. Answering appends
-- the question/answer pair to company_profile.faq; dismissing just closes
-- the row with no FAQ entry created.

create table knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  conversation_id uuid references conversations(id),
  question text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  answer text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index idx_knowledge_gaps_tenant_status on knowledge_gaps(tenant_id, status);
```

- [ ] **Step 2: Apply the migration**

Run this SQL against the project's Supabase instance (via the Supabase SQL editor or CLI — same process used for `0001`–`0003`, no automated migration runner exists in this repo yet).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_add_knowledge_gaps.sql
git commit -m "feat(db): add knowledge_gaps table"
```

---

### Task 2: Add the `flag_knowledge_gap` backend handler

**Files:**
- Modify: `backend/app/functions/handlers.py`
- Test: `backend/tests/test_handlers.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_handlers.py`, near `test_escalate_to_human_inserts_and_returns_row`:

```python
async def test_flag_knowledge_gap_inserts_and_returns_row(monkeypatch):
    client = _client_with(knowledge_gaps=[])
    monkeypatch.setattr(handlers, "get_supabase_client", lambda: client)

    result = await handlers.flag_knowledge_gap(TENANT_ID, "conv-1", "есть ли парковка для автобуса?")

    assert result == {
        "tenant_id": TENANT_ID,
        "conversation_id": "conv-1",
        "question": "есть ли парковка для автобуса?",
    }
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && pytest tests/test_handlers.py::test_flag_knowledge_gap_inserts_and_returns_row -v`
Expected: FAIL with `AttributeError: module 'app.functions.handlers' has no attribute 'flag_knowledge_gap'`

- [ ] **Step 3: Implement**

Add to `backend/app/functions/handlers.py`, directly after `escalate_to_human`:

```python
async def flag_knowledge_gap(tenant_id: str, conversation_id: str, question: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("knowledge_gaps")
        .insert({"tenant_id": tenant_id, "conversation_id": conversation_id, "question": question})
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None
```

- [ ] **Step 4: Run it again**

Run: `cd backend && pytest tests/test_handlers.py::test_flag_knowledge_gap_inserts_and_returns_row -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/functions/handlers.py backend/tests/test_handlers.py
git commit -m "feat(backend): add flag_knowledge_gap handler"
```

---

### Task 3: Wire `flag_knowledge_gap` into the guest-bot engine

**Files:**
- Modify: `backend/app/ai/engine.py`
- Test: `backend/tests/test_ai_engine.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_ai_engine.py`, near the existing escalation tests:

```python
async def test_generate_reply_flags_knowledge_gap_with_tenant_and_conversation_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "flag_knowledge_gap", {"question": "есть ли парковка для автобуса?"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Уточню это и вернусь с ответом."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_flag(tenant_id, conversation_id, question):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert question == "есть ли парковка для автобуса?"
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "question": question}

    monkeypatch.setattr(engine.handlers, "flag_knowledge_gap", fake_flag)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Есть парковка для автобуса?"}])

    assert result.reply == "Уточню это и вернусь с ответом."


async def test_generate_reply_test_mode_gap_does_not_write(monkeypatch):
    tool_call = _FakeToolCall("call_1", "flag_knowledge_gap", {"question": "работает ли зимой открытая веранда?"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Уточню и вернусь с ответом."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    flag_calls = []

    async def fake_flag(tenant_id, conversation_id, question):
        flag_calls.append((tenant_id, conversation_id, question))
        return {"tenant_id": tenant_id, "conversation_id": conversation_id, "question": question}

    monkeypatch.setattr(engine.handlers, "flag_knowledge_gap", fake_flag)

    result = await engine.generate_reply(
        "tenant-1", "test-conv", [{"role": "user", "content": "работает ли зимой открытая веранда?"}], test_mode=True
    )

    assert result.reply == "Уточню и вернусь с ответом."
    assert flag_calls == []
    assert result.tool_calls == [
        engine.ToolCallRecord(
            "flag_knowledge_gap",
            {"question": "работает ли зимой открытая веранда?"},
            {"would_flag": True, "question": "работает ли зимой открытая веранда?"},
        )
    ]
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend && pytest tests/test_ai_engine.py -k "flag" -v`
Expected: FAIL — `flag_knowledge_gap` is not a recognized tool, `_call_tool` raises `ValueError: Unknown tool: flag_knowledge_gap`

- [ ] **Step 3: Implement the engine changes**

In `backend/app/ai/engine.py`:

1. Add the system-prompt instruction. Modify the `ВАЖНО:` paragraph in `SYSTEM_PROMPT_BASE` (around line 54) to also mention the new tool:

```python
    "ВАЖНО: если вопрос выходит за рамки company_profile, ни одна функция не вернула данные по теме, "
    "или это жалоба/торг по цене — ты ОБЯЗАН вызвать escalate_to_human с кратким описанием вопроса в "
    "reason, прежде чем ответить клиенту. Нельзя просто сказать «уточню и вернусь», не вызвав "
    "escalate_to_human — иначе администратор никогда не узнает, что нужно связаться с клиентом.\n"
    "ЕСЛИ КЛИЕНТ ЗАДАЛ ФАКТИЧЕСКИЙ ВОПРОС (не жалоба, не торг), а функции (get_faq, list_packages и "
    "т.д.) не вернули по нему данных — вызови flag_knowledge_gap с текстом вопроса клиента, чтобы "
    "администратор мог добавить ответ на будущее, и скажи клиенту, что уточнишь и вернёшься с "
    "ответом. Используй escalate_to_human для жалоб/торга/эскалаций к человеку, а flag_knowledge_gap "
    "— для обычных вопросов, на которые у бота просто нет данных.\n"
```

2. Add the tool definition to `TOOLS`, after the `escalate_to_human` entry:

```python
    {
        "type": "function",
        "function": {
            "name": "flag_knowledge_gap",
            "description": "Зафиксировать вопрос клиента, на который нет данных в базе знаний, чтобы администратор мог позже добавить ответ.",
            "parameters": {
                "type": "object",
                "properties": {"question": {"type": "string"}},
                "required": ["question"],
            },
        },
    },
```

3. Add the `_call_tool` branch, after the `escalate_to_human` branch:

```python
    if name == "flag_knowledge_gap":
        if test_mode:
            # No DB row — the Test Console surfaces this as "would flag" in
            # its own UI, same treatment as escalate_to_human's test_mode path.
            return {"would_flag": True, "question": arguments["question"]}
        return await handlers.flag_knowledge_gap(tenant_id, conversation_id, arguments["question"])
```

- [ ] **Step 4: Update the one real call site**

No other call site exists — `generate_reply` already passes `tenant_id`/`conversation_id`/`test_mode` through to `_call_tool` generically for every tool name.

- [ ] **Step 5: Run all backend tests**

Run: `cd backend && pytest -v`
Expected: all pass, including the two new tests.

- [ ] **Step 6: Commit**

```bash
git add backend/app/ai/engine.py backend/tests/test_ai_engine.py
git commit -m "feat(backend): flag knowledge gaps instead of guessing

New flag_knowledge_gap tool, parallel to escalate_to_human: when the
bot has no grounded answer for an ordinary factual question, it logs
the question instead of fabricating one. test_mode short-circuits the
write, same as the existing escalation path."
```

---

### Task 4: Add the `KnowledgeGap` type

**Files:**
- Modify: `dashboard/src/lib/types.ts`

- [ ] **Step 1: Add the type**

Add to `dashboard/src/lib/types.ts`, after the `Escalation` interface:

```typescript
export interface KnowledgeGap {
  id: string;
  conversationId: string;
  question: string;
  status: "open" | "answered" | "dismissed";
  answer: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/types.ts
git commit -m "feat(dashboard): add KnowledgeGap type"
```

---

### Task 5: Add `lib/knowledgeGaps.ts`

**Files:**
- Create: `dashboard/src/lib/knowledgeGaps.ts`

- [ ] **Step 1: Write the module**

`dashboard/src/lib/knowledgeGaps.ts`:

```typescript
import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import { fetchCompanyProfile, saveFaq } from "./companyProfile";
import type { KnowledgeGap } from "./types";

interface RawKnowledgeGapRow {
  id: string;
  conversation_id: string;
  question: string;
  status: "open" | "answered" | "dismissed";
  answer: string | null;
  created_at: string;
}

export async function fetchOpenKnowledgeGaps(tenantId: string): Promise<KnowledgeGap[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("knowledge_gaps")
    .select("id,conversation_id,question,status,answer,created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .returns<RawKnowledgeGapRow[]>();

  if (error) {
    throw new Error(`Failed to load knowledge_gaps: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    question: row.question,
    status: row.status,
    answer: row.answer,
    createdAt: row.created_at,
  }));
}

async function fetchGapForTenant(tenantId: string, gapId: string): Promise<RawKnowledgeGapRow> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("knowledge_gaps")
    .select("id,conversation_id,question,status,answer,created_at")
    .eq("id", gapId)
    .eq("tenant_id", tenantId)
    .maybeSingle<RawKnowledgeGapRow>();

  if (error) {
    throw new Error(`Failed to load knowledge_gaps row: ${error.message}`);
  }
  if (!data) {
    throw new Error("Knowledge gap not found for this tenant");
  }
  return data;
}

/** Appends {question, answer} to company_profile.faq (the same list
 * get_faq already reads) and marks the gap resolved. */
export async function answerKnowledgeGap(tenantId: string, gapId: string, answer: string): Promise<void> {
  const gap = await fetchGapForTenant(tenantId, gapId);

  const profile = await fetchCompanyProfile(tenantId);
  await saveFaq(tenantId, [...profile.faq, { id: crypto.randomUUID(), question: gap.question, answer }]);

  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("knowledge_gaps")
    .update({ status: "answered", answer, resolved_at: new Date().toISOString() })
    .eq("id", gapId);
  if (error) {
    throw new Error(`Failed to update knowledge_gaps: ${error.message}`);
  }
}

export async function dismissKnowledgeGap(tenantId: string, gapId: string): Promise<void> {
  await fetchGapForTenant(tenantId, gapId);

  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("knowledge_gaps")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", gapId);
  if (error) {
    throw new Error(`Failed to update knowledge_gaps: ${error.message}`);
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors. (No new unit test here — see the plan header's note on test coverage convention.)

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/knowledgeGaps.ts
git commit -m "feat(dashboard): add knowledgeGaps lib (fetch/answer/dismiss)"
```

---

### Task 6: Add `GET /api/knowledge-gaps`

**Files:**
- Create: `dashboard/src/app/api/knowledge-gaps/route.ts`

- [ ] **Step 1: Build the route**

`dashboard/src/app/api/knowledge-gaps/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { fetchOpenKnowledgeGaps } from "@/lib/knowledgeGaps";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchOpenKnowledgeGaps(tenantId));
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
git add dashboard/src/app/api/knowledge-gaps/route.ts
git commit -m "feat(dashboard): add GET /api/knowledge-gaps"
```

---

### Task 7: Add `POST /api/knowledge-gaps/[id]/answer`

**Files:**
- Create: `dashboard/src/app/api/knowledge-gaps/[id]/answer/route.ts`

- [ ] **Step 1: Build the route**

`dashboard/src/app/api/knowledge-gaps/[id]/answer/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { answerKnowledgeGap } from "@/lib/knowledgeGaps";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ answer: z.string().min(1) });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { answer } = bodySchema.parse(await request.json());
    await answerKnowledgeGap(tenantId, params.id, answer);
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
git add "dashboard/src/app/api/knowledge-gaps/[id]/answer/route.ts"
git commit -m "feat(dashboard): add POST /api/knowledge-gaps/[id]/answer"
```

---

### Task 8: Add `POST /api/knowledge-gaps/[id]/dismiss`

**Files:**
- Create: `dashboard/src/app/api/knowledge-gaps/[id]/dismiss/route.ts`

- [ ] **Step 1: Build the route**

`dashboard/src/app/api/knowledge-gaps/[id]/dismiss/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { dismissKnowledgeGap } from "@/lib/knowledgeGaps";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    await dismissKnowledgeGap(tenantId, params.id);
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
git add "dashboard/src/app/api/knowledge-gaps/[id]/dismiss/route.ts"
git commit -m "feat(dashboard): add POST /api/knowledge-gaps/[id]/dismiss"
```

---

### Task 9: Add the `KnowledgeGapsEditor` component

**Files:**
- Create: `dashboard/src/components/KnowledgeGapsEditor.tsx`

- [ ] **Step 1: Build it**

`dashboard/src/components/KnowledgeGapsEditor.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { KnowledgeGap } from "@/lib/types";

export function KnowledgeGapsEditor() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmaFetch("/api/knowledge-gaps")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить пробелы (${res.status})`);
        return (await res.json()) as KnowledgeGap[];
      })
      .then((data) => {
        if (!cancelled) setGaps(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить пробелы");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function answer(gap: KnowledgeGap) {
    const answerText = (drafts[gap.id] ?? "").trim();
    if (!answerText) return;
    setBusyId(gap.id);
    setError(null);
    try {
      const res = await tmaFetch(`/api/knowledge-gaps/${gap.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer: answerText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить ответ (${res.status})`);
      }
      setGaps((prev) => prev.filter((g) => g.id !== gap.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить ответ");
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(gap: KnowledgeGap) {
    setBusyId(gap.id);
    setError(null);
    try {
      const res = await tmaFetch(`/api/knowledge-gaps/${gap.id}/dismiss`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось отклонить (${res.status})`);
      }
      setGaps((prev) => prev.filter((g) => g.id !== gap.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Пробелы в знаниях</h1>
      <p className="muted">
        Вопросы клиентов, на которые у бота не нашлось данных. Ответьте — вопрос попадёт в «Вопросы» и бот
        будет использовать его дальше — или отклоните, если он неактуален.
      </p>

      {error && <ErrorBanner message={error} />}

      {gaps.length === 0 && <p className="muted">Открытых пробелов нет.</p>}

      {gaps.map((gap) => (
        <div key={gap.id} className="card">
          <div className="card-title-row">
            <strong>{gap.question}</strong>
            <a href={`/d/conversations/${gap.conversationId}`}>Открыть диалог</a>
          </div>
          <div className="field">
            <label>Ответ</label>
            <textarea
              rows={3}
              value={drafts[gap.id] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [gap.id]: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn btn-primary" onClick={() => answer(gap)} disabled={busyId === gap.id}>
              Ответить
            </button>
            <button className="btn btn-ghost" onClick={() => dismiss(gap)} disabled={busyId === gap.id}>
              Отклонить
            </button>
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
git add dashboard/src/components/KnowledgeGapsEditor.tsx
git commit -m "feat(dashboard): add KnowledgeGapsEditor component"
```

---

### Task 10: Add the "Пробелы" tab to desktop Configuration

**Files:**
- Modify: `dashboard/src/app/d/configuration/page.tsx`

- [ ] **Step 1: Wire in the new tab**

In `dashboard/src/app/d/configuration/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { AvailabilityManager } from "@/components/AvailabilityManager";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { FaqEditor } from "@/components/FaqEditor";
import { KnowledgeGapsEditor } from "@/components/KnowledgeGapsEditor";
import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";

type ConfigTab = "info" | "packages" | "faq" | "gaps" | "partners" | "policies" | "availability";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "info", label: "О заведении" },
  { key: "packages", label: "Пакеты" },
  { key: "faq", label: "Вопросы" },
  { key: "gaps", label: "Пробелы" },
  { key: "partners", label: "Партнёры" },
  { key: "policies", label: "Политики" },
  { key: "availability", label: "Календарь" },
];

export default function DesktopConfigurationPage() {
  const [tab, setTab] = useState<ConfigTab>("info");

  return (
    <div>
      <h1>Настройки</h1>
      <p className="muted">Данные, которые бот использует, отвечая клиентам.</p>

      <div className="segmented" style={{ marginBottom: "1.4rem", flexWrap: "wrap" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} data-active={tab === key} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <CompanyInfoEditor />}
      {tab === "packages" && <PackagesEditor />}
      {tab === "faq" && <FaqEditor />}
      {tab === "gaps" && <KnowledgeGapsEditor />}
      {tab === "partners" && <PartnersEditor />}
      {tab === "policies" && <PoliciesEditor />}
      {tab === "availability" && <AvailabilityManager />}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/d/configuration/page.tsx
git commit -m "feat(dashboard): add Пробелы tab to desktop Configuration"
```

---

### Task 11: Surface `flag_knowledge_gap` in the Test Console's tool trace

**Files:**
- Modify: `dashboard/src/app/d/test-console/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add CSS for the gap-flag chip**

Append to `dashboard/src/app/globals.css`, directly after the existing `.tool-call-chip[data-escalated="true"]` rule:

```css
.tool-call-chip[data-gap-flagged="true"] {
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
        const argsText = Object.entries(call.arguments)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(", ");
        let label: string;
        if (escalated) {
          label = `Бот бы передал администратору: ${String((call.result as { reason?: string })?.reason ?? "")}`;
        } else if (gapFlagged) {
          label = `Бот бы зафиксировал пробел в знаниях: ${String((call.result as { question?: string })?.question ?? "")}`;
        } else {
          label = `${call.name}(${argsText}) → ${JSON.stringify(call.result)}`;
        }
        return (
          <div key={index} className="tool-call-chip" data-escalated={escalated} data-gap-flagged={gapFlagged}>
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
git commit -m "feat(dashboard): surface flag_knowledge_gap in Test Console trace"
```

---

### Task 12: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run both automated suites**

Run: `cd backend && pytest -v`
Expected: all pass, including the new `flag_knowledge_gap` tests from Task 3.

Run: `cd dashboard && npm run build && npm test`
Expected: build clean, all 34+ existing vitest tests pass.

- [ ] **Step 2: Live walkthrough**

With both servers running (same setup as Phase 1's Task 12, Step 3 — matching `INTERNAL_API_SECRET` on both sides, `DEV_BYPASS_INIT_DATA` set for local dev):

1. Open `/d/test-console`, ask a question with no grounded answer in the seeded test tenant's data (e.g. something not in packages/FAQ/policies). Confirm the amber "Бот бы зафиксировал пробел в знаниях: ..." trace line appears, and confirm in Supabase that **no** row was added to `knowledge_gaps` — Test Console must never pollute the real queue.
2. In a real (non-test) conversation — either via the actual Telegram bot or by inserting a `conversations`/`messages` row directly and calling `generate_reply` without `test_mode` — trigger the same kind of ungrounded question. Confirm a `knowledge_gaps` row is created with `status='open'`.
3. Open `/d/configuration`, click the "Пробелы" tab. Confirm the flagged question appears, with a working link to its conversation.
4. Type an answer and click "Ответить". Confirm the gap disappears from the Пробелы list, and switching to the "Вопросы" tab shows the new FAQ entry.
5. Back in `/d/test-console`, ask the same question again. Confirm the bot now answers it directly via `get_faq`, with a normal (non-amber) trace line showing the `get_faq` call — proving the loop actually closes.
6. Trigger one more gap and click "Отклонить" instead. Confirm it disappears from Пробелы and does **not** appear in Вопросы.

- [ ] **Step 3: Commit**

No code changes in this task — if Step 2 surfaces any issues, fix them in the relevant task's files and commit there instead.

---

## Self-review notes (checked while writing this plan)

**Spec coverage:** detection (Tasks 2–3), storage (Task 1), resolution API (Tasks 6–8), dashboard UI (Tasks 9–10), Test Console integration (Task 11), end-to-end proof the loop closes (Task 12) — every section of `docs/superpowers/specs/2026-07-12-cortege-knowledge-gaps-design.md` maps to a task.

**Type consistency:** `handlers.flag_knowledge_gap` (Task 2, Python, returns `{tenant_id, conversation_id, question}`) → `engine.py`'s `_call_tool` test_mode branch (Task 3, returns `{would_flag, question}` on the fake path, the real dict on the real path — both are `Any` on the Python side, matching how `escalate_to_human` already does this) → `KnowledgeGap` (Task 4, TypeScript, camelCase) → `RawKnowledgeGapRow` (Task 5, snake_case wire shape) → `ToolCall` in the Test Console (Task 11, matches the existing interface unchanged, just a new `call.name` case). The snake→camel boundary is at `lib/knowledgeGaps.ts`, consistent with how `lib/escalations.ts` and `lib/companyProfile.ts` already draw that line.

**Placeholder scan:** none — every step has complete code, exact file paths, and exact commands.

**Deliberate scope boundary carried from the spec:** no notification (Telegram or otherwise) fires when a gap is flagged — the owner finds it by checking the Пробелы tab, same low-urgency treatment the spec calls for. If that turns out to be too passive in practice, that's a candidate follow-up, not part of this plan.
