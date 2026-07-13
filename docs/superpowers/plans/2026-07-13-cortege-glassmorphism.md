# Cortège Desktop Dashboard — Glassmorphism Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the desktop dashboard (`dashboard/src/app/d/**`) with the full-glassmorphism visual language the user approved against a live mockup, and add three new Overview widgets (resolution meter, recent activity, availability strip) built entirely from data the page already fetches.

**Architecture:** New CSS custom properties (`--glass*`, `--color-gold*`, `--color-violet*`) and a desktop-scoped `.glass`-style treatment applied to the *existing* shared classes (`.card`, `.kpi-tile`, `.desktop-sidebar`) via a `.desktop-shell` ancestor selector, so all five existing desktop pages re-skin automatically with zero JSX changes. A new three-orb ambient background (`.desktop-ambient`) sits behind the shell for the glass panels to actually blur. Two new pure functions in `dashboard/src/lib/stats.ts` (`selectRecentActivity`, `selectUpcomingAvailability`) derive the new Overview widgets' data from arrays `/d` already fetches — no new backend endpoints.

**Tech Stack:** Next.js 14 App Router / TypeScript / vitest (dashboard only — no backend changes in this plan).

**Read before starting:** `docs/superpowers/specs/2026-07-13-cortege-glassmorphism-design.md`, and look at the approved mockup this plan implements (Artifact `cortege-glassmorphism.html` referenced in that spec) before starting Task 1 — it's the visual source of truth for hex values, blur intensity, and layout proportions used throughout.

**Note on test coverage:** This codebase has no component-rendering test infrastructure (`vitest.config.ts` runs in `environment: "node"` and only collects `tests/**/*.test.ts` — no jsdom, no `@testing-library/react`, and no `.tsx` test files exist anywhere in the repo). Consistent with that existing convention, CSS and JSX/presentational changes (Tasks 1–3 and the JSX half of Task 5) get **no automated test** — verification is `npm run build` (catches TypeScript/JSX errors) plus a manual browser pass in Task 5's final step. Only the new *pure logic* added in Task 4 (`selectRecentActivity`, `selectUpcomingAvailability`, `parseLocalDate`) gets unit tests, matching how `computeDashboardStats` in the same file is already tested in `tests/stats.test.ts`.

---

### Task 1: Add glassmorphism tokens and the desktop ambient background

**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/src/app/d/layout.tsx`

- [ ] **Step 1: Add the new CSS custom properties**

In `dashboard/src/app/globals.css`, find the `:root` block (the file's first rule):

```css
  --font-heading: var(--font-unbounded), "Segoe UI", sans-serif;
  --font-body: var(--font-golos), "Segoe UI", sans-serif;
}
```

Replace with:

```css
  --font-heading: var(--font-unbounded), "Segoe UI", sans-serif;
  --font-body: var(--font-golos), "Segoe UI", sans-serif;

  --color-gold: #d9b872;
  --color-gold-tint: rgba(217, 184, 114, 0.14);
  --color-violet: #7b7ff5;
  --color-violet-tint: rgba(123, 127, 245, 0.14);
  --glass: rgba(255, 255, 255, 0.055);
  --glass-strong: rgba(255, 255, 255, 0.09);
  --glass-border: rgba(255, 255, 255, 0.14);
  --glass-border-soft: rgba(255, 255, 255, 0.07);
  --glass-sheen: rgba(255, 255, 255, 0.5);
}
```

`--color-gold` is Cortège's own secondary accent already established in `Cortege.html` (the marketing one-pager) but never used in the live dashboard until now. `--color-violet` promotes the color already inline in the body background gradient a few lines down to a named token.

- [ ] **Step 2: Add the ambient background CSS**

Append this new section at the end of `dashboard/src/app/globals.css` (after the final `.tool-call-chip[data-lead-captured="true"] { ... }` rule):

```css

/* --- Desktop shell: ambient background (glassmorphism visual refresh) ---
   Sits behind the whole desktop shell so backdrop-filter on the glass
   panels (added in Task 2) has something to actually blur. Fixed and
   scoped to z-index: 0 so it paints above the global BackgroundVideo
   (z-index: -2/-1, see layout.tsx and .app-background-*) but behind the
   sidebar/content, which get z-index: 1 in Tasks 2–3. */

.desktop-ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.desktop-ambient::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.3;
  mix-blend-mode: overlay;
}

.desktop-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(4px);
  opacity: 0.7;
  animation: desktop-orb-drift 26s ease-in-out infinite;
}

