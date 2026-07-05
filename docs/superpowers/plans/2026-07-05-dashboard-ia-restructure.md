# Dashboard IA Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Cortège dashboard's flat "Ещё" hub into three clear sections — Каталог (Пакеты + Партнёры), Аналитика (self-resolution meter + escalation/availability KPIs + client-activity links), and Профиль компании (new company info fields + Политики + Календарь) — and update the tab bar and hub accordingly.

**Architecture:** Backend gets one additive Supabase migration (4 nullable text columns) plus the same "always-inject-into-system-prompt" pattern already used for `active_notice`. The dashboard reuses every existing CRUD editor component unchanged (`PackagesEditor`, `PartnersEditor`, `PoliciesEditor`) — only their page-level wiring moves — and adds one new editor (`CompanyInfoEditor`) plus two new pages (`/catalog`, `/analytics`) and one relocated page (`/company-profile`). All Аналитика metrics are computed client-side from already-existing `/api/escalations`, `/api/conversations`, `/api/availability` responses — no new backend aggregation endpoint.

**Tech Stack:** Python/FastAPI + pytest (backend), Next.js 14 App Router + TypeScript + vitest (dashboard), Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-07-05-dashboard-ia-restructure-design.md`

---

## Phase 1 — Backend: company info schema + bot awareness

### Task 1: Supabase migration for company info fields

**Files:**
- Create: `supabase/migrations/0003_add_company_info.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 0003_add_company_info.sql
-- Adds basic company-identity fields (shown in the dashboard's new
-- "Профиль компании" page and woven into the client bot's system prompt,
-- same pattern as active_notice). NULL/empty means not set.

alter table company_profile add column if not exists company_name text;
alter table company_profile add column if not exists address text;
alter table company_profile add column if not exists phone text;
alter table company_profile add column if not exists socials text;
```

- [ ] **Step 2: Ask the user to run this migration**

This environment has no direct Postgres/psql access (same constraint as
migration `0002`). Show the user the SQL above and ask them to run it via
the Supabase SQL Editor before continuing to Task 2, since Task 2's
`_fetch_company_profile` select will reference these columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_add_company_info.sql
git commit -m "feat: add migration for company_name/address/phone/socials"
```

---

### Task 2: `get_company_info` handler

**Files:**
- Modify: `backend/app/functions/handlers.py:6-26`
- Test: `backend/tests/test_handlers.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_handlers.py`, right after the existing
`test_get_active_notice_returns_none_when_no_company_profile` test (after
line 114):

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `pytest tests/test_handlers.py -k company_info -v`
Expected: FAIL with `AttributeError: module 'app.functions.handlers' has no attribute 'get_company_info'`

- [ ] **Step 3: Implement `get_company_info` and extend the select**

In `backend/app/functions/handlers.py`, replace lines 6-16:

```python
def _fetch_company_profile(tenant_id: str) -> dict[str, Any] | None:
    client = get_supabase_client()
    response = (
        client.table("company_profile")
        .select("packages,faq,partners,policies,active_notice,company_name,address,phone,socials")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    rows = response.data
    return rows[0] if rows else None
```

Then add, right after the existing `get_active_notice` function (after line 26):

```python
async def get_company_info(tenant_id: str) -> dict[str, str] | None:
    """Company name/address/phone/socials, woven into the client bot's
    system prompt when any field is set (see engine._system_message)."""
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return None
    fields = {
        "name": profile.get("company_name"),
        "address": profile.get("address"),
        "phone": profile.get("phone"),
        "socials": profile.get("socials"),
    }
    info = {key: value for key, value in fields.items() if value}
    return info or None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_handlers.py -v`
Expected: all tests PASS (including the 3 new ones and every pre-existing test in the file).

- [ ] **Step 5: Commit**

```bash
git add backend/app/functions/handlers.py backend/tests/test_handlers.py
git commit -m "feat: add get_company_info handler"
```

---

### Task 3: Inject company info into the client bot's system prompt

**Files:**
- Modify: `backend/app/ai/engine.py:53-60, 172-194`
- Test: `backend/tests/test_ai_engine.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_ai_engine.py`, right after the
`_no_active_notice` fixture (after line 17):

```python
@pytest.fixture(autouse=True)
def _no_company_info(monkeypatch):
    """Default for every test in this file — override in a specific test to
    exercise the company-info injection path."""

    async def fake_get_company_info(tenant_id):
        return None

    monkeypatch.setattr(engine.handlers, "get_company_info", fake_get_company_info)
```

Then add, after `test_generate_reply_injects_active_notice_into_system_prompt`
(after line 91):

