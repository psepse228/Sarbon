# Cortège Mobile Design Parity & Desktop-Suggest Banner — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Bring the mobile `(mobile)/**` route tree up to the same glassmorphism visual language as the desktop shell (shipped across several earlier passes this project), and add a dismissible banner suggesting desktop users switch to `/d` when they open the site on a real computer.

## Current state (confirmed via code read)

- Mobile and desktop already share the same base tokens, fonts, and even the same class *names* for cards (`.card`, `.kpi-tile`) — the glassmorphism enhancement (`var(--glass)` background, 28px blur+saturate, sheen highlight line) was deliberately scoped to `.desktop-shell .card, .desktop-shell .kpi-tile` specifically **to avoid touching mobile inadvertently** at the time (see the comment in `globals.css` above that rule) — not for any design or performance reason. Mobile's `.card` today uses a plain `var(--color-surface)` background with a lighter 16px blur, no sheen line, no saturate.
- Mobile already reuses several of the exact components that got redesigned on desktop this session: `PackagesEditor`/`PartnersEditor` (photo-card catalog grid, already live on mobile's `(mobile)/catalog`) and toggle switches (same components, same CSS class) — **these need no further work**, they're already in sync by virtue of component reuse.
- Mobile's `(mobile)/company-profile` page still renders `AvailabilityManager` (the old flat list-based availability UI), which desktop replaced with the visual month-grid `CalendarGrid` component. `AvailabilityManager` was deliberately *kept* (not deleted) in the Catalog/Calendar batch specifically because mobile still depended on it — this pass replaces that last dependency, which means `AvailabilityManager.tsx` can finally be deleted.
- Mobile's `(mobile)/assistant` page renders `ChatThread` with no `.chat-frame` wrapper — the exact "chat floating with no frame" complaint that drove the desktop Test Console/Ассистент redesign earlier this session was never fixed on mobile's own Ассистент page. `.chat-frame` is a **globally-scoped** class (not `.desktop-shell`-scoped) so it can be reused as-is.
- `GemSmokeBackground`'s wrapper div is a bare `.desktop-ambient` class with no shell scoping in its CSS rule (`position:fixed;inset:0;z-index:0;...` — no `.desktop-shell` prefix) — it can be dropped into the mobile layout with zero CSS changes, just a rename to `.ambient-shader` for clarity now that two shells use it.
- `.top-header`/`.tab-bar` already have their own ad-hoc blur backgrounds (`rgba(11,13,18,0.4)` / `rgba(18,21,28,0.82)`) rather than the shared `--glass`/`--glass-border` tokens — bringing these onto the same tokens is part of "sync the design decisions."
- No mobile page currently has a raw `<input type="checkbox">` outside of the already-shared editor components — toggle-switch parity requires no separate mobile work.

## A. Mobile glass shell

Rename `.desktop-ambient` → `.ambient-shader` (used by both shells now). Wrap `(mobile)/layout.tsx`'s content in a `.mobile-shell` div (mirroring `.desktop-shell`'s structure) and add `<GemSmokeBackground />` inside it. Extend the existing glass rule's selector list (`globals.css`, currently `.desktop-shell .card, .desktop-shell .kpi-tile { ... }`) to also match `.mobile-shell .card, .mobile-shell .kpi-tile` — same declarations, no duplication, update the block's comment (it currently explains why mobile was *excluded*; now explain it's shared). Apply the same treatment to `.desktop-shell .meter-fill`/`.meter-track` rules (add `.mobile-shell` to those selectors too, for full parity everywhere a meter appears).

Give `.container` (mobile's main content wrapper) `position: relative; z-index: 1;` — the same stacking-context fix `.desktop-content` already has, needed so cards paint above the fixed-position ambient shader per CSS painting-order rules (this exact class of bug was caught and fixed once already on desktop; apply the same fix proactively here rather than rediscovering it).

Upgrade `.top-header` and `.tab-bar` to use `var(--glass)`/`var(--glass-border)` instead of their current one-off rgba values, so the header/tab-bar visually match the glass card language instead of being a slightly different translucency.

## B. Mobile Ассистент — chat frame

`(mobile)/assistant/page.tsx`: wrap the existing `<ChatThread ... />` call in a `<div className="chat-frame">` — no other change needed, `.chat-frame` is already a shared, unscoped class with sensible responsive height (`calc(100vh - 14rem)`, clamped 420–760px) that works fine under mobile's top-header + tab-bar chrome without modification.

## C. Mobile calendar — replace `AvailabilityManager` with `CalendarGrid`

`(mobile)/company-profile/page.tsx` drops `AvailabilityManager` in favor of the same `CalendarGrid` component desktop's `/d/calendar` uses — grid only, **no Google Calendar connection panel** (that's an integration/admin concern, appropriately desktop-only; the mobile owner just needs to glance at / hand-edit availability, not configure a service account). The page fetches `AvailabilityEntry[]` via the existing `GET /api/availability` route (same one `CalendarGrid` already PUTs back to) and passes `entries`/`onChanged` — mirroring the fetch logic already written in `/d/calendar/page.tsx`, minus the connection-panel state.

Once this ships, `AvailabilityManager.tsx` has zero remaining callers (desktop already dropped it in the Catalog/Calendar batch) and gets deleted, along with `dashboard/tests/` references if any exist (none found).

## D. "Открыть десктоп-версию" — proactive suggestion banner

New `DesktopSuggestBanner.tsx`, rendered inside `(mobile)/layout.tsx` (skipped on `/login`, matching how `TopHeader` already special-cases that route). Detects a real desktop/laptop via `matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)")` — deliberately not just a width check, since a wide-viewport tablet or a phone in landscape shouldn't trigger this; `hover: hover` + `pointer: fine` specifically catches mouse-driven devices. A dismissible banner (not a hard redirect — the mobile view must remain usable from a desktop browser on purpose, e.g. for testing), dismissal remembered in `sessionStorage` for the current tab/session only (reappears in a fresh session — same lightweight non-annoying pattern as a typical "install this app" prompt). Copy: "Вы открыли Cortège с компьютера — desktop-версия даёt больше возможностей." with a link button to `/d` and a close (×) control.

This is additive to, not a replacement for, the existing "Открыть десктоп-версию" link already buried in the mobile `/more` hub page — that stays as-is for anyone who dismissed the banner and wants to switch later.

## Explicitly out of scope for this pass

- No feature parity (e.g. no mobile "Навыки ИИ" / Test Console equivalent) — this pass is visual/design parity only, not adding missing admin features to mobile. Skills editing remains desktop-only, matching the design decision that put it there in the first place (a "real bot config" surface, appropriately gated behind the fuller desktop admin experience).
- No hard/forced redirect from mobile to desktop on PC — a dismissible suggestion only, so the mobile experience stays testable/usable from any device.
- No changes to `(mobile)/login/page.tsx` itself beyond being excluded from the new banner — its Google-login flow is unrelated to this visual pass.
