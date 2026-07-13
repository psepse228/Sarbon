# Cortège CRM Expansion — Multi-language, Kanban Leads, Broadcasts, Reviews

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Close four of the concrete gaps identified in `marketing/plans/solura/competitive-cortege-vs-businessrobotsai.md` (the BRAI competitive teardown) that don't require new external accounts/credentials or infrastructure Cortège doesn't have: multi-language guest replies, a Kanban-style leads board, an owner-triggered broadcast tool, and a lightweight review-capture mechanism. Payment rails, WhatsApp/Instagram channels, and multi-tenant/teams are explicitly out of scope for this pass (see "Explicitly out of scope").

**Why now:** User reviewed the teardown fresh against what's shipped (Phases 2–4a plus the glassmorphism visual refresh) and asked to fill out the desktop dashboard with the remaining tractable sections now, then do a design/polish pass section-by-section afterward. Visual design of the new sections should follow the existing glassmorphism system (`.card`, `.desktop-two-pane`, `.desktop-table`, etc. from `globals.css`) as-is — no new visual language, that's explicitly deferred to the follow-up polish pass the user described.

## A. Multi-language guest replies `[HIGH gap]`

**Problem:** `backend/app/ai/engine.py`'s `SYSTEM_PROMPT_BASE` currently contains an explicit instruction forcing Russian regardless of the guest's language: *"Отвечай клиенту только на русском языке, всегда — независимо от того, на каком языке он написал."* This is the opposite of the gap (BRAI auto-detects and replies in RU/UZ/EN per-message).

**Fix:** Replace that one instruction so the bot replies in whatever language the guest's most recent message is written in, defaulting to Russian when the language is ambiguous (e.g., a single emoji, a phone number). No new tooling, no language-detection library — GPT-4o handles this natively from an instruction; this is a prompt-only change.

## B. Kanban board for Leads

**Problem:** `/d/leads` (`dashboard/src/app/d/leads/page.tsx`) is currently a flat table with a status dropdown per row. The teardown's Kanban CRM gap is now only partially addressed.

**Fix:** Rewrite the page as a 4-column board — **Новые / В работе / Забронировано / Потеряно** (new/contacted/booked/lost, matching the existing `Lead["status"]` union exactly, no new statuses). Each column lists its leads as cards (name or "Без имени", phone, preferred_date, guest_count, budget — the same fields already shown in the table). Each card gets one or two buttons to move it to the adjacent column(s) (e.g., a "new" card shows "→ В работе"; a "contacted" card shows "← Новые" and "→ Забронировано"/"→ Потеряно"). This reuses the existing `updateLeadStatus(tenantId, leadId, status)` server action and `/api/leads/[id]` route as-is — **no backend or data-model changes for this section**, presentation only. No drag-and-drop library — button-driven moves are simpler, keyboard-accessible, and consistent with how every other status change in this app already works (e.g., knowledge-gap answer/dismiss buttons).

## C. Broadcasts

