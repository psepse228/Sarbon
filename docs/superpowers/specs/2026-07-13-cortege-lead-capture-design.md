# Cortège Lead Capture (Phase 3) Design

**Goal:** When a client shows real booking intent — asks about a specific date that turns out to be free, or says outright they want to book — the bot asks for their name and phone number in that same reply, then saves whatever it collects (name, phone, preferred date, guest count, budget) as a `lead` the owner can see and work in a new "Лиды" section of the desktop dashboard. Marking a lead "booked" automatically marks its date unavailable in `availability_cache`, closing the loop between the CRM and the bot's own availability answers.

This is the third phase of the locked BRAI-inspired roadmap (Phase 1: desktop dashboard, Phase 2: knowledge-gap loop — both shipped). It follows the same architecture and conventions as Phase 2: a Supabase table written by the Python backend when a tool fires, read/updated by the dashboard's own Supabase client, `test_mode` short-circuiting the write so the Test Console never pollutes real data.

**Tech stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend), Supabase, GPT-4o.

## Scope boundary

The roadmap's original Phase 3 note bundled four things: core lead capture, Smart Fields (auto-extracted guest count/budget/date), booking-status tied to `availability_cache`, and AI follow-up (auto-nudge a quiet guest). This spec covers the first three — all synchronous, request-driven, and fitting the tool-calling + CRUD pattern this codebase already has. **AI follow-up is deliberately excluded**: it requires a scheduling/background-job mechanism that doesn't exist anywhere in this repo yet (no cron, no APScheduler, no Supabase pg_cron), and picking that infrastructure deserves its own focused spec rather than being a bullet point here.

Also explicitly out of scope: manual lead creation from the dashboard (bot-created only, like escalations/knowledge_gaps), multiple leads per conversation (enforced at the DB level — see below), touching the existing-but-unused `client_profiles` table, and any mobile-shell UI (desktop-only, like Phase 2).

## Data model

New `leads` table:

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

- `conversation_id unique` enforces "one lead per conversation" at the DB level — a client re-inquiring in the same thread updates the existing row rather than forking a new one.
- All content fields are nullable — a lead can start as just name+phone and fill in over multiple `capture_lead` calls as the conversation continues.
- `budget` is free text, not numeric — guests describe it loosely ("до 300 тысяч", "300-400"), unlike `packages.price` which is a fixed number the owner sets.
- `client_profiles` (tenant_id, client_id, summary, tags, last_interaction) is an existing table with zero code references anywhere in the repo. It is left untouched by this phase — not repurposed, not removed.

## Backend

### `capture_lead` tool

Added to `TOOLS` in `backend/app/ai/engine.py`, alongside `escalate_to_human` and `flag_knowledge_gap`:

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

All parameters optional — the model passes whatever it currently knows each time it calls the tool; `handlers.capture_lead` merges new non-null fields into the existing row for that `conversation_id` (never overwrites a known field with a blank one — see Merge behavior below).

### System prompt addition

A new paragraph in `SYSTEM_PROMPT_BASE`, same register as the existing escalation/gap-flagging rules:

> Если дата, которую спросил клиент, оказалась свободна (check_date_availability вернул доступность), или клиент явно говорит, что хочет забронировать — в этом же ответе попроси у него имя и номер телефона, чтобы администратор мог связаться и оформить бронь. Как только клиент их укажет — вызови capture_lead с этими данными и любыми другими деталями, которые он упомянул (дата, кол-во гостей, бюджет). Не спрашивай контакты повторно в каждом сообщении, если клиент уже дал их или проигнорировал вопрос — просто продолжай отвечать по существу.

This keeps the ask to one natural moment tied to a concrete signal (an available date, or explicit booking language) rather than interrogating every visitor, and tells the model not to nag if the client doesn't respond.

### `_call_tool` branch

```python
if name == "capture_lead":
    if test_mode:
        # No DB row — Test Console surfaces this as "would capture" in its
        # own UI, same treatment as escalate_to_human/flag_knowledge_gap.
        return {"would_capture_lead": True, **arguments}
    return await handlers.capture_lead(tenant_id, conversation_id, **arguments)
```
(The `None`-filtering happens once, inside `handlers.capture_lead` — see below — rather than being duplicated here.)

