# Cortège Skills-as-Toggles (Phase 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner can turn off individual bot capabilities (pricing/packages, date availability, FAQ, partner recommendations) from a new "Навыки" tab in desktop Configuration. A disabled skill's tool is not offered to the model at all for that tenant, so it literally cannot be called.

**Architecture:** New `disabled_skills jsonb` column on `company_profile` (default `[]`). Backend: `backend/app/ai/engine.py`'s module-level `TOOLS` list is restructured into an always-on list plus a dict of 4 toggleable groups; `_build_tools(disabled_skills)` filters and combines them; `generate_reply` fetches the tenant's `disabled_skills` (same pattern as its existing `active_notice`/`company_info` fetches) and passes the filtered list as `tools=`. Dashboard: reuses the existing `company_profile` CRUD infrastructure (`dashboard/src/lib/companyProfile.ts`'s `upsertColumn`) rather than a new module — same pattern as `saveFaq`/`savePackages`.

**Tech Stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend), Supabase, GPT-4o.

**Read before starting:** `docs/superpowers/specs/2026-07-13-cortege-skills-toggles-design.md`.

**Note on test coverage:** Same convention as the prior two phases — `backend/app/functions/handlers.py` and `backend/app/ai/engine.py` get full pytest coverage. `dashboard/src/lib/companyProfile.ts`'s `saveDisabledSkills` gets no new unit test, consistent with every other function in that file (Supabase-touching CRUD wrappers aren't unit-tested in this codebase). Verification for that layer is the manual pass in the final task.

**Important — read before Task 3:** `backend/tests/test_ai_engine.py` has two existing `autouse=True` fixtures (`_no_active_notice`, `_no_company_info`) that stub out handler calls `generate_reply` makes on *every* test in the file, so tests that don't care about those features don't have to mock them individually. Task 3 adds a third handler call (`get_disabled_skills`) to `generate_reply` — **you must add a matching third autouse fixture**, or every single existing test in that file (56 of them) will break, because they'll hit the real (unmocked) `handlers.get_disabled_skills`, which calls `get_supabase_client()` and fails with no real database configured. This is spelled out explicitly in Task 3, Step 1 below — don't skip it.

---

### Task 1: Add the `disabled_skills` column migration

**Files:**
- Create: `supabase/migrations/0006_add_disabled_skills.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0006_add_disabled_skills.sql`:

```sql
-- 0006_add_disabled_skills.sql
-- Skill keys the owner has turned off (see backend/app/ai/engine.py's
-- TOGGLEABLE_TOOLS). Empty array (the default) means every toggleable
-- tool is offered to the model, same as before this column existed.

alter table company_profile add column disabled_skills jsonb not null default '[]'::jsonb;
```

- [ ] **Step 2: Apply the migration**

Run this SQL against the project's Supabase instance (via the Supabase SQL editor or CLI — same process used for `0001`–`0005`, no automated migration runner exists in this repo yet).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_add_disabled_skills.sql
git commit -m "feat(db): add disabled_skills column to company_profile"
```

---

### Task 2: Add the `get_disabled_skills` backend handler

**Files:**
- Modify: `backend/app/functions/handlers.py`
- Test: `backend/tests/test_handlers.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_handlers.py`, near `test_get_active_notice_returns_notice_when_set`:

```python
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
```

(`TENANT_ID`, `COMPANY_PROFILE_ROW`, and `_client_with` are already defined at the top of the file — reuse them, don't redefine.)

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend && pytest tests/test_handlers.py -k disabled_skills -v`
Expected: FAIL with `AttributeError: module 'app.functions.handlers' has no attribute 'get_disabled_skills'`

- [ ] **Step 3: Implement**

First, update `_fetch_company_profile`'s `select(...)` call (near the top of `backend/app/functions/handlers.py`) to also fetch the new column. Change:

```python
        .select("packages,faq,partners,policies,active_notice,company_name,address,phone,socials")
```

to:

```python
        .select("packages,faq,partners,policies,active_notice,company_name,address,phone,socials,disabled_skills")
```

Then add this function to `backend/app/functions/handlers.py`, directly after `get_company_info`:

```python
async def get_disabled_skills(tenant_id: str) -> list[str]:
    """Skill keys the owner has turned off (see backend/app/ai/engine.py's
    TOGGLEABLE_TOOLS); empty list means every toggleable tool is offered."""
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return []
    return profile.get("disabled_skills") or []
```

- [ ] **Step 4: Run the tests again**