.desktop-orb-mint {
  width: 46vw;
  height: 46vw;
  top: -14%;
  left: -8%;
  background: radial-gradient(circle at 35% 35%, rgba(52, 211, 153, 0.5), rgba(52, 211, 153, 0) 70%);
}

.desktop-orb-violet {
  width: 40vw;
  height: 40vw;
  top: -6%;
  right: -12%;
  background: radial-gradient(circle at 60% 40%, var(--color-violet-tint), rgba(123, 127, 245, 0) 70%);
  animation-delay: -8s;
}

.desktop-orb-gold {
  width: 34vw;
  height: 34vw;
  bottom: -16%;
  left: 30%;
  background: radial-gradient(circle at 50% 50%, var(--color-gold-tint), rgba(217, 184, 114, 0) 70%);
  animation-delay: -16s;
}

@keyframes desktop-orb-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(3%, 4%) scale(1.06); }
}

@media (prefers-reduced-motion: reduce) {
  .desktop-orb { animation: none; }
}
```

- [ ] **Step 3: Render the ambient orbs in the desktop layout**

`dashboard/src/app/d/layout.tsx` currently reads:

```tsx
import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <Sidebar />
      <main className="desktop-content">{children}</main>
    </div>
  );
}
```

Replace with:

```tsx
import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <div className="desktop-ambient" aria-hidden="true">
        <div className="desktop-orb desktop-orb-mint" />
        <div className="desktop-orb desktop-orb-violet" />
        <div className="desktop-orb desktop-orb-gold" />
      </div>
      <Sidebar />
      <main className="desktop-content">{children}</main>
    </div>
  );
}
```

This stays a plain server component — the drift animation is pure CSS (`@keyframes`), no client-side JS needed.

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/globals.css dashboard/src/app/d/layout.tsx
git commit -m "feat(dashboard): add glassmorphism tokens and desktop ambient background"
```

---

### Task 2: Add the desktop-scoped glass primitive for cards and KPI tiles

**Files:**
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add the scoped glass rules**

Append this new section at the end of `dashboard/src/app/globals.css` (after the ambient background section added in Task 1):

```css

/* --- Desktop shell: glass primitive (glassmorphism visual refresh) ---
   Scoped under .desktop-shell so mobile's identical .card/.kpi-tile class
   names (used throughout (mobile)/**) are completely untouched — this is
   desktop-only. */

.desktop-shell .card,
.desktop-shell .kpi-tile {
  position: relative;
  overflow: hidden;
  background: var(--glass);
  border-color: var(--glass-border);
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 24px 60px -32px rgba(0, 0, 0, 0.75);
}

.desktop-shell .card::before,
.desktop-shell .kpi-tile::before {
  content: "";
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-sheen), transparent);
  opacity: 0.5;
}

.desktop-shell .meter-fill {
  background: linear-gradient(90deg, var(--color-accent-strong), var(--color-accent));
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.45);
}

.desktop-shell .meter-track {
  border: 1px solid var(--glass-border-soft);
}
```

- [ ] **Step 2: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/globals.css
git commit -m "feat(dashboard): add desktop-scoped glass primitive for cards and KPI tiles"
```

---

### Task 3: Redesign the desktop sidebar as a floating glass rail

**Files:**
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Rewrite the `.desktop-sidebar` rule**

In `dashboard/src/app/globals.css`, find:

```css
.desktop-sidebar {
  width: 232px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 1.4rem 1rem;
  border-right: 1px solid var(--color-hairline);
  background: rgba(255, 255, 255, 0.02);
}
```

Replace with:

```css
.desktop-sidebar {
  width: 248px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  margin: 1.1rem 0 1.1rem 1.1rem;
  padding: 1.5rem 1rem;
  position: sticky;
  top: 1.1rem;
  z-index: 1;
  height: calc(100vh - 2.2rem);
  border-radius: 22px;
  border: 1px solid var(--glass-border);
  background: var(--glass);
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 24px 60px -32px rgba(0, 0, 0, 0.75);
  overflow: hidden;
}

.desktop-sidebar::before {
  content: "";
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-sheen), transparent);
  opacity: 0.5;
}
```

(The rail is now a floating rounded panel with margin on three sides instead of a full-bleed, edge-to-edge strip — matches the approved mockup. `Sidebar.tsx` itself is unchanged: same six nav items, same routes, same icons.)

- [ ] **Step 2: Give `.desktop-content` an explicit stacking order**

In the same file, find:

```css
.desktop-content {
  flex: 1;
  min-width: 0;
  padding: 2rem 2.4rem;
  max-width: 1160px;
}
```

Replace with:

```css
.desktop-content {
  flex: 1;
  min-width: 0;
  padding: 2rem 2.4rem;
  max-width: 1160px;
  position: relative;
  z-index: 1;
}
```

This keeps the page content painting above the fixed `.desktop-ambient` background from Task 1 regardless of DOM order.

- [ ] **Step 3: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/globals.css
git commit -m "feat(dashboard): redesign desktop sidebar as a floating glass rail"
```

