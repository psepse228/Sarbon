# Cortège Skills-as-Toggles (Phase 4a) Design

**Goal:** The owner can turn off individual bot capabilities — pricing/packages, date availability, FAQ, partner recommendations — from a new "Навыки" tab in desktop Configuration. When a skill is off, the underlying tool is not offered to the model at all for that tenant's conversations, so the bot literally cannot call it, and falls back to its existing "no data = say you'll check with admin, never guess" behavior for anything in that topic.

This is a scoped-down version of the original Phase 4 roadmap bullet. The `tenant_owners` real-table migration (the other half of the original Phase 4) is **deliberately deferred** — the user confirmed no second tenant is being onboarded yet, and the existing `TELEGRAM_OWNER_TENANT_MAP` env-var stopgap already has the swap point isolated ([[sarbon_tenant_owners_stopgap]] memory) for whenever that becomes real. Skills-as-toggles doesn't depend on multi-tenancy — it's useful for the single pilot tenant today — so it proceeds on its own as "Phase 4a."

**Tech stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend), Supabase, GPT-4o.

## Which tools are toggleable

`escalate_to_human`, `flag_knowledge_gap`, `capture_lead` are never toggleable — they're the safety/business-critical "never guess, always log" loop, not really "capabilities" in the sense the owner would want to disable.

The remaining 5 tools are grouped into 4 toggles (get_package_price and list_packages are both just "how the bot answers pricing questions" — an owner is very unlikely to want one on and the other off):

| Toggle key | Label | Description shown to owner | Tool(s) controlled |
|---|---|---|---|
| `packages` | Пакеты и цены | Бот подсказывает пакеты и цены | `get_package_price`, `list_packages` |
| `availability` | Доступность дат | Бот проверяет свободные даты | `check_date_availability` |
| `faq` | Частые вопросы | Бот отвечает на частые вопросы | `get_faq` |
| `partners` | Партнёры | Бот рекомендует партнёров | `get_partners` |

All 4 default to enabled — a tenant that's never touched this tab behaves exactly as today.

## Data model

`company_profile` gets one new column:

```sql
-- 0006_add_disabled_skills.sql
-- Skill keys the owner has turned off (see backend/app/ai/engine.py's
-- TOGGLEABLE_TOOLS). Empty array (the default) means every toggleable
-- tool is offered to the model, same as before this column existed.

alter table company_profile add column disabled_skills jsonb not null default '[]'::jsonb;
```

`disabled_skills` is an array of the 4 toggle keys above, e.g. `["partners"]` means the `get_partners` tool is not offered.

## Backend

`backend/app/functions/handlers.py` gets `get_disabled_skills(tenant_id) -> list[str]`, reading `disabled_skills` off the same `_fetch_company_profile()` call `get_active_notice`/`get_company_info` already use (no new query):

```python
async def get_disabled_skills(tenant_id: str) -> list[str]:
    profile = _fetch_company_profile(tenant_id)
    if profile is None:
        return []
    return profile.get("disabled_skills") or []
```

`backend/app/ai/engine.py`'s module-level `TOOLS` constant is restructured into an always-on list plus a dict of toggleable groups, and a `_build_tools` function combines them based on the tenant's `disabled_skills`:

```python
ALWAYS_ON_TOOLS: list[dict[str, Any]] = [
    # escalate_to_human, flag_knowledge_gap, capture_lead — moved here unchanged
]

TOGGLEABLE_TOOLS: dict[str, list[dict[str, Any]]] = {
    "packages": [
        # get_package_price, list_packages — moved here unchanged
    ],
    "availability": [
        # check_date_availability — moved here unchanged
    ],
    "faq": [
        # get_faq — moved here unchanged
    ],
    "partners": [
        # get_partners — moved here unchanged
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

`generate_reply` fetches `disabled_skills = await handlers.get_disabled_skills(tenant_id)` alongside its existing `active_notice`/`company_info` fetches, and passes `tools=_build_tools(disabled_skills)` instead of the old static `TOOLS` constant to the `client.chat.completions.create(...)` call.

No change to `_call_tool` or the system prompt — if a tool isn't in the list offered to the model, the model cannot call it, and the existing "ЖЁСТКОЕ ПРАВИЛО: ты не хранишь цены... только вызовы функций дают тебе факты" / "если функция не вернула данные — скажи что уточнишь" rules already cover what the bot says when it has no way to answer a topic.

## Dashboard

Reuses the existing `company_profile` CRUD infrastructure rather than a new module (`company_profile` already has exactly this per-field save pattern):

- **`CompanyProfile` type** (`dashboard/src/lib/types.ts`) gets `disabledSkills: string[]`.
- **`dashboard/src/lib/companyProfile.ts`**: `COLUMNS` gets `disabled_skills` added; `CompanyProfileRow` gets `disabled_skills: string[] | null`; `fetchCompanyProfile` maps it to `disabledSkills: data.disabled_skills ?? []`; `CompanyProfileColumn` union gets `"disabled_skills"`; new `saveDisabledSkills(tenantId, disabledSkills: string[]): Promise<void>` one-liner via `upsertColumn`, same shape as `saveFaq`.
- **`dashboard/src/lib/validation.ts`**: new `disabledSkillsSchema = z.array(z.enum(["packages", "availability", "faq", "partners"]))`.
- **`PUT /api/skills`** (new route `dashboard/src/app/api/skills/route.ts`): identical shape to `PUT /api/faq` — `authenticateOwner`, validate with `disabledSkillsSchema`, `saveDisabledSkills`, return `{ ok: true }`.
- **No new GET route** — `SkillsEditor.tsx` uses the same shared `useCompanyProfile()` hook every other Configuration tab already uses; `disabledSkills` rides along in the existing `/api/company-profile` response.
- **`SkillsEditor.tsx`** (new component): 4 rows, each with the label + one-line description from the table above and a toggle switch. Unlike `FaqEditor`'s edit-then-bulk-save pattern, each toggle **saves immediately on click** — PUTs the full updated `disabledSkills` array right away, matching the per-item-action pattern `LeadsList`/`KnowledgeGapsEditor` already use (which fits a settings toggle better than a form-with-save-button).
- **`dashboard/src/app/d/configuration/page.tsx`**: new `"skills"` tab added to the existing `ConfigTab` union and `TABS` array (label "Навыки"), positioned after "Партнёры" and before "Политики" — mechanically identical to how Phase 2 added the "Пробелы" tab.

## Out of scope

- The `tenant_owners` real-table migration — explicitly deferred by the user, not part of this phase.
- Toggling `escalate_to_human`/`flag_knowledge_gap`/`capture_lead` — confirmed always-on.
- Any change to system-prompt wording — the existing "no data = don't guess" rules already cover a disabled skill's topic being asked about.

## Testing

Same convention as Phases 2-3: `backend/app/functions/handlers.py` and `backend/app/ai/engine.py` get full pytest coverage (`get_disabled_skills`, `_build_tools` filtering, `generate_reply` passing the filtered tool list through). `dashboard/src/lib/companyProfile.ts`'s `saveDisabledSkills` gets no new unit test, consistent with the rest of that file's Supabase-touching functions. Verification is `tsc --noEmit` + the existing vitest suite + a manual pass: toggle "Партнёры" off in `/d/configuration`, ask the Test Console about partners, confirm the bot no longer calls `get_partners` and instead falls back to its no-data behavior.
