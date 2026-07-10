# Cortège Desktop Dashboard — Phase 1 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Add a desktop-shaped surface to the existing Cortège dashboard app for complicated settings and full monitoring, while the existing mobile/Telegram Mini App experience stays as-is for quick checks. Phase 1 ships a desktop shell around the *existing* CRUD/monitoring pages, plus one genuinely new feature: a guest-bot test console.

**Why now:** A competitive audit of Business Robots AI (`marketing/plans/solura/competitive-cortege-vs-businessrobotsai.md` in the Solura project folder) surfaced a useful reference IA (sidebar nav, Configuration/Skills split with a docked live test-chat panel) and confirmed a real trust differentiator worth being able to demo: Cortège's guest bot never invents a price or date, where the competitor's does. Explicit instruction from the owner: take inspiration from the competitor's *structure*, not its visual design — Cortège keeps its own cream/navy/gold identity.

---

## Context: what already exists (verified against the live codebase, not docs)

The `dashboard/` Next.js 14 App Router app already has a working mobile/Telegram-Mini-App-shaped experience — this was significantly more complete than `dashboard/README.md` or the Solura Brain vault described, both of which were stale as of this design. Confirmed live via direct code reading on 2026-07-11:

- **Pages:** `/` (home — package/FAQ counts, active notice), `/analytics` (resolution rate, escalation counts, upcoming free dates, links out), `/conversations` + `/conversations/[id]` (real guest↔bot transcripts), `/escalations`, `/assistant` (owner AI copilot — separate from the guest bot, answers business-overview questions and sets the active notice via natural language), `/company-profile` (info/policies/availability), `/more` → `/catalog` (packages), `/faq`, plus existing partners CRUD.
- **Shell:** `TabBar.tsx` (bottom tab nav) + `TopHeader.tsx` — mobile-card/hub-row visual language throughout.
- **Auth:** dual-path — Telegram `initData` HMAC (in-Telegram) and a Telegram Login Widget + signed session cookie (`authenticateOwner()` checks session first, falls back to `initData`) — the second path already supports standalone browser use outside Telegram, which the desktop shell reuses as-is.
- **Guest-facing engine:** `backend/app/ai/engine.py` — `generate_reply(tenant_id, conversation_id, history)`, GPT-4o with function-calling (`get_package_price`, `list_packages`, `check_date_availability`, `get_faq`, `get_partners`, `escalate_to_human`), hard system-prompt rules against inventing facts, history compaction via a cheaper summarization model past 12 turns. This is the real client-facing bot.
- **Owner copilot engine:** `dashboard/src/lib/assistant.ts` — a *separate*, TypeScript-side GPT-4o tool-calling loop (`get_business_overview`, `get_active_notice`, `set_active_notice`, `clear_active_notice`). Architecturally distinct from `engine.py` — this is a deliberate existing pattern (dashboard-side reimplementation for dashboard-only concerns), not a mistake, but see the Test Console section below for why we do *not* repeat this pattern there.

**What's genuinely missing, confirmed by reading the code rather than assuming:**
1. Any way to simulate being a guest and see what the real client-facing bot (`engine.py`) would say — `/assistant` is a different, owner-facing thing.
2. A desktop-shaped shell — sidebar nav, tables, multi-pane density. Everything today is mobile-shaped.

---

## Architecture

**Same Next.js app, new desktop route tree** (e.g. `dashboard/src/app/d/**`), sharing auth, API routes, and `lib/` with the existing mobile pages. Rejected alternatives:
- *Responsive breakpoints on the same page components* — rejected because the mobile card/hub-row visual language and a dense sidebar+table language are different enough that CSS-only adaptation fights itself; would end up conditionally rendering different components per breakpoint anyway.
- *Fully separate app* — rejected as unnecessary duplication of auth/deploy surface for a 2-person team; no benefit over a new route tree in the same app.

### Desktop IA (Phase 1 destinations)