---

### Task 4: Add recent-activity, upcoming-availability, and local-date selectors

**Files:**
- Modify: `dashboard/src/lib/stats.ts`
- Test: `dashboard/tests/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

`dashboard/tests/stats.test.ts` currently starts like this:

```ts
import { describe, expect, it } from "vitest";

import { computeDashboardStats } from "@/lib/stats";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

function conversation(id: string): ConversationSummary {
  return { id, clientId: "client-1", channel: "telegram", status: "active", lastMessageAt: null, createdAt: "2026-07-01T00:00:00Z" };
}
```

Replace the import and the `conversation` helper with:

```ts
import { describe, expect, it } from "vitest";

import { computeDashboardStats, parseLocalDate, selectRecentActivity, selectUpcomingAvailability } from "@/lib/stats";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

function conversation(id: string, lastMessageAt: string | null = null): ConversationSummary {
  return { id, clientId: "client-1", channel: "telegram", status: "active", lastMessageAt, createdAt: "2026-07-01T00:00:00Z" };
}
```

(This only widens the existing helper with a second, defaulted parameter — every existing call site like `conversation("c1")` keeps working unchanged.)

Then append these three new `describe` blocks at the end of the file, after the existing `describe("computeDashboardStats", ...)` block:

```ts
describe("selectRecentActivity", () => {
  it("returns the most recent conversations first, limited to the given count", () => {
    const conversations = [
      conversation("c1", "2026-07-10T10:00:00Z"),
      conversation("c2", "2026-07-12T09:00:00Z"),
      conversation("c3", "2026-07-11T08:00:00Z"),
    ];

    const result = selectRecentActivity(conversations, [], 2);

    expect(result.map((r) => r.conversationId)).toEqual(["c2", "c3"]);
  });

  it("marks a conversation escalated only while its escalation is unnotified", () => {
    const conversations = [conversation("c1", "2026-07-12T09:00:00Z"), conversation("c2", "2026-07-12T08:00:00Z")];
    const escalations = [escalation("c1", false), escalation("c2", true)];

    const result = selectRecentActivity(conversations, escalations, 5);

    expect(result.find((r) => r.conversationId === "c1")?.status).toBe("escalated");
    expect(result.find((r) => r.conversationId === "c2")?.status).toBe("resolved");
  });

  it("sorts conversations with no lastMessageAt after ones that have it", () => {
    const conversations = [conversation("c1", null), conversation("c2", "2026-07-12T09:00:00Z")];

    const result = selectRecentActivity(conversations, [], 5);

    expect(result.map((r) => r.conversationId)).toEqual(["c2", "c1"]);
  });
});

describe("selectUpcomingAvailability", () => {
  it("drops past dates and returns the soonest ones first, limited to the given count", () => {
    const entries = [
      availability("2020-01-01", true),
      availability("2099-01-03", true),
      availability("2099-01-01", false),
      availability("2099-01-02", true),
    ];

    const result = selectUpcomingAvailability(entries, 2);

    expect(result.map((e) => e.date)).toEqual(["2099-01-01", "2099-01-02"]);
  });
});