```python
async def test_generate_reply_injects_company_info_into_system_prompt(monkeypatch):
    async def fake_get_company_info(tenant_id):
        assert tenant_id == "tenant-1"
        return {"name": "Cortège", "address": "Ташкент, ул. Examples 12", "phone": "+998 90 000-00-00"}

    monkeypatch.setattr(engine.handlers, "get_company_info", fake_get_company_info)

    client = _FakeOpenAIClient([_final_response("Мы находимся по адресу: Ташкент, ул. Examples 12.")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Где вы находитесь?"}])

    assert result == "Мы находимся по адресу: Ташкент, ул. Examples 12."
    system_message = client.chat.completions.calls[0]["messages"][0]
    assert "Ташкент, ул. Examples 12" in system_message["content"]
    assert "+998 90 000-00-00" in system_message["content"]
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `pytest tests/test_ai_engine.py -k company_info -v`
Expected: FAIL — `fixture '_no_company_info'` errors (attribute doesn't exist
yet on `engine.handlers`) or the assertion on system-message content fails.

- [ ] **Step 3: Implement the injection**

In `backend/app/ai/engine.py`, replace `_system_message` (lines 53-60):

```python
def _system_message(
    active_notice: str | None = None, company_info: dict[str, str] | None = None
) -> dict[str, str]:
    content = f"{SYSTEM_PROMPT_BASE}\nСегодняшняя дата: {date.today().isoformat()}."
    if company_info:
        lines = []
        if company_info.get("name"):
            lines.append(f"Название: {company_info['name']}")
        if company_info.get("address"):
            lines.append(f"Адрес: {company_info['address']}")
        if company_info.get("phone"):
            lines.append(f"Телефон: {company_info['phone']}")
        if company_info.get("socials"):
            lines.append(f"Соцсети/сайт: {company_info['socials']}")
        content += (
            "\n\nО ЗАВЕДЕНИИ (используй при вопросах об адресе/контактах, не выдумывай "
            "сверх этого):\n" + "\n".join(lines)
        )
    if active_notice:
        content += (
            "\n\nАКТУАЛЬНОЕ ОБЪЯВЛЕНИЕ ОТ ВЛАДЕЛЬЦА (упоминай при уместных вопросах клиента, "
            f"не выдумывай детали сверх этого текста): {active_notice}"
        )
    return {"role": "system", "content": content}
```

Then replace `_build_messages` and `generate_reply` (lines 172-217):

```python
async def _build_messages(
    client: AsyncOpenAI,
    history: list[dict[str, str]],
    active_notice: str | None,
    company_info: dict[str, str] | None,
) -> list[dict[str, Any]]:
    """Compacts long conversations so the model isn't handed a long run of raw,
    possibly-repetitive short turns — which was observed to make gpt-4o anchor on
    repeating its own last reply for later, unrelated questions. Older turns get
    folded into a short summary (via the cheap model) instead of growing forever."""
    if len(history) <= RECENT_WINDOW:
        return [_system_message(active_notice, company_info), *history]

    older, recent = history[:-RECENT_WINDOW], history[-RECENT_WINDOW:]
    summary = await _summarize(client, older)
    return [
        _system_message(active_notice, company_info),
        {"role": "system", "content": f"Краткое содержание начала переписки с этим клиентом: {summary}"},
        *recent,
    ]


