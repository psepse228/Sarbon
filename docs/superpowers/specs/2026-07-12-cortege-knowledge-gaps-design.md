# Cortège Knowledge Gaps — Phase 2 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** When the guest bot hits a question it has no grounded answer for, it should flag that instead of guessing, and the owner should be able to review, answer, or dismiss those flags from the desktop dashboard — with a good answer becoming a permanent FAQ entry the bot can use going forward.

**Why now:** First phase of a locked 5-phase roadmap built from a Business Robots AI functionality teardown (`docs/superpowers/specs/... roadmap decision, 2026-07-12`; full inventory in project memory `cortege_brai_inspired_roadmap`). Chosen to go first because it's the smallest scope — it reuses the FAQ storage and Configuration UI that already exist — and because it directly reinforces Cortège's core trust claim ("never invent a price or date") that Phase 1's Test Console already demonstrates via its tool-call trace. This closes the loop: Test Console *proves* the bot doesn't guess; Knowledge Gaps is what happens in production when it legitimately doesn't know something.

---

## Context: what already exists

- **`company_profile.faq`** (jsonb array on the `company_profile` table) — the FAQ store. Read by the guest engine's `get_faq(tenant_id, topic)` tool (`backend/app/functions/handlers.py`, substring match on `question`). Written by the dashboard's `saveFaq(tenantId, faq)` (`dashboard/src/lib/companyProfile.ts`), which the existing FAQ editor in Configuration → Вопросы already calls.
- **`escalations` table** (`supabase/migrations/0001_init_schema.sql`) — structural precedent for a conversation-linked table with a reason and a resolution flag. `knowledge_gaps` follows the same shape.
- **`test_mode` threading** (Phase 1) — `_call_tool` in `engine.py` already short-circuits side-effecting tools (`escalate_to_human`) when `test_mode=True`, so Test Console conversations don't pollute real data. `flag_knowledge_gap` needs the same treatment.
- **Desktop Configuration page** (`dashboard/src/app/d/configuration/page.tsx`) — already tabbed (company profile / packages / FAQ / policies / calendar). New tab slots in beside the existing ones.

## Architecture

### 1. Detection — new `flag_knowledge_gap` tool

Add to the guest engine's function-calling tool set (`backend/app/ai/engine.py`), alongside `list_packages`/`get_faq`/etc. System prompt addition: when the guest asks something with no grounded answer available in packages/FAQ/policies, call `flag_knowledge_gap(question)` instead of guessing — then tell the guest something like "хороший вопрос, уточню это и вернусь с ответом" rather than fabricating.

`test_mode=True` behavior (Test Console): does **not** insert a `knowledge_gaps` row — returns a result shaped so the model still responds normally, and the Test Console's existing tool-trace UI shows "would flag gap: `<question>`" the same way it already shows would-be escalations. This is the same pattern already established for `escalate_to_human`, applied consistently.

### 2. Storage — new `knowledge_gaps` table

New migration, modeled on `escalations`:

```sql
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

Written by the Python backend (via `handlers.py`/`db.py`, same Supabase client the rest of the guest engine's tool handlers use) when `flag_knowledge_gap` fires for real. Read/updated by the dashboard directly via its own Supabase service-role client — same split as the rest of the app today (backend owns `conversations`/`messages` writes, dashboard owns `company_profile` CRUD and now also owns resolving gaps), so no new cross-service call is needed for the resolution side.

### 3. Resolution — new dashboard API routes

- `GET /api/knowledge-gaps?status=open` — list, default to open only.
- `POST /api/knowledge-gaps/[id]/answer` — body `{ answer: string }`. Fetches current `company_profile`, appends `{ question, answer }` via the existing `saveFaq()`, then updates the gap row: `status='answered'`, `answer`, `resolved_at=now()`.
- `POST /api/knowledge-gaps/[id]/dismiss` — sets `status='dismissed'`, `resolved_at=now()`, no FAQ entry created. For duplicates, one-offs, or questions already covered elsewhere.

No automatic re-engagement of the guest whose conversation triggered the flag — resolving a gap only affects future conversations. (A "notify this guest" feature is new scope, not part of Phase 2.)

### 4. Dashboard UI — new "Пробелы" tab

Added to the existing Configuration tab set, next to Вопросы. List of open gaps: question text, a link back to the source conversation (`/d/conversations/[id]`), an inline answer textarea, and Answer/Dismiss buttons. Resolved gaps (answered or dismissed) drop out of the default view — no history toggle for Phase 2, matching the "keep it simple at current scale" principle the rest of this roadmap follows.

---

## Data flow summary

**Real guest conversation, bot hits a gap:**
```
Guest message → generate_reply() → no grounded match →
  flag_knowledge_gap(question) called → knowledge_gaps row inserted (status=open)
  → model tells guest it'll check and follow up
```

**Owner resolves it:**
```
Configuration → Пробелы tab → GET /api/knowledge-gaps?status=open
  owner types an answer → POST /api/knowledge-gaps/[id]/answer
    → saveFaq() appends {question, answer} to company_profile.faq
    → knowledge_gaps row: status=answered, resolved_at=now()
  (or) owner dismisses → POST /api/knowledge-gaps/[id]/dismiss
    → knowledge_gaps row: status=dismissed, resolved_at=now()
```

**Test Console (test_mode=True):**
```
Test message → generate_reply(test_mode=True) → no grounded match →
  flag_knowledge_gap(question) called → NO row inserted
  → tool trace shows "would flag gap: <question>" (same pattern as would-be escalations)
```

---

## Explicitly out of scope for Phase 2

- Everything in Phases 3–5 of the roadmap (lead capture, Smart Fields, skills-as-toggles, `tenant_owners` migration, knowledge crawler, broadcasts) — see `cortege_brai_inspired_roadmap` memory for the full sequencing.
- Automatic re-engagement of the guest whose conversation triggered a flag.
- Deduplication/grouping of similar gaps from different conversations — at current single-venue conversation volume, a flat list is enough; revisit if it gets noisy.
- Any change to `get_faq`'s substring-match lookup — new entries use the same matching as existing ones. If matching quality turns out to be a problem, that's a separate, pre-existing concern, not introduced by this feature.
- Raw system-prompt editing — not part of this feature and not planned at all (see roadmap memory's "deliberately not copying" list).

## Open questions

1. Exact guest-facing phrasing for "I'll check and get back to you" when a gap is flagged — a copy detail, not a design blocker, decide during planning/implementation.
2. Whether `flag_knowledge_gap` should also fire when `get_faq`/`list_packages` are called but return no match (vs. only when the model decides on its own not to call any tool at all) — worth confirming during implementation by testing both real conversation patterns and the Test Console against realistic guest questions.