describe("parseLocalDate", () => {
  it("does not shift to an adjacent day regardless of local timezone", () => {
    const date = parseLocalDate("2026-07-15");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(15);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npm test -- stats`
Expected: FAIL — `selectRecentActivity`, `selectUpcomingAvailability`, and `parseLocalDate` are not exported from `@/lib/stats` yet.

- [ ] **Step 3: Implement the three functions**

`dashboard/src/lib/stats.ts` currently ends with `computeDashboardStats`'s closing brace. Append:

```ts

export interface RecentActivityItem {
  conversationId: string;
  clientId: string;
  channel: string;
  lastMessageAt: string | null;
  status: "escalated" | "resolved";
}

/** Overview's "Последние диалоги" widget. Escalated means the conversation
 * has an escalation row that hasn't been handled yet (same `notifiedOwner`
 * check computeDashboardStats uses) — there's no third state here, since
 * ConversationSummary has no lead/name/message-snippet field to build one
 * from. */
export function selectRecentActivity(
  conversations: ConversationSummary[],
  escalations: Escalation[],
  limit: number,
): RecentActivityItem[] {
  const openEscalationConversationIds = new Set(
    escalations.filter((e) => !e.notifiedOwner).map((e) => e.conversationId),
  );

  return [...conversations]
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
    .slice(0, limit)
    .map((c) => ({
      conversationId: c.id,
      clientId: c.clientId,
      channel: c.channel,
      lastMessageAt: c.lastMessageAt,
      status: openEscalationConversationIds.has(c.id) ? "escalated" as const : "resolved" as const,
    }));
}

/** Overview's "Ближайшие даты" widget — the next N availability_cache rows
 * from today onward, not literally "the next N calendar days," since rows
 * aren't guaranteed contiguous. */
export function selectUpcomingAvailability(availability: AvailabilityEntry[], count: number): AvailabilityEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  return [...availability]
    .filter((a) => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count);
}

/** Parses a plain "YYYY-MM-DD" date (as stored in availability_cache) as a
 * local calendar date, not a UTC instant — `new Date("2026-07-15")` parses
 * as UTC midnight, which renders as the previous day for any viewer west of
 * UTC. */
export function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npm test -- stats`
Expected: PASS, all tests in `stats.test.ts` green (existing `computeDashboardStats` tests plus the new ones).

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/stats.ts dashboard/tests/stats.test.ts
git commit -m "feat(dashboard): add recent-activity and upcoming-availability selectors"
```

---

### Task 5: Wire the resolution meter, recent activity, and availability widgets into Overview

**Files:**
- Modify: `dashboard/src/app/d/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add the new widget CSS**

Append this section at the end of `dashboard/src/app/globals.css`:

```css

/* --- Desktop Overview: recent activity + availability strip
   (glassmorphism visual refresh) --- */

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-hairline-soft);
  color: var(--color-text);
  transition: background-color 0.15s ease;
}

.activity-row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.activity-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.activity-client {
  font-size: 0.9rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-channel {
  font-size: 0.76rem;
  color: var(--color-text-faint);
  text-transform: capitalize;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.activity-time {
  font-size: 0.78rem;
  color: var(--color-text-faint);
  font-variant-numeric: tabular-nums;
}

.activity-status-chip {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
}

.activity-status-chip[data-status="escalated"] {
  color: var(--color-warning);
  background: var(--color-warning-tint);
}

.activity-status-chip[data-status="resolved"] {
  color: var(--color-accent);
  background: var(--color-accent-tint);
}

.avail-panel {
  margin-top: 1rem;
  overflow-x: auto;
}

.avail-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(80px, 1fr));
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.avail-day {
  padding: 0.65rem 0.4rem;
  border-radius: 13px;
  text-align: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-hairline-soft);
}

.avail-day[data-free="true"] {
  background: var(--color-accent-tint);
  border-color: rgba(52, 211, 153, 0.3);
}

.avail-day[data-free="false"] {
  opacity: 0.55;
}

.avail-dow {
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-faint);
}

.avail-date {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.98rem;
  margin: 0.2rem 0;
}

.avail-day[data-free="true"] .avail-date {
  color: var(--color-accent);
}

.avail-label {
  font-size: 0.6rem;
  color: var(--color-text-faint);
}