async def generate_reply(tenant_id: str, conversation_id: str, history: list[dict[str, str]]) -> str:
    client = get_openai_client()
    active_notice = await handlers.get_active_notice(tenant_id)
    company_info = await handlers.get_company_info(tenant_id)
    messages: list[dict[str, Any]] = await _build_messages(client, history, active_notice, company_info)

    for _ in range(MAX_TOOL_ROUNDS):
        response = await client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
        choice = response.choices[0].message
        if not choice.tool_calls:
            return choice.content or ""

        messages.append(
            {"role": "assistant", "content": choice.content, "tool_calls": choice.tool_calls}
        )
        for tool_call in choice.tool_calls:
            arguments = json.loads(tool_call.function.arguments)
            result = await _call_tool(tool_call.function.name, arguments, tenant_id, conversation_id)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )

    return "Уточню детали у администратора и вернусь с ответом."
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_ai_engine.py -v`
Expected: all tests PASS (the new test plus every pre-existing test in the
file — the new autouse `_no_company_info` fixture keeps them unaffected).

- [ ] **Step 5: Run the full backend suite**

Run: `pytest -v`
Expected: all tests PASS (should be 42: the prior 38, + 3 new `get_company_info` tests from Task 2, + 1 new `test_generate_reply_injects_company_info_into_system_prompt` from this task).

- [ ] **Step 6: Commit**

```bash
git add backend/app/ai/engine.py backend/tests/test_ai_engine.py
git commit -m "feat: inject company info into client bot system prompt"
```

---

## Phase 2 — Dashboard data layer

### Task 4: Extend `CompanyProfile` type

**Files:**
- Modify: `dashboard/src/lib/types.ts:46-54`

- [ ] **Step 1: Add the four new fields**

Replace the `CompanyProfile` interface:

```typescript
export interface CompanyProfile {
  tenantId: string;
  packages: Package[];
  faq: FaqEntry[];
  partners: Partner[];
  policies: string;
  activeNotice: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  socials: string | null;
  updatedAt: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/lib/types.ts
git commit -m "feat: add company info fields to CompanyProfile type"
```

(This will not build cleanly on its own since `companyProfile.ts` doesn't
populate these fields yet — Task 5 fixes that immediately after. That's
expected; don't run `npm run build` as a gate until Task 5 is done.)

---

### Task 5: Extend `companyProfile.ts` — columns, mapping, `saveCompanyInfo`

**Files:**
- Modify: `dashboard/src/lib/companyProfile.ts` (whole file)

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `dashboard/src/lib/companyProfile.ts`:

```typescript
import "server-only";

import { randomUUID } from "node:crypto";

import { getServiceSupabaseClient } from "./supabase/server";
import type { CompanyProfile, FaqEntry, Package, Partner } from "./types";

const COLUMNS = "packages,faq,partners,policies,active_notice,company_name,address,phone,socials,updated_at";

// Rows seeded directly in Supabase (before this dashboard existed) predate
// the client-generated `id` field and, for partners, can have a null
// `contact`. These raw types describe what's actually on disk; the accessors
// below normalize them into the dashboard's `Package`/`FaqEntry`/`Partner`
// shape (id backfilled, `contact` defaulted to "").
type RawPackage = Omit<Package, "id"> & { id?: string };
type RawFaqEntry = Omit<FaqEntry, "id"> & { id?: string };
type RawPartner = Omit<Partner, "id" | "contact"> & { id?: string; contact: string | null };

interface CompanyProfileRow {
  packages: RawPackage[] | null;
  faq: RawFaqEntry[] | null;
  partners: RawPartner[] | null;
  policies: string | null;
  active_notice: string | null;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  socials: string | null;
  updated_at: string | null;
}

/**
 * Fetches the single `company_profile` row for a tenant. Every caller must
 * supply a `tenantId` resolved server-side from validated Telegram
 * `initData` (see src/lib/telegram/auth.ts) — never a value taken directly
 * from client input, and never hardcoded, even though only one tenant
 * exists in production today.
 */
export async function fetchCompanyProfile(tenantId: string): Promise<CompanyProfile> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("company_profile")
    .select(COLUMNS)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle<CompanyProfileRow>();

  if (error) {
    throw new Error(`Failed to load company_profile: ${error.message}`);
  }

  if (!data) {
    // No row yet for this tenant — return an empty-but-shaped profile so the
    // UI can still render forms to create the first packages/FAQ/partners.
    return {
      tenantId,
      packages: [],
      faq: [],
      partners: [],
      policies: "",
      activeNotice: null,
      companyName: null,
      address: null,
      phone: null,
      socials: null,
      updatedAt: null,
    };
  }

  return {
    tenantId,
    packages: (data.packages ?? []).map((p) => ({ ...p, id: p.id ?? randomUUID() })),
    faq: (data.faq ?? []).map((f) => ({ ...f, id: f.id ?? randomUUID() })),
    partners: (data.partners ?? []).map((p) => ({ ...p, id: p.id ?? randomUUID(), contact: p.contact ?? "" })),
    policies: data.policies ?? "",
    activeNotice: data.active_notice ?? null,
    companyName: data.company_name ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    socials: data.socials ?? null,
    updatedAt: data.updated_at,
  };
}