Persistent left sidebar, ~6 destinations (deliberately fewer than BRAI's ~15 — see competitive analysis §4, "explicitly not worth copying: over-dense nav"):

1. **Overview** (landing) — KPI cards: open escalations, active conversations, resolution rate, upcoming free dates. Reuses `/api/escalations`, `/api/conversations`, `/api/availability` — the same three endpoints `/analytics` already calls. A dedicated multi-tab Analytics destination (trend lines, funnels) is explicitly deferred — not enough time-series volume yet with one pilot venue to make trend charts meaningful; revisit once real usage data exists.
2. **Conversations** — same `/api/conversations` + `/api/conversations/[id]` data as mobile, rendered as a table (client, status, last message time, escalated indicator) with a click-through detail pane instead of a card list.
3. **Configuration** — Company Profile, Catalog/Packages, FAQ, Partners, Policies, Availability. These are the *existing* CRUD editors (`PackagesEditor`, `FaqEditor`, `PartnersEditor`, `PoliciesEditor`, `CompanyInfoEditor`, `AvailabilityManager`) reused as-is, laid out under desktop sub-navigation (tabs or a settings sub-sidebar) instead of the mobile "More" hub-list. **No new backend or data model — presentation only.**
4. **Test Console** — new, see below.
5. **Assistant** — the existing owner copilot (`/api/assistant/chat`), given a desktop-width chat layout instead of the mobile full-screen chat page.

### Test Console (the one genuinely new feature)

**Requirement:** must reflect the *exact* real guest-bot behavior — same system prompt, same "never invent a price/date" guarantee — or it's testing a lie, and that guarantee is Cortège's core trust claim (directly informed by the competitor's fabricated-availability bug).

**Decision: call the real backend, not a TypeScript reimplementation.** Add one new endpoint to the Python backend, `POST /api/test-chat`, that calls the exact same `engine.generate_reply()` used for real guests, with a `test_mode: bool` flag threaded through `_call_tool` so that when `test_mode=True`:
- `escalate_to_human` does **not** insert into the `escalations` table and does **not** call `notify_admin()` — it returns a result shaped so the model still says something like "I'll check and get back to you," and the console surfaces "Would escalate: `<reason>`" in its own UI, separately from the chat bubble.
- No `conversations` or `messages` rows are created — the test conversation exists only in the browser session's local state, never touches Supabase's conversation history.
- All *read* function calls (`get_package_price`, `list_packages`, `check_date_availability`, `get_faq`, `get_partners`) behave identically to production — they should, since testing against fake data would defeat the purpose.

This was chosen over reimplementing the loop in TypeScript (the pattern `assistant.ts` already uses for the *owner* copilot) specifically because a second copy of "never invent a fact" is a real drift risk for the one guarantee that matters most, and the whole point of this feature is proving that guarantee. The cost is a new cross-service call — today the dashboard only talks to Supabase and OpenAI directly, never the FastAPI backend — which needs a simple shared-secret auth header between the two services (internal call, not user-facing, no need for anything heavier).

**UI:** a chat panel visually consistent with Cortège's cream/navy/gold identity (not BRAI's purple/generic-SaaS look) — user message / bot reply bubbles, plus a distinct visual treatment (not a chat bubble) for "would escalate" and "would check availability against `<date>`: `<available/unavailable>`" so the owner can see not just *what* the bot said but *what it looked up* to say it. This second part (showing the function calls made, not just the final reply) is new relative to anything in the mobile app today and is the main testing value — confirming the bot is grounding its answers rather than free-forming them.

---

## Data flow summary

```
Desktop Test Console (browser)
  → POST /api/test-chat (Next.js API route, dashboard)
    → authenticateOwner() [existing session/initData check]
    → forwards to FastAPI backend: POST /internal/test-chat
      [new endpoint, shared-secret header auth]
      → engine.generate_reply(tenant_id, conversation_id=<ephemeral>, history, test_mode=True)
        → real function calls against real company_profile / availability_cache
        → escalate_to_human short-circuited: no DB write, no Telegram notification
      ← { reply, tool_calls_made: [...] }
    ← relays response
  ← renders reply bubble + "what it looked up" panel
```

## Explicitly out of scope for Phase 1

- Multi-language, multi-channel (WhatsApp/Instagram), payment collection — real gaps from the competitive analysis, but separate, larger initiatives, not part of this dashboard-shell work.
- A dedicated multi-tab Analytics page with trend charts — deferred until there's enough real usage volume for trends to mean anything.
- Any change to the mobile app's pages, nav, or visual design — untouched by this work.
- `tenant_owners` table migration, RLS policies — pre-existing flagged tech debt, unrelated to this feature.

## Open questions

1. Exact desktop breakpoint / how the app decides to route into `/d/**` vs the existing mobile routes (user-agent sniff, viewport-based client redirect, or a manual "switch to desktop view" link) — needs a decision during planning, not blocking the design.
2. Shared-secret header format/name for the dashboard→backend internal call — implementation detail, not a design blocker.