.avail-day[data-free="true"] .avail-label {
  color: var(--color-accent);
}
```

`.desktop-two-pane` (the meter/activity two-column layout) already exists in `globals.css` from Phase 1 and is unused elsewhere — reused as-is below, no new grid class needed for that part.

- [ ] **Step 2: Rewrite the Overview page**

`dashboard/src/app/d/page.tsx` currently reads:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { computeDashboardStats, type DashboardStats } from "@/lib/stats";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

export default function DesktopOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

        setStats(computeDashboardStats(conversations, escalations, availability));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить аналитику");
      }
    })();
  }, []);

  const resolutionRate =
    stats && stats.totalConversations > 0
      ? Math.round((stats.conversationsWithoutEscalation / stats.totalConversations) * 100)
      : null;

  return (
    <div>
      <h1>Обзор</h1>
      <p className="muted">Как бот и вы справляетесь с клиентами.</p>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <div className="desktop-kpi-row">
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
            <div className="kpi-label">открытых эскалаций</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.totalConversations}</div>
            <div className="kpi-label">диалогов всего</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-good">{resolutionRate ?? "—"}%</div>
            <div className="kpi-label">бот справляется сам</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.upcomingAvailable}</div>
            <div className="kpi-label">свободных дат</div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Replace the whole file with:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import {
  computeDashboardStats,
  parseLocalDate,
  selectRecentActivity,
  selectUpcomingAvailability,
  type DashboardStats,
  type RecentActivityItem,
} from "@/lib/stats";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const TIME_FORMAT = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export default function DesktopOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<AvailabilityEntry[]>([]);
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

        setStats(computeDashboardStats(conversations, escalations, availability));
        setActivity(selectRecentActivity(conversations, escalations, 5));
        setUpcoming(selectUpcomingAvailability(availability, 7));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить аналитику");
      }
    })();
  }, []);

  const resolutionRate =
    stats && stats.totalConversations > 0
      ? Math.round((stats.conversationsWithoutEscalation / stats.totalConversations) * 100)
      : null;

  return (
    <div>
      <h1>Обзор</h1>
      <p className="muted">Как бот и вы справляетесь с клиентами.</p>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <div className="desktop-kpi-row">
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
            <div className="kpi-label">открытых эскалаций</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.totalConversations}</div>
            <div className="kpi-label">диалогов всего</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-good">{resolutionRate ?? "—"}%</div>
            <div className="kpi-label">бот справляется сам</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.upcomingAvailable}</div>
            <div className="kpi-label">свободных дат</div>
          </div>
        </div>
      )}

      {stats && (
        <div className="desktop-two-pane" style={{ marginTop: "1rem" }}>
          <div className="card">
            <div className="meter-row">
              <span className="meter-label">Автономность бота</span>
              <span className="meter-value">{resolutionRate ?? "—"}%</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${resolutionRate ?? 0}%` }} />
            </div>
            <p className="meter-caption">
              {stats.conversationsWithoutEscalation} из {stats.totalConversations} диалогов закрыты без эскалации на
              человека
            </p>
          </div>

          <div className="card">
            <div className="card-title-row">
              <h3>Последние диалоги</h3>
            </div>
            {activity.length === 0 ? (
              <p className="muted">Пока нет диалогов.</p>
            ) : (
              <div className="activity-list">
                {activity.map((item) => (
                  <a
                    key={item.conversationId}
                    href={`/d/conversations/${item.conversationId}`}
                    className="activity-row"
                  >
                    <div className="activity-main">
                      <span className="activity-client">{item.clientId}</span>
                      <span className="activity-channel">{item.channel}</span>
                    </div>
                    <div className="activity-meta">
                      {item.lastMessageAt && (
                        <span className="activity-time">{TIME_FORMAT.format(new Date(item.lastMessageAt))}</span>
                      )}
                      <span className="activity-status-chip" data-status={item.status}>
                        {item.status === "escalated" ? "Эскалация" : "Решено"}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card avail-panel">
          <div className="card-title-row">
            <h3>Ближайшие даты</h3>
          </div>
          <div className="avail-strip">
            {upcoming.map((entry) => {
              const day = parseLocalDate(entry.date);
              return (
                <div key={entry.id} className="avail-day" data-free={entry.isAvailable}>
                  <div className="avail-dow">{WEEKDAY_FORMAT.format(day)}</div>
                  <div className="avail-date">{day.getDate()}</div>
                  <div className="avail-label">{entry.isAvailable ? "свободно" : "занято"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: `item.lastMessageAt` is a full ISO timestamp (unlike `entry.date`, which is a plain `YYYY-MM-DD`), so `new Date(item.lastMessageAt)` is correct there — only calendar-only date strings need `parseLocalDate`.

- [ ] **Step 3: Verify the build and tests**

Run: `cd dashboard && npm run build && npm test`
Expected: build succeeds, all tests pass (including the new ones from Task 4).

- [ ] **Step 4: Manual visual verification**

Run: `cd dashboard && npm run dev`, then open `http://localhost:3000/d` in a browser (with `DEV_BYPASS_INIT_DATA`/`TELEGRAM_OWNER_TENANT_MAP` set in `.env.local`, same as every prior phase's manual pass).

Check, against the approved mockup:
1. Overview shows the ambient mint/violet/gold orbs behind everything, sidebar and cards read as frosted glass with a visible top sheen, and the three new widgets (meter, recent activity, availability strip) render with real data.
2. Click through **Диалоги**, **Лиды**, **Настройки**, **Тест-консоль**, **Ассистент** — confirm the glass treatment cascaded to all of them automatically (Task 2's whole point) and nothing looks broken (no double-blur artifacts, no illegible text on the glass background).
3. Open the mobile view (`http://localhost:3000/` or any `(mobile)` route) and confirm it looks **exactly as it did before this plan** — no glass, no orbs, no sidebar changes. This is the scoping check for Tasks 1–3.
4. Toggle `prefers-reduced-motion` in devtools and confirm the ambient orbs stop drifting.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/d/page.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add resolution meter, recent activity, and availability widgets to Overview"
```