Run: `cd backend && pytest tests/test_handlers.py -k disabled_skills -v`
Expected: all 3 PASS

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && pytest -v`
Expected: all pass (57 total: 54 pre-existing + 3 new)

- [ ] **Step 6: Commit**

```bash
git add backend/app/functions/handlers.py backend/tests/test_handlers.py
git commit -m "feat(backend): add get_disabled_skills handler"
```

---

### Task 3: Restructure `TOOLS` into always-on + toggleable groups

**Files:**
- Modify: `backend/app/ai/engine.py`
- Test: `backend/tests/test_ai_engine.py`

- [ ] **Step 1: Add the autouse fixture (do this first, before writing new tests)**

Add to `backend/tests/test_ai_engine.py`, directly after the existing `_no_company_info` fixture:

```python
@pytest.fixture(autouse=True)
def _no_disabled_skills(monkeypatch):
    """Default for every test in this file — override in a specific test to
    exercise the skill-filtering path."""

    async def fake_get_disabled_skills(tenant_id):
        return []

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fake_get_disabled_skills)
```

Without this, every existing test in the file will break once Task 3's Step 3 makes `generate_reply` call `handlers.get_disabled_skills` — they'd hit the real function, which needs a real Supabase client that doesn't exist in tests.

- [ ] **Step 2: Write the failing tests**

Add to `backend/tests/test_ai_engine.py`, near the end of the file:

```python
async def test_generate_reply_offers_all_tools_when_nothing_disabled(monkeypatch):
    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    tools_used = client.chat.completions.calls[0]["tools"]
    names = {t["function"]["name"] for t in tools_used}
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


async def test_generate_reply_excludes_tools_for_disabled_skills(monkeypatch):
    async def fake_get_disabled_skills(tenant_id):
        assert tenant_id == "tenant-1"
        return ["partners", "faq"]

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fake_get_disabled_skills)

    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    tools_used = client.chat.completions.calls[0]["tools"]
    names = {t["function"]["name"] for t in tools_used}
    assert "get_partners" not in names
    assert "get_faq" not in names
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
    }
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `cd backend && pytest tests/test_ai_engine.py -k disabled -v`
Expected: FAIL — `client.chat.completions.calls[0]["tools"]` still contains all 8 tools regardless of `disabled_skills` (the second test fails because `get_partners`/`get_faq` are still present).

- [ ] **Step 4: Restructure `TOOLS` in `backend/app/ai/engine.py`**

Replace the entire `TOOLS: list[dict[str, Any]] = [...]` block (from `TOOLS: list[dict[str, Any]] = [` through the closing `]` right before `@lru_cache`) with:

```python
ALWAYS_ON_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Передать разговор администратору, когда вопрос вне компетенции бота.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
                "required": ["reason"],
            },
        },
    },
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
]

TOGGLEABLE_TOOLS: dict[str, list[dict[str, Any]]] = {
    "packages": [
        {
            "type": "function",
            "function": {
                "name": "get_package_price",
                "description": "Найти пакет и его цену по названию (например «Стандарт», «Премиум»).",
                "parameters": {
                    "type": "object",
                    "properties": {"package_name": {"type": "string"}},
                    "required": ["package_name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_packages",
                "description": "Получить список всех пакетов, если клиент не назвал конкретный пакет.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
    ],
    "availability": [
        {
            "type": "function",
            "function": {
                "name": "check_date_availability",
                "description": "Проверить, свободна ли дата (формат YYYY-MM-DD) для мероприятия.",
                "parameters": {
                    "type": "object",
                    "properties": {"date": {"type": "string"}},
                    "required": ["date"],
                },
            },
        },
    ],
    "faq": [
        {
            "type": "function",
            "function": {
                "name": "get_faq",
                "description": "Найти ответ на частый вопрос по теме (например «алкоголь», «парковка»).",
                "parameters": {
                    "type": "object",
                    "properties": {"topic": {"type": "string"}},
                    "required": ["topic"],
                },
            },
        },
    ],
    "partners": [
        {
            "type": "function",
            "function": {
                "name": "get_partners",
                "description": "Найти партнёров по категории (например «Кортеж», «Флористы»).",
                "parameters": {
                    "type": "object",
                    "properties": {"category": {"type": "string"}},
                    "required": ["category"],
                },
            },
        },
    ],
}


def _build_tools(disabled_skills: list[str]) -> list[dict[str, Any]]:
    enabled = [
        tool_def
        for skill, defs in TOGGLEABLE_TOOLS.items()
        if skill not in disabled_skills
        for tool_def in defs
    ]
    return [*enabled, *ALWAYS_ON_TOOLS]
```

