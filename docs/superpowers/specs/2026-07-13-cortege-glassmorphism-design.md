# Cortège Desktop Dashboard — Glassmorphism Visual Refresh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Replace the desktop dashboard's (`dashboard/src/app/d/**`) current flat, minimal visual language with a full glassmorphism treatment, approved by the user against a live mockup (Artifact `cortege-glassmorphism.html`, 2026-07-13). The mobile/Telegram Mini App pages are untouched — this is desktop-shell-only, same boundary Phase 1 already established.

**Why now:** After the first live local test of the desktop dashboard (see project memory), the user looked at `localhost:3000/d` and said it needed a "big job" on design — the existing shell (`<h1>Обзор</h1>` + a plain 4-tile KPI grid on a near-flat background) reads as generic. The user asked to see a full-glassmorphism direction; the mockup was approved as-is.

## Visual language (approved)

Token additions to `dashboard/src/app/globals.css`, alongside (not replacing) the existing dark tokens:

```css
--glass: rgba(255, 255, 255, 0.055);
--glass-strong: rgba(255, 255, 255, 0.09);
--glass-border: rgba(255, 255, 255, 0.14);
--glass-border-soft: rgba(255, 255, 255, 0.07);
--glass-sheen: rgba(255, 255, 255, 0.5);
--color-gold: #d9b872;
--color-gold-tint: rgba(217, 184, 114, 0.14);
--color-violet: #7b7ff5;
--color-violet-tint: rgba(123, 127, 245, 0.14);
```

`--color-gold` is Cortège's own secondary accent already established in `Cortege.html` (the marketing one-pager) but never used in the live dashboard — this refresh is what introduces it into the product, used sparingly (one KPI accent, nothing structural). `--color-violet` already exists inline in `globals.css`'s body background gradient (`rgba(99, 102, 241, ...)`); promoting it to a named token is a small cleanup that falls out of this work, not a separate task.

**`.glass` primitive** (new, desktop-scoped): translucent fill + hairline border + `backdrop-filter: blur(28px) saturate(150%)` + an inset top sheen line + soft outer shadow. This becomes the new visual basis for `.card`, `.kpi-tile`, and `.desktop-sidebar` **when rendered inside `.desktop-shell`** — scope the rule under `.desktop-shell .card`, etc. (or an equivalent scoping strategy decided during planning) so the mobile app's existing `.card` styling is completely unaffected.

**Ambient background** (new, desktop-scoped): three large, blurred, slow-drifting radial-gradient "orbs" (mint top-left, violet top-right, gold bottom-center, faint) plus a subtle 28px dot-grid overlay, sitting behind `.desktop-shell` at `z-index: 0`. This is what the glass panels actually blur — without it, `backdrop-filter` has nothing behind it to read as "glass." Respects `prefers-reduced-motion` (orbs stop drifting, stay static). This replaces/extends the two existing flat radial gradients already in `body`'s background — same colors, more presence, orb count going from 2 to 3, scoped so it doesn't bleed into mobile pages (which share the same `body` today).

**Dark-only, deliberately:** the live dashboard has no light theme today (`globals.css` is dark-only by original design decision, see the Phase 1 spec's correction note). This refresh keeps that commitment rather than inventing a light variant with no product precedent.

## Scope

### A. Global primitive re-skin (cascades to every existing desktop page automatically)

Because `Conversations`, `Leads`, `Настройки` (Configuration), `Тест-консоль`, and `Ассистент` already share `.card`, `.kpi-tile`, `.desktop-table`, `.desktop-sidebar*`, and `.btn*` from `globals.css`, updating those shared rules to the glass treatment re-skins all five existing desktop pages in one pass — **no per-page component changes needed for this part.** This is the bulk of the visual impact for the least risk.

Sidebar content itself is unchanged — same six items, same routes, same icons (`dashboard/src/components/Sidebar.tsx` — note the real label is "Настройки", not "Конфигурация" as the exploratory mockup mislabeled it).

### B. New Overview (`/d`) widgets

The current Overview page (`dashboard/src/app/d/page.tsx`) is only a KPI row. The approved mockup showed three additional widgets. All three are buildable from data **already fetched** on that page (`/api/escalations`, `/api/conversations`, `/api/availability` — same three calls `computeDashboardStats` already consumes) — no new backend endpoints:

1. **Resolution meter** — big `82%`-style number + progress bar, sourced from the same `resolutionRate` already computed inline in `page.tsx`. Purely presentational, reuses existing `.meter-*` classes already defined in `globals.css` for the mobile Analytics page (desktop-scoped visual override only, not a new component).
2. **Recent activity list** — up to 5 most recent conversations (already in the fetched `conversations` array, sort by `lastMessageAt`), each row showing `clientId`, `channel`, `lastMessageAt`, and a status chip. **Correction from the mockup:** `ConversationSummary` has no guest name or message-preview field (see `dashboard/src/lib/types.ts`), so there is no name-based avatar or message snippet — drop both. The chip has exactly two states derivable from existing data: "Эскалация" (conversation id present in the escalations set, `notifiedOwner: false`) and "Решено" (otherwise) — the same boolean logic `computeDashboardStats` already uses, not a third "Лид" state (that would require also fetching `cortege_leads`, out of scope for this pass). Each row links to the existing `/d/conversations/[id]` detail route.
3. **Availability strip** — next 7 entries from the already-fetched `availability` array (not literally "next 7 calendar days," since `availability_cache` rows aren't guaranteed contiguous — take the next 7 entries with `date >= today`, ordered ascending), each showing weekday, date, and free/booked. Links to the existing `/d/configuration` availability tab.

### Explicitly out of scope

- Mobile/Telegram Mini App pages, their nav, or their visual design — untouched, matching every prior phase's boundary.
- A light theme — no product precedent, see above.
- Any new backend endpoint or data model — everything in scope B reuses data already fetched on `/d`.
- Restyling `Conversations`, `Leads`, `Настройки`, `Тест-консоль`, `Ассистент` beyond what the shared-primitive cascade (scope A) already gives them "for free" — if any of those pages need bespoke glass treatment beyond the shared classes once seen live, that's a follow-up, not part of this pass.
- A "Лид" status chip on the activity list (would need a `cortege_leads` fetch on Overview — not requested, adds a new data dependency to a page that doesn't have one today).

## Open questions for planning

1. Exact CSS scoping mechanism to keep `.glass`-ified `.card`/`.kpi-tile` rules from leaking into the mobile app's identical class names — a `.desktop-shell` ancestor selector prefix is the obvious default, confirm no existing specificity conflicts during planning.
2. Where the three ambient background `<div>`s live in the component tree (`dashboard/src/app/d/layout.tsx` is the natural place, rendered once for the whole desktop shell) — implementation detail, not a design blocker.