async function upsertColumns(tenantId: string, columns: Record<string, unknown>): Promise<void> {
  const client = getServiceSupabaseClient();

  // Update-if-exists, else insert — company_profile has no unique
  // constraint on tenant_id in the current schema, so we check first rather
  // than relying on upsert(onConflict).
  const { data: existing, error: selectError } = await client
    .from("company_profile")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (selectError) {
    throw new Error(`Failed to look up company_profile: ${selectError.message}`);
  }

  if (existing) {
    const { error } = await client
      .from("company_profile")
      .update({ ...columns, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    if (error) {
      throw new Error(`Failed to update company_profile: ${error.message}`);
    }
    return;
  }

  const { error } = await client
    .from("company_profile")
    .insert({ tenant_id: tenantId, ...columns });
  if (error) {
    throw new Error(`Failed to create company_profile row: ${error.message}`);
  }
}

function upsertColumn(
  tenantId: string,
  column: "packages" | "faq" | "partners" | "policies" | "active_notice",
  value: unknown,
): Promise<void> {
  return upsertColumns(tenantId, { [column]: value });
}

export function savePackages(tenantId: string, packages: Package[]): Promise<void> {
  return upsertColumn(tenantId, "packages", packages);
}

export function saveFaq(tenantId: string, faq: FaqEntry[]): Promise<void> {
  return upsertColumn(tenantId, "faq", faq);
}

export function savePartners(tenantId: string, partners: Partner[]): Promise<void> {
  return upsertColumn(tenantId, "partners", partners);
}

export function savePolicies(tenantId: string, policies: string): Promise<void> {
  return upsertColumn(tenantId, "policies", policies);
}

/** Read by the client-facing bot (backend/app/functions/handlers.py's
 * get_active_notice) and woven into its system prompt when set. */
export function saveActiveNotice(tenantId: string, notice: string | null): Promise<void> {
  return upsertColumn(tenantId, "active_notice", notice);
}

export interface CompanyInfoInput {
  companyName: string;
  address: string;
  phone: string;
  socials: string;
}

/** Read by the client-facing bot (backend/app/functions/handlers.py's
 * get_company_info) and woven into its system prompt when set. */
export function saveCompanyInfo(tenantId: string, info: CompanyInfoInput): Promise<void> {
  return upsertColumns(tenantId, {
    company_name: info.companyName,
    address: info.address,
    phone: info.phone,
    socials: info.socials,
  });
}
```

- [ ] **Step 2: Build to verify types line up end to end**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds (this also validates Task 4's type change against
every consumer, since `fetchCompanyProfile` now populates all the fields
the `CompanyProfile` interface requires).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/companyProfile.ts
git commit -m "feat: add saveCompanyInfo and generalize upsertColumn to upsertColumns"
```

---

### Task 6: `companyInfoSchema` + `/api/company-info` route

**Files:**
- Modify: `dashboard/src/lib/validation.ts:35-37`
- Create: `dashboard/src/app/api/company-info/route.ts`

- [ ] **Step 1: Add the schema**

In `dashboard/src/lib/validation.ts`, after `policiesSchema` (after line 37):

```typescript
export const companyInfoSchema = z.object({
  companyName: z.string(),
  address: z.string(),
  phone: z.string(),
  socials: z.string(),
});
```

- [ ] **Step 2: Create the route**

```typescript
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { saveCompanyInfo } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { companyInfoSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PUT /api/company-info — replaces company_name/address/phone/socials for the caller's tenant. */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const info = companyInfoSchema.parse(body);
    await saveCompanyInfo(tenantId, info);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 3: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/validation.ts dashboard/src/app/api/company-info/route.ts
git commit -m "feat: add /api/company-info PUT route"
```

---

### Task 7: New icons — `AnalyticsIcon`, `BuildingIcon`

**Files:**
- Modify: `dashboard/src/components/icons.tsx`

- [ ] **Step 1: Add the two icons**

Append to the end of `dashboard/src/components/icons.tsx` (after the
existing `SparkleIcon`, currently ending at line 137):

```tsx
export function AnalyticsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 18V11" />
      <path d="M11 18V6" />
      <path d="M17 18V13.5" />
    </svg>
  );
}

export function BuildingIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="4" width="9" height="14" rx="1.2" />
      <path d="M14 9h3a1 1 0 0 1 1 1v8" />
      <path d="M7.6 7.5h1M7.6 10.5h1M7.6 13.5h1M10.8 7.5h1M10.8 10.5h1M10.8 13.5h1" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/components/icons.tsx
git commit -m "feat: add AnalyticsIcon and BuildingIcon"
```

---

### Task 8: New CSS — meter, KPI row

**Files:**
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Append the new rules**

Add at the end of `dashboard/src/app/globals.css`:

```css
/* --- Analytics: meter + KPI row --- */

.meter-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.meter-label {
  font-size: 0.85rem;
  color: var(--color-text-soft);
}

.meter-value {
  font-size: 1.7rem;
  font-weight: 700;
}

.meter-track {
  height: 10px;
  border-radius: 999px;
  background: var(--color-accent-tint);
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.meter-caption {
  font-size: 0.76rem;
  color: var(--color-text-faint);
  margin: 0.5rem 0 0;
}

.kpi-row {
  display: flex;
  gap: 0.7rem;
}

.kpi-tile {
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-hairline-soft);
  border-radius: 14px;
  padding: 0.8rem 0.9rem;
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.kpi-value-warn {
  color: var(--color-warning);
}

.kpi-value-good {
  color: var(--color-accent);
}

.kpi-label {
  font-size: 0.72rem;
  color: var(--color-text-soft);
  margin-top: 0.15rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/globals.css
git commit -m "feat: add meter and KPI-row styles for Analytics page"
```

---

## Phase 3 — New/relocated components

### Task 9: `CompanyInfoEditor` component

**Files:**
- Create: `dashboard/src/components/CompanyInfoEditor.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export function CompanyInfoEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [socials, setSocials] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setCompanyName(profile.companyName ?? "");
    setAddress(profile.address ?? "");
    setPhone(profile.phone ?? "");
    setSocials(profile.socials ?? "");
  }, [profile]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/company-info", {
        method: "PUT",
        body: JSON.stringify({ companyName, address, phone, socials }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="card">
      <div className="card-title-row">
        <h3>О компании</h3>
      </div>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="field">
        <label>Название</label>
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Например, Cortège" />
      </div>
      <div className="field">
        <label>Адрес</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Город, улица, дом" />
      </div>
      <div className="field">
        <label>Телефон</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000-00-00" />
      </div>
      <div className="field">
        <label>Соцсети / сайт (по одному на строку)</label>
        <textarea
          rows={3}
          value={socials}
          onChange={(e) => setSocials(e.target.value)}
          placeholder={"Instagram: @venue\nСайт: venue.ru"}
        />
      </div>

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds (component isn't imported anywhere yet, so this
just checks it compiles standalone — TypeScript still checks unreferenced
files under `src/`).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/CompanyInfoEditor.tsx
git commit -m "feat: add CompanyInfoEditor component"
```

---

### Task 10: Extract `AvailabilityManager` from the availability page

**Files:**
- Create: `dashboard/src/components/AvailabilityManager.tsx`

- [ ] **Step 1: Write the component**

This is the exact current contents of
`dashboard/src/app/availability/page.tsx`, moved to a named export
component (`export function AvailabilityManager()` instead of
`export default function AvailabilityPage()`); nothing else changes:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AvailabilityManager() {
  const [items, setItems] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [date, setDate] = useState(todayIso());
  const [isAvailable, setIsAvailable] = useState(false);
  const [eventDetails, setEventDetails] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await tmaFetch("/api/availability");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setItems(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить даты");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addOrUpdate() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await tmaFetch("/api/availability", {
        method: "PUT",
        body: JSON.stringify({ date, isAvailable, eventDetails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setEventDetails("");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      const res = await tmaFetch(`/api/availability?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(previous);
    }
  }

  return (
    <div>
      <h1>Доступность дат</h1>
      <p className="muted">Отметьте, какие даты заняты, а какие свободны для бронирования.</p>

      {error && <ErrorBanner message={error} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="card">
        <div className="field">
          <label>Дата (ГГГГ-ММ-ДД)</label>
          <input
            type="text"
            inputMode="numeric"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="2026-08-15"
          />
        </div>
        <div className="field">
          <label>Статус</label>
          <div className="segmented">
            <button data-active={!isAvailable} onClick={() => setIsAvailable(false)} type="button">
              Занято
            </button>
            <button data-active={isAvailable} onClick={() => setIsAvailable(true)} type="button">
              Свободно
            </button>
          </div>
        </div>
        <div className="field">
          <label>Детали (необязательно)</label>
          <input
            value={eventDetails}
            onChange={(e) => setEventDetails(e.target.value)}
            placeholder="Например: свадьба на 120 гостей"
          />
        </div>
        <button className="btn btn-primary" onClick={addOrUpdate} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить дату"}
        </button>
      </div>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="muted">Дат пока нет.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="card">
            <div className="card-title-row">
              <strong>{new Date(item.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</strong>
              <span className="pill">{item.isAvailable ? "Свободно" : "Занято"}</span>
            </div>
            {item.eventDetails && <p className="muted">{item.eventDetails}</p>}
            <button className="btn btn-danger" onClick={() => remove(item.id)}>
              Удалить
            </button>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds (component isn't imported anywhere yet — this
just checks it compiles standalone; the old `availability/page.tsx` still
exists and still owns the `/availability` route at this point).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/AvailabilityManager.tsx
git commit -m "feat: extract AvailabilityManager component from availability page"
```

(The old `dashboard/src/app/availability/page.tsx` still exists and still
works at this point — it's replaced in Task 12.)

---

## Phase 4 — New pages, nav rewiring, cleanup

### Task 11: `/company-profile` page + delete `/policies` and `/availability` pages

**Files:**
- Create: `dashboard/src/app/company-profile/page.tsx`
- Delete: `dashboard/src/app/policies/page.tsx`
- Delete: `dashboard/src/app/availability/page.tsx`

- [ ] **Step 1: Create the new page**

```tsx
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";

export default function CompanyProfilePage() {
  return (
    <div>
      <h1>Профиль компании</h1>
      <p className="muted">Данные о заведении, политики и календарь доступности.</p>

      <CompanyInfoEditor />
      <PoliciesEditor />
      <AvailabilityManager />
    </div>
  );
}
```

- [ ] **Step 2: Delete the two old page files**

```bash
rm dashboard/src/app/policies/page.tsx
rm dashboard/src/app/availability/page.tsx
```

(Leaving the now-empty `policies/` and `availability/` directories is
harmless — Next.js only routes on `page.tsx` presence — but delete the
directories too if your `rm`/`Remove-Item` supports it in one step, for
tidiness: `rm -r dashboard/src/app/policies dashboard/src/app/availability`
or on Windows PowerShell:
`Remove-Item -Recurse dashboard/src/app/policies,dashboard/src/app/availability`.)

- [ ] **Step 3: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds. `/policies` and `/availability` no longer appear
in the route list; `/company-profile` does.

- [ ] **Step 4: Commit**

```bash
git add -A dashboard/src/app/company-profile dashboard/src/app/policies dashboard/src/app/availability
git commit -m "feat: add /company-profile page, remove /policies and /availability pages"
```

---

### Task 12: `/catalog` page + delete `/packages` and `/partners` pages

**Files:**
- Create: `dashboard/src/app/catalog/page.tsx`
- Delete: `dashboard/src/app/packages/page.tsx`
- Delete: `dashboard/src/app/partners/page.tsx`

- [ ] **Step 1: Create the new page**

```tsx
"use client";

import { useState } from "react";

import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";

type CatalogTab = "packages" | "partners";

export default function CatalogPage() {
  const [tab, setTab] = useState<CatalogTab>("packages");

  return (
    <div>
      <div className="segmented" style={{ marginBottom: "1.2rem" }}>
        <button data-active={tab === "packages"} onClick={() => setTab("packages")} type="button">
          Пакеты
        </button>
        <button data-active={tab === "partners"} onClick={() => setTab("partners")} type="button">
          Партнёры
        </button>
      </div>

      {tab === "packages" ? <PackagesEditor /> : <PartnersEditor />}
    </div>
  );
}
```

- [ ] **Step 2: Delete the two old page files**

```bash
rm dashboard/src/app/packages/page.tsx
rm dashboard/src/app/partners/page.tsx
```

(Same note as Task 11 about optionally removing the now-empty directories.)

- [ ] **Step 3: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds. `/packages` and `/partners` no longer appear in
the route list; `/catalog` does.

- [ ] **Step 4: Commit**

```bash
git add -A dashboard/src/app/catalog dashboard/src/app/packages dashboard/src/app/partners
git commit -m "feat: add /catalog page, remove /packages and /partners pages"
```

---

### Task 13: `/analytics` page

**Files:**
- Create: `dashboard/src/app/analytics/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { BellIcon, ChatIcon, ChevronRightIcon, QuestionIcon } from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

interface Stats {
  totalConversations: number;
  conversationsWithoutEscalation: number;
  openEscalations: number;
  resolvedEscalations: number;
  upcomingAvailable: number;
}

export default function AnalyticsPage() {
  const { profile } = useCompanyProfile();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [escalationsRes, conversationsRes, availabilityRes] = await Promise.all([
          tmaFetch("/api/escalations"),
          tmaFetch("/api/conversations"),
          tmaFetch("/api/availability"),
        ]);
        if (!escalationsRes.ok || !conversationsRes.ok || !availabilityRes.ok) {
          throw new Error("Не удалось загрузить аналитику");
        }

        const escalations: Escalation[] = await escalationsRes.json();
        const conversations: ConversationSummary[] = await conversationsRes.json();
        const availability: AvailabilityEntry[] = await availabilityRes.json();
        const today = new Date().toISOString().slice(0, 10);

        const escalatedConversationIds = new Set(escalations.map((e) => e.conversationId));
        const withoutEscalation = conversations.filter((c) => !escalatedConversationIds.has(c.id)).length;

        setStats({
          totalConversations: conversations.length,
          conversationsWithoutEscalation: withoutEscalation,
          openEscalations: escalations.filter((e) => !e.notifiedOwner).length,
          resolvedEscalations: escalations.filter((e) => e.notifiedOwner).length,
          upcomingAvailable: availability.filter((a) => a.isAvailable && a.date >= today).length,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить аналитику");
      }
    })();
  }, []);

  const resolutionRate =
    stats && stats.totalConversations > 0
      ? Math.round((stats.conversationsWithoutEscalation / stats.totalConversations) * 100)
      : null;
  const faqCount = profile?.faq.length ?? 0;

  return (
    <div>
      <h1>Аналитика</h1>
      <p className="muted">Как бот и вы справляетесь с клиентами.</p>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <>
          <div className="card">
            <div className="meter-row">
              <span className="meter-label">Бот справляется сам</span>
              <span className="meter-value">{resolutionRate ?? "—"}%</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${resolutionRate ?? 0}%` }} />
            </div>
            <p className="meter-caption">
              {stats.conversationsWithoutEscalation} из {stats.totalConversations} диалогов закрыты без эскалации на человека
            </p>
          </div>

          <div className="card">
            <div className="card-title-row">
              <h3>Эскалации</h3>
            </div>
            <div className="kpi-row">
              <div className="kpi-tile">
                <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
                <div className="kpi-label">открыто</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-value kpi-value-good">{stats.resolvedEscalations}</div>
                <div className="kpi-label">решено</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-value">{stats.upcomingAvailable}</div>
                <div className="kpi-label">свободных дат</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="hub-card" style={{ background: "transparent", border: "none", padding: 0 }}>
          <Link href="/conversations" className="hub-row">
            <span className="hub-row-icon">
              <ChatIcon />
            </span>
            <span className="hub-row-label">Диалоги с клиентами</span>
            {stats && <span className="pill">{stats.totalConversations}</span>}
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
          <Link href="/faq" className="hub-row">
            <span className="hub-row-icon">
              <QuestionIcon />
            </span>
            <span className="hub-row-label">Частые вопросы</span>
            <span className="pill">{faqCount}</span>
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
          <Link href="/escalations" className="hub-row">
            <span className="hub-row-icon">
              <BellIcon />
            </span>
            <span className="hub-row-label">Эскалации</span>
            {stats && <span className="pill">{stats.openEscalations}</span>}
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds; `/analytics` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/analytics
git commit -m "feat: add /analytics page with self-resolution meter and KPIs"
```

---

### Task 14: Tab bar + header nav rewiring

**Files:**
- Modify: `dashboard/src/components/TabBar.tsx`
- Modify: `dashboard/src/components/TopHeader.tsx`

- [ ] **Step 1: Update `TabBar.tsx`**

Replace the whole file:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AnalyticsIcon, GridIcon, HomeIcon, SparkleIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "Обзор", Icon: HomeIcon },
  { href: "/analytics", label: "Аналитика", Icon: AnalyticsIcon },
  { href: "/assistant", label: "Ассистент", Icon: SparkleIcon },
  { href: "/more", label: "Ещё", Icon: GridIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tab-bar">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className="tab-bar-item" data-active={active}>
            <span className="tab-bar-icon">
              <Icon />
            </span>
            <span className="tab-bar-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Update `TopHeader.tsx`**

Replace the whole file:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronLeftIcon } from "@/components/icons";

const MAIN_TABS = ["/", "/analytics", "/assistant", "/more"];
const ANALYTICS_SUBPAGES = ["/conversations", "/escalations", "/faq"];

function backTarget(pathname: string): { href: string; label: string } | null {
  if (MAIN_TABS.includes(pathname)) return null;
  if (pathname.startsWith("/conversations/")) return { href: "/conversations", label: "Диалоги" };
  if (ANALYTICS_SUBPAGES.includes(pathname)) return { href: "/analytics", label: "Аналитика" };
  return { href: "/more", label: "Ещё" };
}

export function TopHeader() {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <header className="top-header" />;
  }

  const back = backTarget(pathname);

  return (
    <header className="top-header">
      {back ? (
        <Link href={back.href} className="top-header-back">
          <ChevronLeftIcon />
          <span>{back.label}</span>
        </Link>
      ) : (
        <span className="top-header-brand">Cortège</span>
      )}
    </header>
  );
}
```

- [ ] **Step 3: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/TabBar.tsx dashboard/src/components/TopHeader.tsx
git commit -m "feat: rewire tab bar and back-navigation for Analytics/Catalog/Company Profile"
```

---

### Task 15: Restructure the `/more` (Ещё) hub

**Files:**
- Modify: `dashboard/src/app/more/page.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
import Link from "next/link";

import { BuildingIcon, ChevronRightIcon, TagIcon } from "@/components/icons";

function LinkRow({ href, label, Icon }: { href: string; label: string; Icon: typeof TagIcon }) {
  return (
    <Link href={href} className="hub-row">
      <span className="hub-row-icon">
        <Icon />
      </span>
      <span className="hub-row-label">{label}</span>
      <ChevronRightIcon className="hub-row-chevron" />
    </Link>
  );
}

export default function MorePage() {
  return (
    <div>
      <h1>Ещё</h1>
      <p className="muted">Каталог и данные компании.</p>

      <p className="hub-group-title">Клиентское предложение</p>
      <div className="card hub-card">
        <LinkRow href="/catalog" label="Каталог" Icon={TagIcon} />
      </div>

      <p className="hub-group-title">Компания</p>
      <div className="card hub-card">
        <LinkRow href="/company-profile" label="Профиль компании" Icon={BuildingIcon} />
      </div>

      <p className="powered-by">Cortège · powered by Solura</p>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/more/page.tsx
git commit -m "feat: restructure Ещё hub into Каталог + Профиль компании"
```

---

### Task 16: Simplify the Overview page

**Files:**
- Modify: `dashboard/src/app/page.tsx`

- [ ] **Step 1: Replace the whole file**

The "Работа с клиентами" card is removed — it now duplicates the
`/analytics` hub-list added in Task 13. Only the hero stays.

```tsx
"use client";

import { ErrorBanner } from "@/components/StatusBanner";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export default function HomePage() {
  const { profile, loading, error } = useCompanyProfile();

  const packageCount = profile?.packages.length ?? 0;
  const faqCount = profile?.faq.length ?? 0;

  return (
    <div>
      <section className="hero">
        <p className="hero-eyebrow">Welcome to</p>
        <h1 className="hero-title">Cortège</h1>
        <div className="hero-stats">
          <div>
            <div className="hero-stat-value">{loading ? "—" : packageCount}</div>
            <div className="hero-stat-label">пакетов</div>
          </div>
          <div>
            <div className="hero-stat-value">{loading ? "—" : faqCount}</div>
            <div className="hero-stat-label">вопросов</div>
          </div>
        </div>
        <span className="hero-powered-by">powered by Solura</span>
      </section>

      {error && <ErrorBanner message={error} />}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run (from `dashboard/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/page.tsx
git commit -m "style: simplify Overview to hero-only now that Analytics owns the client-activity list"
```

---

## Phase 5 — Full verification

### Task 17: Lint, full build, Playwright pass, deploy

**Files:** none (verification only)

- [ ] **Step 1: Full backend test suite**

Run (from `backend/`): `pytest -v`
Expected: all tests PASS.

- [ ] **Step 2: Dashboard lint + build**

Run (from `dashboard/`):
```bash
npm run lint
npm run build
```
Expected: both succeed with no warnings. Confirm the route list shows
`/analytics`, `/catalog`, `/company-profile`, `/more` and does **not** show
`/packages`, `/partners`, `/policies`, `/availability`.

- [ ] **Step 3: Playwright screenshot pass**

Start the dev server and screenshot every changed/new page at a 390×844
mobile viewport, following the pattern established earlier in this
project (warm up each route with a plain fetch first to avoid catching
Next.js dev-mode's first-compile lag, then screenshot): `/`, `/analytics`,
`/catalog` (both the Пакеты and Партнёры tab states), `/company-profile`,
`/more`. Visually confirm:
- Tab bar shows Обзор / Аналитика / Ассистент / Ещё, in that order.
- `/analytics` shows the meter, the 3 KPI tiles, and the 3 hub-list rows
  with no visual overlap or clipped text.
- `/catalog`'s segmented toggle switches between the Пакеты and Партнёры
  editors.
- `/company-profile` shows all three cards (О компании, Политики,
  Доступность дат) stacked with normal spacing.
- `/more` shows exactly two groups with one row each.

- [ ] **Step 4: Manual bot verification**

Once the Task 1 migration has been run and at least `company_name` +
`address` are filled in via `/company-profile`, send the bot (via the
Telegram test chat) a message like "Где вы находитесь?" and confirm the
reply uses the real address rather than deflecting or inventing one —
mirrors how `active_notice` was verified end-to-end earlier this session.

- [ ] **Step 5: Push and confirm deploy**

```bash
git push origin master
```

Then confirm the Vercel deploy reaches `Ready` (from `dashboard/`):
```bash
vercel ls cortege
```

For the backend, confirm Railway picks up the new commit (this project's
existing GitHub-integration auto-deploy, same as every prior backend
change this session).