Do not change `_call_tool` — it dispatches by tool name regardless of which structure the definitions live in, and every tool name is unchanged.

- [ ] **Step 5: Wire `_build_tools` into `generate_reply`**

In `backend/app/ai/engine.py`, find `generate_reply`. Change:

```python
async def generate_reply(
    tenant_id: str,
    conversation_id: str,
    history: list[dict[str, str]],
    test_mode: bool = False,
) -> GeneratedReply:
    client = get_openai_client()
    active_notice = await handlers.get_active_notice(tenant_id)
    company_info = await handlers.get_company_info(tenant_id)
    messages: list[dict[str, Any]] = await _build_messages(client, history, active_notice, company_info)
    tool_calls_made: list[ToolCallRecord] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response = await client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
```

to:

```python
async def generate_reply(
    tenant_id: str,
    conversation_id: str,
    history: list[dict[str, str]],
    test_mode: bool = False,
) -> GeneratedReply:
    client = get_openai_client()
    active_notice = await handlers.get_active_notice(tenant_id)
    company_info = await handlers.get_company_info(tenant_id)
    disabled_skills = await handlers.get_disabled_skills(tenant_id)
    messages: list[dict[str, Any]] = await _build_messages(client, history, active_notice, company_info)
    tool_calls_made: list[ToolCallRecord] = []
    tools = _build_tools(disabled_skills)

    for _ in range(MAX_TOOL_ROUNDS):
        response = await client.chat.completions.create(model=MODEL, messages=messages, tools=tools)
```

- [ ] **Step 6: Run the new tests**

Run: `cd backend && pytest tests/test_ai_engine.py -k disabled -v`
Expected: both PASS

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && pytest -v`
Expected: all pass (59 total: 57 pre-existing + 2 new). This confirms the autouse fixture from Step 1 kept every pre-existing test green.

- [ ] **Step 8: Commit**

```bash
git add backend/app/ai/engine.py backend/tests/test_ai_engine.py
git commit -m "feat(backend): make tool availability toggleable per-tenant

TOOLS is restructured into ALWAYS_ON_TOOLS (escalate_to_human,
flag_knowledge_gap, capture_lead — never toggleable) and
TOGGLEABLE_TOOLS grouped by skill key (packages, availability, faq,
partners). generate_reply fetches the tenant's disabled_skills and
passes _build_tools(disabled_skills) as the tools list, so a disabled
skill's tool is never offered to the model at all."
```

---

### Task 4: Add `disabledSkills` to the `CompanyProfile` type

**Files:**
- Modify: `dashboard/src/lib/types.ts`

- [ ] **Step 1: Add the field**

In `dashboard/src/lib/types.ts`, find the `CompanyProfile` interface:

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

Add `disabledSkills: string[];` directly before `updatedAt`:

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
  disabledSkills: string[];
  updatedAt: string | null;
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: errors — `dashboard/src/lib/companyProfile.ts`'s two `CompanyProfile`-shaped return objects are now missing `disabledSkills`. This is expected; Task 5 fixes it. Confirm the errors are exactly about the missing `disabledSkills` field and nothing else, then proceed — do not fix `companyProfile.ts` here, that's Task 5.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/types.ts
git commit -m "feat(dashboard): add disabledSkills to CompanyProfile type"
```

---

### Task 5: Wire `disabledSkills` through `companyProfile.ts`

**Files:**
- Modify: `dashboard/src/lib/companyProfile.ts`

- [ ] **Step 1: Update `COLUMNS`**

Change:

```typescript
const COLUMNS = "packages,faq,partners,policies,active_notice,company_name,address,phone,socials,updated_at";
```

to:

```typescript
const COLUMNS = "packages,faq,partners,policies,active_notice,company_name,address,phone,socials,disabled_skills,updated_at";
```

- [ ] **Step 2: Update `CompanyProfileRow`**

Change:

```typescript
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
```

to:

```typescript
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
  disabled_skills: string[] | null;
  updated_at: string | null;
}
```

- [ ] **Step 3: Update the no-row branch of `fetchCompanyProfile`**

Find the `if (!data) { return { ... } }` branch inside `fetchCompanyProfile`. Add `disabledSkills: [],` directly before `updatedAt: null,`:

```typescript
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
      disabledSkills: [],
      updatedAt: null,
    };
  }
```

- [ ] **Step 4: Update the mapped return of `fetchCompanyProfile`**