### `handlers.capture_lead` — merge behavior

Supabase's `upsert(..., on_conflict="conversation_id")` replaces the whole row on conflict by default — it does not merge at the field level. A second call passing only `budget` would null out `name`/`phone` captured in an earlier call if done naively. So `capture_lead` reads the existing row first (if any), merges in Python, then upserts the merged result — same read-then-write shape `dashboard/src/lib/knowledgeGaps.ts`'s `fetchGapForTenant`-then-update already uses on the dashboard side:

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
    merged = {**existing[0], **new_fields} if existing else {"tenant_id": tenant_id, "conversation_id": conversation_id, **new_fields}

    response = client.table("leads").upsert(merged, on_conflict="conversation_id").execute()
    rows = response.data
    return rows[0] if rows else None
```

### `test_mode`

Short-circuits exactly like `escalate_to_human`/`flag_knowledge_gap` — no DB write, no read, just echoes back what would have been captured. The Test Console never pollutes the real leads list.

## Dashboard

### Navigation

`Sidebar.tsx` gets a new top-level item between «Диалоги» and «Настройки»:

```tsx
{ href: "/d/leads", label: "Лиды", Icon: PersonIcon },
```

A new `PersonIcon` is added to `icons.tsx`, matching the existing icon set's style (same stroke weight/viewBox as `ChatIcon`/`GearIcon`).

### Data layer (`dashboard/src/lib/leads.ts`, mirrors `knowledgeGaps.ts`)

- `fetchLeads(tenantId)` — all leads for the tenant, newest first. Unlike `fetchOpenKnowledgeGaps`, this does **not** filter by status — the owner needs to see the whole pipeline (new/contacted/booked/lost), not just one state.
- `updateLeadStatus(tenantId, leadId, status)` — the only mutation exposed this phase. When `status === "booked"` and the lead has a `preferred_date` set, this function also upserts `availability_cache` (`is_available: false`, `event_details: `Бронь: ${lead.name ?? "без имени"}``) for that tenant+date, in the same call. Moving a lead *off* "booked" does not auto-revert `availability_cache` — the owner handles that manually via the existing Calendar tab, same as any other availability change today.

### API routes

- `GET /api/leads` — list, guarded by `authenticateOwner` like every other route.
- `PATCH /api/leads/[id]` — body `{ status: "new" | "contacted" | "booked" | "lost" }`, calls `updateLeadStatus`.

### Types

`dashboard/src/lib/types.ts` gets:
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

### Component (`LeadsList.tsx`, mirrors `KnowledgeGapsEditor.tsx`)

Cards showing name, phone, preferred date, guest count, and budget (em-dash for any unset field), a status `<select>` that PATCHes on change, and an "Открыть диалог" link to `/d/conversations/[conversationId]` — same link pattern Knowledge Gaps already uses.

### Page (`app/d/leads/page.tsx`)

Thin wrapper, same shape as `d/configuration/page.tsx` minus the tabs — renders `<LeadsList />` under a page heading.

### Test Console

`capture_lead` gets the same amber trace-chip treatment as `flag_knowledge_gap` (`data-lead-captured="true"` on `.tool-call-chip`), rendering e.g. "Бот бы сохранил лид: Анна, +998..." without writing anything real.

## Testing

Follows the exact convention Phase 2 established (see that plan's header note): full pytest coverage for `capture_lead` in both `test_handlers.py` (upsert/merge behavior) and `test_ai_engine.py` (tool dispatch + `test_mode` short-circuit), matching the existing tests for `flag_knowledge_gap`. On the dashboard side, `lib/leads.ts` gets no new unit tests, consistent with `lib/escalations.ts` and `lib/knowledgeGaps.ts` — Supabase-touching CRUD wrappers aren't where this codebase spends test effort. Verification for that layer is a manual end-to-end pass (ask a question with an available date in the Test Console, confirm the amber trace chip; then a real conversation, confirm the lead appears in `/d/leads`; then mark it "booked," confirm `availability_cache` picks up the date).