**Problem:** No way to message multiple guests at once (BRAI gap: broadcasts/re-engagement). Scheduled/automatic re-engagement (nudging a guest who's gone quiet) is explicitly out of scope here — it needs a job scheduler this repo doesn't have (no cron/APScheduler/pg_cron), same reasoning Phase 3 already used to defer "AI follow-up." This spec covers **owner-triggered, send-now broadcasts only**.

**Data model — new migration `0007_add_broadcasts.sql`:**
```sql
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
`audience`: `all` = every distinct `client_id` from `conversations` for the tenant; `leads_new`/`leads_contacted`/`leads_booked` = distinct `client_id` reached by joining `cortege_leads` (via `conversation_id`) filtered to that lead status. (`lost` leads are deliberately not a broadcast target — no reason to message someone marked lost.)

**Backend — new internal endpoint**, mirroring `POST /internal/test-chat`'s shared-secret pattern exactly (`backend/app/routers/internal.py`):
```
POST /internal/broadcast
Headers: X-Internal-Secret
Body: { "chat_ids": string[], "message": string }
Response: { "sent_count": number }
```
Sends `message` to each `chat_id` via the same `aiogram.Bot` instance `backend/app/notifications.py`'s `notify_admin` already uses (new shared helper, don't duplicate the `Bot(token=...)` construction — factor out a `_get_bot()` or reuse `notify_admin`'s pattern directly). Failures for individual chat IDs (blocked bot, invalid chat) are caught per-recipient and don't abort the whole batch; `sent_count` reflects actual successes.

**Dashboard:** new `dashboard/src/lib/broadcasts.ts` (mirrors `leads.ts`'s shape):
- `fetchBroadcasts(tenantId)` — reads `broadcasts` table, newest first.
- `sendBroadcast(tenantId, audience, message)` — resolves the audience to a `chat_ids` list via a Supabase query (join through `conversations`/`cortege_leads` as described above), calls the dashboard's own new `POST /api/broadcasts` route (which calls the backend's `/internal/broadcast`, same call shape as `dashboard/src/app/api/test-chat/route.ts` uses for its backend call), then inserts one row into `broadcasts` with the resolved `recipient_count`.

New `dashboard/src/app/d/broadcasts/page.tsx`: a composer card (`<textarea>` for the message, a `<select>` for audience with the four options, a send button showing recipient count after sending) above a history list (message preview, audience label, recipient count, timestamp) reusing `.card`/`.desktop-table` styling as-is.

## D. Reviews

**Problem:** No review/reputation capture (BRAI gap, `[MED]`) and no post-chat satisfaction signal at all (not in the original roadmap, but a real gap). Proactively *requesting* a review after some idle time also needs the scheduler infrastructure Cortège doesn't have — out of scope here, same as broadcasts' automatic re-engagement.

**Scope for this pass:** capture a rating whenever a guest **volunteers** feedback about their experience in the conversation (e.g., "спасибо, всё отлично, 5 из 5!" or "было супер, но пришлось долго ждать ответа") — the bot recognizes this opportunistically via a new always-on tool, the same pattern as `flag_knowledge_gap`/`capture_lead`. This does not require detecting *when* to ask — only recognizing when the guest is already giving feedback unprompted.

**Data model — new migration `0008_add_reviews.sql`:**
```sql
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
No `unique` constraint on `conversation_id` — unlike leads (one lead record per conversation, incrementally built), a review is a single volunteered statement; if a guest leaves feedback twice in one conversation, both rows are kept (simpler than deciding which one "wins").

**Backend:** new `capture_review(tenant_id, conversation_id, rating, comment=None)` in `handlers.py` (plain insert, mirrors `flag_knowledge_gap`'s shape, not `capture_lead`'s upsert). New tool added to `ALWAYS_ON_TOOLS` in `engine.py`:
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
One new sentence in `SYSTEM_PROMPT_BASE`: if the guest volunteers a rating/feedback about their experience, call `capture_review` with the rating (and comment if given) — do not ask for a rating unprompted.

**Dashboard:** new `dashboard/src/lib/reviews.ts` (`fetchReviews(tenantId)`, mirrors `leads.ts`'s read side only — reviews aren't edited or status-managed). New `dashboard/src/app/d/reviews/page.tsx`: an average-rating KPI tile (reuse `.kpi-tile`) above a list of reviews (rating as filled/empty stars — a small new `StarIcon`/rating-dots component, comment text, relative date), reusing `.card` styling.

## Navigation

Add two new items to `dashboard/src/components/Sidebar.tsx`'s `ITEMS` array: **Рассылки** (`/d/broadcasts`) and **Отзывы** (`/d/reviews`), each with a new icon in `dashboard/src/components/icons.tsx` (a simple send/megaphone shape for broadcasts — reuse the existing `SendIcon` rather than adding a new one; a simple star shape for reviews — new `StarIcon`, following the existing icon file's stroke conventions: `22x22` viewBox, `stroke-width: 1.7`, `currentColor`).

## Explicitly out of scope for this pass

- Payment/deposit collection (Click/Payme/Rahmat or Stripe/Square) — deferred pending a decision on target market (Uzbekistan vs. US), per open question raised separately.
- WhatsApp/Instagram/web-widget/email channels — needs real Meta/WhatsApp Business API credentials from the user before any code is useful; not something to scaffold speculatively.
- Multi-tenant, teams, admin roles — explicitly deferred by the user previously until a second real tenant is being onboarded (Phase 4b in the existing roadmap); unchanged by this spec.
- Scheduled/automatic re-engagement (nudge a quiet guest) and proactive review requests — both need job-scheduler infrastructure (cron/APScheduler/pg_cron) this repo doesn't have; this spec only covers send-now broadcasts and opportunistic review capture.
- Knowledge-base site crawler + file upload — a separate, larger piece of the original Phase 5 scope; not part of this pass.
- Visual/design polish of the new sections beyond reusing existing `.card`/`.desktop-table`/`.kpi-tile` classes as-is — the user explicitly wants a follow-up pass dedicated to design, section by section, once everything exists.

## Open question for planning

Exact wording/placement of the two new Sidebar nav items relative to the existing six (Обзор, Диалоги, Лиды, Настройки, Тест-консоль, Ассистент) — a reasonable default (Рассылки and Отзывы after Лиды, before Настройки, since they're guest/CRM-facing like Лиды) should be confirmed during planning, not a design blocker.