Find the final `return { ... }` in `fetchCompanyProfile` (after the `if (!data)` branch). Add `disabledSkills: data.disabled_skills ?? [],` directly before `updatedAt: data.updated_at,`:

```typescript
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
    disabledSkills: data.disabled_skills ?? [],
    updatedAt: data.updated_at,
  };
```

- [ ] **Step 5: Add `"disabled_skills"` to both column-name unions**

Change the `CompanyProfileColumn` type:

```typescript
type CompanyProfileColumn =
  | "packages"
  | "faq"
  | "partners"
  | "policies"
  | "active_notice"
  | "company_name"
  | "address"
  | "phone"
  | "socials";
```

to:

```typescript
type CompanyProfileColumn =
  | "packages"
  | "faq"
  | "partners"
  | "policies"
  | "active_notice"
  | "company_name"
  | "address"
  | "phone"
  | "socials"
  | "disabled_skills";
```

Then change the `upsertColumn` function's inline parameter union:

```typescript
function upsertColumn(
  tenantId: string,
  column: "packages" | "faq" | "partners" | "policies" | "active_notice",
  value: unknown,
): Promise<void> {
```

to:

```typescript
function upsertColumn(
  tenantId: string,
  column: "packages" | "faq" | "partners" | "policies" | "active_notice" | "disabled_skills",
  value: unknown,
): Promise<void> {
```

- [ ] **Step 6: Add `saveDisabledSkills`**

Add to the end of `dashboard/src/lib/companyProfile.ts`, after `saveCompanyInfo`:

```typescript
/** Read by the client-facing bot (backend/app/ai/engine.py's _build_tools)
 * to decide which optional tools to offer for this tenant. */
export function saveDisabledSkills(tenantId: string, disabledSkills: string[]): Promise<void> {
  return upsertColumn(tenantId, "disabled_skills", disabledSkills);
}
```

- [ ] **Step 7: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors — this resolves the errors introduced by Task 4.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/lib/companyProfile.ts
git commit -m "feat(dashboard): wire disabledSkills through companyProfile lib"
```

---

### Task 6: Add `disabledSkillsSchema`

**Files:**
- Modify: `dashboard/src/lib/validation.ts`

- [ ] **Step 1: Add the schema**

Add to the end of `dashboard/src/lib/validation.ts`:

```typescript
export const disabledSkillsSchema = z.array(z.enum(["packages", "availability", "faq", "partners"]));
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/validation.ts
git commit -m "feat(dashboard): add disabledSkillsSchema"
```

---

### Task 7: Add `PUT /api/skills`

**Files:**
- Create: `dashboard/src/app/api/skills/route.ts`

- [ ] **Step 1: Build the route**

`dashboard/src/app/api/skills/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { saveDisabledSkills } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { disabledSkillsSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PUT /api/skills — replaces the entire `disabled_skills` array for the caller's tenant. */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const disabledSkills = disabledSkillsSchema.parse(body);
    await saveDisabledSkills(tenantId, disabledSkills);
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
git add dashboard/src/app/api/skills/route.ts
git commit -m "feat(dashboard): add PUT /api/skills"
```

---

### Task 8: Add the `SkillsEditor` component

**Files:**
- Create: `dashboard/src/components/SkillsEditor.tsx`

- [ ] **Step 1: Build it**

`dashboard/src/components/SkillsEditor.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

type SkillKey = "packages" | "availability" | "faq" | "partners";

const SKILLS: { key: SkillKey; label: string; description: string }[] = [
  { key: "packages", label: "Пакеты и цены", description: "Бот подсказывает пакеты и цены" },
  { key: "availability", label: "Доступность дат", description: "Бот проверяет свободные даты" },
  { key: "faq", label: "Частые вопросы", description: "Бот отвечает на частые вопросы" },
  { key: "partners", label: "Партнёры", description: "Бот рекомендует партнёров" },
];

export function SkillsEditor() {
  const { profile, loading, error, refetch } = useCompanyProfile();
  const [disabled, setDisabled] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState<SkillKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setDisabled(profile.disabledSkills);
  }, [profile]);

  async function toggle(key: SkillKey) {
    const next = disabled.includes(key) ? disabled.filter((k) => k !== key) : [...disabled, key];
    setBusyKey(key);
    setSaveError(null);
    try {
      const res = await tmaFetch("/api/skills", { method: "PUT", body: JSON.stringify(next) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setDisabled(next);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить");
      await refetch();
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <h1>Навыки</h1>
      <p className="muted">Какие возможности бота включены для клиентов.</p>

      {saveError && <ErrorBanner message={saveError} />}

      {SKILLS.map((skill) => (
        <div key={skill.key} className="card">
          <div className="card-title-row">
            <strong>{skill.label}</strong>
            <input
              type="checkbox"
              checked={!disabled.includes(skill.key)}
              disabled={busyKey === skill.key}
              onChange={() => toggle(skill.key)}
            />
          </div>
          <p className="muted">{skill.description}</p>
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
git add dashboard/src/components/SkillsEditor.tsx
git commit -m "feat(dashboard): add SkillsEditor component"
```

---

### Task 9: Add the "Навыки" tab to desktop Configuration

**Files:**
- Modify: `dashboard/src/app/d/configuration/page.tsx`

- [ ] **Step 1: Wire in the new tab**

The current content of `dashboard/src/app/d/configuration/page.tsx` is:

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

Replace it with:

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
import { SkillsEditor } from "@/components/SkillsEditor";

type ConfigTab = "info" | "packages" | "faq" | "gaps" | "partners" | "skills" | "policies" | "availability";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "info", label: "О заведении" },
  { key: "packages", label: "Пакеты" },
  { key: "faq", label: "Вопросы" },
  { key: "gaps", label: "Пробелы" },
  { key: "partners", label: "Партнёры" },
  { key: "skills", label: "Навыки" },
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
      {tab === "skills" && <SkillsEditor />}
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
git commit -m "feat(dashboard): add Навыки tab to desktop Configuration"
```

---

### Task 10: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run both automated suites**

Run: `cd backend && pytest -v`
Expected: all pass, including the 5 new tests from Tasks 2–3 (59 total).

Run: `cd dashboard && npm run build && npm test`
Expected: build clean, all existing vitest tests pass, `/d/configuration` build output unchanged (no new route — this is a tab, not a page), `/api/skills` appears in the route list.

- [ ] **Step 2: Live walkthrough**

With both servers running (same setup as prior phases):

1. Open `/d/configuration`, click the "Навыки" tab. Confirm all 4 toggles show as checked (enabled) for a tenant that's never touched this before.
2. Uncheck "Партнёры". Confirm the request succeeds and the checkbox stays unchecked after a page refresh.
3. Open `/d/test-console`, ask about partners (e.g. "Кого посоветуете для флористики?"). Confirm the bot does **not** call `get_partners` — the trace either shows no tool call, or shows the bot falling back to its "уточню у администратора" behavior, never a fabricated partner recommendation.
4. Re-check "Партнёры" in Настройки → Навыки. Ask the same question again in Тест-консоль. Confirm `get_partners` is called and the bot answers normally — proving the toggle round-trips correctly in both directions.

- [ ] **Step 3: Commit**

No code changes in this task — if Step 2 surfaces any issues, fix them in the relevant task's files and commit there instead.

---

## Self-review notes (checked while writing this plan)

**Spec coverage:** data model (Task 1), backend handler + engine restructuring + `_build_tools` filtering (Tasks 2–3), dashboard type + companyProfile.ts wiring + validation (Tasks 4–6), API route (Task 7), UI component + tab wiring (Tasks 8–9), end-to-end proof the toggle round-trips (Task 10) — every section of `docs/superpowers/specs/2026-07-13-cortege-skills-toggles-design.md` maps to a task. The spec's "out of scope" list (tenant_owners migration, toggling the always-on tools, system-prompt changes) has no corresponding tasks, as intended.

**Type consistency:** `handlers.get_disabled_skills` (Task 2, Python, returns `list[str]`) → `_build_tools(disabled_skills: list[str])` (Task 3) → `disabled_skills` param threaded through `generate_reply` → `CompanyProfile.disabledSkills: string[]` (Task 4, TypeScript camelCase) → `CompanyProfileRow.disabled_skills` (Task 5, snake_case wire shape) → `disabledSkillsSchema` validating the same 4 keys used in Task 3's `TOGGLEABLE_TOOLS` dict keys (`packages`/`availability`/`faq`/`partners`) → `SkillsEditor`'s `SkillKey` type (Task 8, same 4 literals). Confirmed the skill keys are spelled identically in all four places (Python dict keys, Zod enum, TypeScript `SkillKey` union, `SkillsEditor`'s `SKILLS` array).

**Placeholder scan:** none — every step has complete code, exact file paths, and exact commands.

**Deliberate scope boundary carried from the spec:** no `tenant_owners` migration in this plan — explicitly deferred by the user; a future phase, not part of Phase 4a.
