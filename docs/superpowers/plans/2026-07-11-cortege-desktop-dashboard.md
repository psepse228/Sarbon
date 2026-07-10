# Cortège Desktop Dashboard (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-shaped surface (`/d/**`) to the existing `dashboard/` Next.js app — sidebar shell, Overview, Conversations, Configuration, Assistant, and a new Test Console — while the existing mobile/Telegram-Mini-App pages are untouched in behavior (only moved into a route group so they can have their own layout).

**Architecture:** Same Next.js app, new route tree, shared auth/API/lib. The one genuinely new feature (Test Console) calls a new FastAPI backend endpoint that reuses the real `engine.generate_reply()` in a `test_mode` that skips real escalation side effects — no second implementation of the "never invent a fact" guarantee. Full reasoning in `docs/superpowers/specs/2026-07-11-cortege-desktop-dashboard-design.md` — read it first.

**Tech Stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend), Supabase, GPT-4o.

**Read before starting:** `docs/superpowers/specs/2026-07-11-cortege-desktop-dashboard-design.md`. Note its correction: the dashboard's actual visual identity is a dark theme (`#0b0d12` background, mint accent `#34d399`, Unbounded + Golos Text fonts — see `dashboard/src/app/globals.css`), **not** the cream/navy/gold palette described in `dashboard/README.md` — that doc is stale, ignore it for colors.

**Task order matters for value delivery:** Tasks 1–8 produce a fully working, demoable desktop shell (Overview, Conversations, Configuration, Assistant) with zero backend changes. Tasks 9–12 add the new Test Console. If you have to stop partway, stopping after Task 8 still leaves something real and shippable.

---

### Task 1: Add GearIcon and FlaskIcon

**Files:**
- Modify: `dashboard/src/components/icons.tsx`

- [ ] **Step 1: Add the two new icons**

Append to the end of `dashboard/src/components/icons.tsx` (after the existing `SparkleIcon` export), following the file's exact pattern (22×22 viewBox, `{...base}` spread, `currentColor` stroke):

```tsx
export function GearIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="2.8" />
      <path d="M11 4.2v2M11 15.8v2M4.2 11h2M15.8 11h2M6.3 6.3l1.4 1.4M14.3 14.3l1.4 1.4M6.3 15.7l1.4-1.4M14.3 7.7l1.4-1.4" />
    </svg>
  );
}

export function FlaskIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 3.5h4" />
      <path d="M9.7 3.5v5.3L5.4 16a1.6 1.6 0 0 0 1.4 2.4h8.4a1.6 1.6 0 0 0 1.4-2.4l-4.3-7.2V3.5" />
      <path d="M7 13.5h8" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd dashboard && npm run build`
Expected: build succeeds (icons.tsx has no tests in this codebase — only `lib/` logic is unit-tested here, see `dashboard/tests/`; a build check is the right verification for pure presentational markup).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/icons.tsx
git commit -m "feat(dashboard): add GearIcon and FlaskIcon for desktop nav"
```

---

### Task 2: Restructure mobile pages into a route group

**Why:** The desktop shell needs its own layout (sidebar, no bottom tab bar). Next.js App Router layouts nest inside the root layout, and today the root layout hardcodes `<TopHeader/>` + `<TabBar/>` around every page. Moving the existing mobile pages into a `(mobile)` route group (which does **not** change any URL — `(folderName)` segments are excluded from the path) lets the root layout become minimal, and `(mobile)/layout.tsx` own the mobile chrome, freeing `/d/**` to have a completely different layout in Task 3.

**Files:**
- Move: `dashboard/src/app/page.tsx` → `dashboard/src/app/(mobile)/page.tsx`
- Move: `dashboard/src/app/analytics/page.tsx` → `dashboard/src/app/(mobile)/analytics/page.tsx`
- Move: `dashboard/src/app/conversations/page.tsx` → `dashboard/src/app/(mobile)/conversations/page.tsx`
- Move: `dashboard/src/app/conversations/[id]/page.tsx` → `dashboard/src/app/(mobile)/conversations/[id]/page.tsx`
- Move: `dashboard/src/app/escalations/page.tsx` → `dashboard/src/app/(mobile)/escalations/page.tsx`
- Move: `dashboard/src/app/assistant/page.tsx` → `dashboard/src/app/(mobile)/assistant/page.tsx`
- Move: `dashboard/src/app/company-profile/page.tsx` → `dashboard/src/app/(mobile)/company-profile/page.tsx`
- Move: `dashboard/src/app/catalog/page.tsx` → `dashboard/src/app/(mobile)/catalog/page.tsx`
- Move: `dashboard/src/app/faq/page.tsx` → `dashboard/src/app/(mobile)/faq/page.tsx`
- Move: `dashboard/src/app/more/page.tsx` → `dashboard/src/app/(mobile)/more/page.tsx`
- Move: `dashboard/src/app/login/page.tsx` → `dashboard/src/app/(mobile)/login/page.tsx`
- Create: `dashboard/src/app/(mobile)/layout.tsx`
- Modify: `dashboard/src/app/layout.tsx`
- Do NOT touch: anything under `dashboard/src/app/api/**` — route handlers aren't part of the page tree and are unaffected by route groups.

- [ ] **Step 1: Move the page files**

```bash
cd dashboard/src/app
mkdir -p "(mobile)"
git mv page.tsx "(mobile)/page.tsx"
git mv analytics "(mobile)/analytics"
git mv conversations "(mobile)/conversations"
git mv escalations "(mobile)/escalations"
git mv assistant "(mobile)/assistant"
git mv company-profile "(mobile)/company-profile"
git mv catalog "(mobile)/catalog"
git mv faq "(mobile)/faq"
git mv more "(mobile)/more"
git mv login "(mobile)/login"
```

- [ ] **Step 2: Create the mobile layout, carrying over the chrome removed from root**

`dashboard/src/app/(mobile)/layout.tsx`:

```tsx
import { TabBar } from "@/components/TabBar";
import { TopHeader } from "@/components/TopHeader";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopHeader />
      <main className="container">{children}</main>
      <TabBar />
    </>
  );
}
```

- [ ] **Step 3: Slim the root layout down to what's genuinely app-wide**

Replace `dashboard/src/app/layout.tsx` in full:

```tsx
import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";

import { AuthGate } from "@/components/AuthGate";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { TelegramInit } from "@/components/TelegramInit";

import "./globals.css";

// Both fonts ship a `cyrillic` subset on Google Fonts, so Russian UI copy
// renders in-brand instead of falling back to the system font.
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  weight: ["500", "700", "800"],
});
const golosText = Golos_Text({
  subsets: ["latin", "cyrillic"],
  variable: "--font-golos",
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "Cortège — панель владельца",
  description: "Управление пакетами, вопросами и партнёрами заведения",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cortège",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${golosText.variable}`}>
      <body>
        <BackgroundVideo />
        <TelegramInit />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
```

`AuthGate` (`dashboard/src/components/AuthGate.tsx`) is unchanged — it already wraps `{children}` generically and special-cases `/login` by path string, which still works identically now that `/login` lives in the `(mobile)` group (the URL is still `/login`; route groups don't change it).

- [ ] **Step 4: Verify nothing broke**

Run: `cd dashboard && npm run build`
Expected: build succeeds, and the build output's route list still shows exactly `/`, `/analytics`, `/conversations`, `/conversations/[id]`, `/escalations`, `/assistant`, `/company-profile`, `/catalog`, `/faq`, `/more`, `/login` (no `/(mobile)` segment — confirms the route group didn't change any URL).

Run: `cd dashboard && npm test`
Expected: all existing tests still pass unchanged (they test `lib/`, not page components, so this move doesn't affect them).

Run: `cd dashboard && npm run dev`, open `http://localhost:3000` (with `DEV_BYPASS_INIT_DATA` set per `dashboard/README.md`) and click through a couple of pages.
Expected: identical appearance and behavior to before this task — top header and bottom tab bar still present, same pages at the same URLs.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app
git commit -m "refactor(dashboard): move mobile pages into a (mobile) route group

No URL or behavior change — this frees the root layout to be minimal so
/d/** (added next) can have its own desktop shell instead of inheriting
the mobile TopHeader/TabBar chrome."
```

---

### Task 3: Desktop shell — layout, Sidebar, base CSS, entry point

**Files:**
- Create: `dashboard/src/app/d/layout.tsx`
- Create: `dashboard/src/components/Sidebar.tsx`
- Modify: `dashboard/src/app/globals.css` (append desktop-shell styles)
- Modify: `dashboard/src/app/(mobile)/more/page.tsx` (add an entry-point link)
- Create: `dashboard/src/app/d/page.tsx` (placeholder landing so the shell is checkable before Task 4 builds the real Overview)

- [ ] **Step 1: Add desktop-shell CSS**

Append to `dashboard/src/app/globals.css` (uses the existing tokens defined at the top of the file — no new colors invented):

```css
/* --- Desktop shell (Phase 1 desktop dashboard) --- */

.desktop-shell {
  display: flex;
  min-height: 100vh;
}

.desktop-sidebar {
  width: 232px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 1.4rem 1rem;
  border-right: 1px solid var(--color-hairline);
  background: rgba(255, 255, 255, 0.02);
}

.desktop-sidebar-brand {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.1rem;
  padding: 0.4rem 0.6rem 1.4rem;
}

.desktop-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.desktop-sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.7rem;
  border-radius: 12px;
  color: var(--color-text-soft);
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.desktop-sidebar-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text);
}

.desktop-sidebar-item[data-active="true"] {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.desktop-content {
  flex: 1;
  min-width: 0;
  padding: 2rem 2.4rem;
  max-width: 1160px;
}

.desktop-kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.9rem;
  margin-bottom: 1.6rem;
}

.desktop-table {
  width: 100%;
  border-collapse: collapse;
}

.desktop-table th {
  text-align: left;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-faint);
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--color-hairline);
}

.desktop-table td {
  padding: 0.75rem 0.8rem;
  border-bottom: 1px solid var(--color-hairline-soft);
  font-size: 0.88rem;
}

.desktop-table tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.desktop-two-pane {
  display: grid;
  grid-template-columns: minmax(280px, 380px) 1fr;
  gap: 1.4rem;
  align-items: start;
}
```

- [ ] **Step 2: Build the Sidebar component**

`dashboard/src/components/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChatIcon, FlaskIcon, GearIcon, HomeIcon, SparkleIcon } from "@/components/icons";

const ITEMS = [
  { href: "/d", label: "Обзор", Icon: HomeIcon },
  { href: "/d/conversations", label: "Диалоги", Icon: ChatIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="desktop-sidebar">
      <div className="desktop-sidebar-brand">Cortège</div>
      <div className="desktop-sidebar-nav">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/d" ? pathname === "/d" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="desktop-sidebar-item" data-active={active}>
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Build the desktop layout**

`dashboard/src/app/d/layout.tsx`:

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

This sits directly under the (now minimal) root layout from Task 2 — no `TopHeader`/`TabBar` leak in, since those now live only in `(mobile)/layout.tsx`.

- [ ] **Step 4: Placeholder Overview page so the shell is checkable now**

`dashboard/src/app/d/page.tsx` (Task 4 replaces this with the real KPI overview):

```tsx
export default function DesktopOverviewPage() {
  return (
    <div>
      <h1>Обзор</h1>
      <p className="muted">Десктоп-панель Cortège.</p>
    </div>
  );
}
```

- [ ] **Step 5: Add an entry point from the mobile app**

In `dashboard/src/app/(mobile)/more/page.tsx`, add a new group before the closing `<p className="powered-by">`:

```tsx
      <p className="hub-group-title">Десктоп</p>
      <div className="card hub-card">
        <LinkRow href="/d" label="Открыть десктоп-версию" Icon={GridIcon} />
      </div>

      <p className="powered-by">Cortège · powered by Solura</p>
```

Add `GridIcon` to the existing icon import line at the top of the file (it's already exported from `icons.tsx`, just not currently imported here).

- [ ] **Step 6: Verify**

Run: `cd dashboard && npm run build && npm test`
Expected: build succeeds; all tests still pass. Then `npm run dev`, open `/d` directly in a browser (with `DEV_BYPASS_INIT_DATA` set) — expect the sidebar shell with 5 nav items and the placeholder Overview text, no mobile top header or bottom tab bar. Open `/more` and confirm the new "Открыть десктоп-версию" link navigates to `/d`.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/app/d dashboard/src/components/Sidebar.tsx dashboard/src/app/globals.css "dashboard/src/app/(mobile)/more/page.tsx"
git commit -m "feat(dashboard): add desktop shell (sidebar layout) and /more entry point"
```

---

### Task 4: Shared stats computation + Desktop Overview page

**Why a separate pure function:** This codebase's test convention (see `dashboard/tests/`) is to unit-test pure `lib/` logic and leave React page/data-fetching glue untested. Extracting the KPI math into a pure function lets it be genuinely tested, and lets the desktop Overview page and the existing mobile Analytics page share one implementation instead of two copies that can drift.

**Files:**
- Create: `dashboard/src/lib/stats.ts`
- Create: `dashboard/tests/stats.test.ts`
- Modify: `dashboard/src/app/(mobile)/analytics/page.tsx` (use the extracted function — no behavior change)
- Modify: `dashboard/src/app/d/page.tsx` (replace the Task 3 placeholder)

- [ ] **Step 1: Write the failing test**

`dashboard/tests/stats.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { computeDashboardStats } from "@/lib/stats";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

function conversation(id: string): ConversationSummary {
  return { id, clientId: "client-1", channel: "telegram", status: "active", lastMessageAt: null, createdAt: "2026-07-01T00:00:00Z" };
}

function escalation(conversationId: string, notifiedOwner: boolean): Escalation {
  return { id: `esc-${conversationId}`, conversationId, reason: "test", notifiedOwner, createdAt: "2026-07-01T00:00:00Z", clientId: "client-1", channel: "telegram" };
}

function availability(date: string, isAvailable: boolean): AvailabilityEntry {
  return { id: `av-${date}`, date, isAvailable, eventDetails: "" };
}

describe("computeDashboardStats", () => {
  it("counts conversations without escalation and open/resolved escalations", () => {
    const conversations = [conversation("c1"), conversation("c2"), conversation("c3")];
    const escalations = [escalation("c1", false), escalation("c2", true)];

    const stats = computeDashboardStats(conversations, escalations, []);

    expect(stats.totalConversations).toBe(3);
    expect(stats.conversationsWithoutEscalation).toBe(1);
    expect(stats.openEscalations).toBe(1);
    expect(stats.resolvedEscalations).toBe(1);
  });

  it("counts only future available dates", () => {
    const past = availability("2020-01-01", true);
    const futureAvailable = availability("2099-01-01", true);
    const futureUnavailable = availability("2099-01-02", false);

    const stats = computeDashboardStats([], [], [past, futureAvailable, futureUnavailable]);

    expect(stats.upcomingAvailable).toBe(1);
  });

  it("handles zero conversations without dividing by zero", () => {
    const stats = computeDashboardStats([], [], []);

    expect(stats.totalConversations).toBe(0);
    expect(stats.conversationsWithoutEscalation).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd dashboard && npm test -- stats.test.ts`
Expected: FAIL — `Cannot find module '@/lib/stats'`.

- [ ] **Step 3: Implement**

`dashboard/src/lib/stats.ts`:

```typescript
import type { AvailabilityEntry, ConversationSummary, Escalation } from "./types";

export interface DashboardStats {
  totalConversations: number;
  conversationsWithoutEscalation: number;
  openEscalations: number;
  resolvedEscalations: number;
  upcomingAvailable: number;
}

/** Shared by the mobile Analytics page and the desktop Overview page so the
 * two never quietly compute these numbers differently. */
export function computeDashboardStats(
  conversations: ConversationSummary[],
  escalations: Escalation[],
  availability: AvailabilityEntry[],
): DashboardStats {
  const today = new Date().toISOString().slice(0, 10);
  const escalatedConversationIds = new Set(escalations.map((e) => e.conversationId));
  const withoutEscalation = conversations.filter((c) => !escalatedConversationIds.has(c.id)).length;

  return {
    totalConversations: conversations.length,
    conversationsWithoutEscalation: withoutEscalation,
    openEscalations: escalations.filter((e) => !e.notifiedOwner).length,
    resolvedEscalations: escalations.filter((e) => e.notifiedOwner).length,
    upcomingAvailable: availability.filter((a) => a.isAvailable && a.date >= today).length,
  };
}
```

- [ ] **Step 4: Run it again**

Run: `cd dashboard && npm test -- stats.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor the mobile Analytics page to use it (no behavior change)**

In `dashboard/src/app/(mobile)/analytics/page.tsx`, replace the inline `Stats` interface and the manual computation inside the `useEffect` with a call to `computeDashboardStats`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { BellIcon, ChatIcon, ChevronRightIcon, QuestionIcon } from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";
import { computeDashboardStats, type DashboardStats } from "@/lib/stats";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export default function AnalyticsPage() {
  const { profile } = useCompanyProfile();
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

- [ ] **Step 6: Build the Desktop Overview page**

Replace `dashboard/src/app/d/page.tsx` in full:

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

A dedicated multi-tab Analytics page with trend lines is explicitly deferred (see design spec) — there isn't enough time-series volume yet with one pilot venue.

- [ ] **Step 7: Verify**

Run: `cd dashboard && npm test && npm run build`
Expected: all tests pass (including the 3 new `stats.test.ts` cases), build succeeds. Manually check `/analytics` (mobile) still shows identical numbers to before, and `/d` (desktop) shows the same 4 numbers as KPI tiles.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/lib/stats.ts dashboard/tests/stats.test.ts "dashboard/src/app/(mobile)/analytics/page.tsx" dashboard/src/app/d/page.tsx
git commit -m "feat(dashboard): extract shared stats computation, add Desktop Overview"
```

---

### Task 5: Desktop Conversations page

**Files:**
- Create: `dashboard/src/app/d/conversations/page.tsx`
- Create: `dashboard/src/app/d/conversations/[id]/page.tsx`

No new `lib/` logic — this reuses `/api/conversations` and `/api/conversations/[id]`, the same endpoints the mobile pages already call. No dedicated test (page-level markup + fetch glue, matching this codebase's existing convention of not unit-testing page components — see `dashboard/tests/`, which only covers `lib/`).

- [ ] **Step 1: Build the desktop conversation list (table, not cards)**

`dashboard/src/app/d/conversations/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { ConversationSummary } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  escalated: "Эскалирован",
  closed: "Закрыт",
};

export default function DesktopConversationsPage() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await tmaFetch("/api/conversations");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        setItems(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить диалоги");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h1>Диалоги</h1>
      <p className="muted">Переписка бота с клиентами — для контроля качества ответов.</p>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}
      {!loading && !error && items.length === 0 && <p className="muted">Диалогов пока нет.</p>}

      {items.length > 0 && (
        <table className="desktop-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Последнее сообщение</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/d/conversations/${item.id}`}>Клиент {item.clientId}</Link>
                </td>
                <td>{STATUS_LABEL[item.status] ?? item.status}</td>
                <td>
                  {item.lastMessageAt
                    ? new Date(item.lastMessageAt).toLocaleString("ru-RU")
                    : new Date(item.createdAt).toLocaleString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build the desktop conversation detail page**

First check the existing mobile detail page for the exact shape being rendered:

Read: `dashboard/src/app/(mobile)/conversations/[id]/page.tsx` (moved there in Task 2) before writing this file, and mirror its data-fetching logic (same `/api/conversations/[id]` call, same `ConversationMessage[]` shape from `dashboard/src/lib/types.ts`) with a desktop-appropriate wrapper instead of the mobile chat-bubble-in-container styling:

`dashboard/src/app/d/conversations/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { ConversationMessage } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  bot: "Бот",
  human: "Оператор",
};

export default function DesktopConversationDetailPage({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await tmaFetch(`/api/conversations/${params.id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        setMessages(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить диалог");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  return (
    <div>
      <h1>Диалог</h1>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}

      {!loading && !error && (
        <div className="card">
          {messages.map((message) => (
            <p key={message.id}>
              <strong>{ROLE_LABEL[message.role] ?? message.role}:</strong> {message.content}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

If the moved mobile detail page's actual response shape or route param name differs from what's assumed above (e.g. a different field name than `content`), match this file to what you find there — the mobile page (already working in production) is the source of truth for the API's real shape, not this plan.

- [ ] **Step 3: Verify**

Run: `cd dashboard && npm run build`
Expected: build succeeds. Manually check `/d/conversations` shows a table and clicking a row opens `/d/conversations/<id>` with the transcript.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/d/conversations
git commit -m "feat(dashboard): add desktop Conversations list and detail pages"
```

---

### Task 6: Desktop Configuration page

**Files:**
- Create: `dashboard/src/app/d/configuration/page.tsx`

Reuses the existing, already-working editor components (`CompanyInfoEditor`, `PackagesEditor`, `FaqEditor`, `PartnersEditor`, `PoliciesEditor`, `AvailabilityManager`) — all self-contained, no props (confirmed by reading `dashboard/src/app/(mobile)/company-profile/page.tsx`, `catalog/page.tsx`, `faq/page.tsx`). This task is presentation-only: no new backend, no new data model. Follows the same `.segmented` tab pattern already used in `catalog/page.tsx`.

- [ ] **Step 1: Build the tabbed Configuration page**

`dashboard/src/app/d/configuration/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { AvailabilityManager } from "@/components/AvailabilityManager";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { FaqEditor } from "@/components/FaqEditor";
import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";

type ConfigTab = "info" | "packages" | "faq" | "partners" | "policies" | "availability";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "info", label: "О заведении" },
  { key: "packages", label: "Пакеты" },
  { key: "faq", label: "Вопросы" },
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
      {tab === "partners" && <PartnersEditor />}
      {tab === "policies" && <PoliciesEditor />}
      {tab === "availability" && <AvailabilityManager />}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd dashboard && npm run build`
Expected: build succeeds. Manually check `/d/configuration` renders each tab and that editing (e.g. adding a package) still works exactly as it does on mobile `/catalog` — same component, same API routes, just a different tab wrapper.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/d/configuration
git commit -m "feat(dashboard): add desktop Configuration page (tabs over existing editors)"
```

---

### Task 7: Shared ChatThread component (extracted from the mobile Assistant page)

**Files:**
- Create: `dashboard/src/components/ChatThread.tsx`
- Modify: `dashboard/src/app/(mobile)/assistant/page.tsx` (use the new component — behavior-preserving refactor)

- [ ] **Step 1: Extract the rendering into a shared component**

`dashboard/src/components/ChatThread.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

import { SendIcon } from "@/components/icons";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  time: string;
  extra?: ReactNode;
}

interface ChatThreadProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  sending: boolean;
  suggestions?: string[];
}

export function now(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Shared chat rendering for /assistant (mobile + desktop) and the desktop
 * Test Console — message bubbles, typing indicator, suggestion chips, input
 * row. Each caller owns its own send-logic and API call; this component only
 * renders. `extra` on a message lets a caller (e.g. the Test Console) attach
 * additional content under a bubble without this component needing to know
 * what that content is. */
export function ChatThread({ messages, input, onInputChange, onSend, sending, suggestions = [] }: ChatThreadProps) {
  return (
    <div className="chat-page">
      {messages.length === 0 && suggestions.length > 0 && (
        <div className="chat-suggestions">
          {suggestions.map((s) => (
            <button key={s} className="chat-suggestion" onClick={() => onSend(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="chat-log">
        {messages.map((message, index) => (
          <div key={index} className="chat-row" data-role={message.role}>
            <div className="chat-bubble" data-role={message.role}>
              <span className="chat-bubble-text">{message.content}</span>
              <span className="chat-bubble-time">{message.time}</span>
            </div>
            {message.extra}
          </div>
        ))}
        {sending && (
          <div className="chat-row" data-role="assistant">
            <div className="chat-bubble chat-bubble-typing" data-role="assistant">
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
            }
          }}
          placeholder="Напишите сообщение…"
          rows={1}
        />
        <button className="chat-send-btn" onClick={() => onSend(input)} disabled={sending || !input.trim()} aria-label="Отправить">
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Refactor the mobile Assistant page to use it**

Replace `dashboard/src/app/(mobile)/assistant/page.tsx` in full:

```tsx
"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";

const SUGGESTIONS = ["Как идут дела за сегодня?", "У нас акция — скидка 10% на будни, скажи об этом клиентам"];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed, time: now() }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await tmaFetch("/api/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ history: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось получить ответ (${res.status})`);
      }
      const { reply } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: reply, time: now() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Ассистент</h1>
      <p className="muted">Спросите, как идут дела, или дайте указание, которое учтёт бот для клиентов.</p>

      {error && <ErrorBanner message={error} />}

      <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
    </div>
  );
}
```

This is a pure refactor — same behavior, same API call, same markup output — just with rendering delegated to `ChatThread`.

- [ ] **Step 3: Verify**

Run: `cd dashboard && npm run build`
Expected: build succeeds. Manually exercise `/assistant` on mobile — sending a message, seeing the typing indicator, seeing suggestions on first load — all identical to before this task.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/ChatThread.tsx "dashboard/src/app/(mobile)/assistant/page.tsx"
git commit -m "refactor(dashboard): extract ChatThread component from Assistant page"
```

---

### Task 8: Desktop Assistant page

**Files:**
- Create: `dashboard/src/app/d/assistant/page.tsx`

Same logic as the mobile Assistant page (Task 7), same `/api/assistant/chat` endpoint, reusing `ChatThread` — just placed under `/d` with a heading appropriate to the wider layout. No dedicated test (page-level, matches convention).

- [ ] **Step 1: Build it**

`dashboard/src/app/d/assistant/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";

const SUGGESTIONS = ["Как идут дела за сегодня?", "У нас акция — скидка 10% на будни, скажи об этом клиентам"];

export default function DesktopAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed, time: now() }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await tmaFetch("/api/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ history: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось получить ответ (${res.status})`);
      }
      const { reply } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: reply, time: now() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Ассистент</h1>
      <p className="muted">Спросите, как идут дела, или дайте указание, которое учтёт бот для клиентов.</p>

      {error && <ErrorBanner message={error} />}

      <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
    </div>
  );
}
```

This duplicates ~30 lines of state-management glue between the mobile and desktop Assistant pages. That's an intentional, small, YAGNI-consistent tradeoff for this phase rather than premature abstraction into a shared hook — the two pages already diverge slightly in framing (mobile is full-screen chat, desktop sits inside the shell), and the Test Console (Task 12) will need a third, meaningfully different response shape (reply + tool calls). Revisit extracting a shared `useChatSession` hook only if a third near-identical copy shows up later.

- [ ] **Step 2: Verify**

Run: `cd dashboard && npm run build`
Expected: build succeeds. Manually check `/d/assistant` works identically to mobile `/assistant`, inside the desktop shell.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/d/assistant
git commit -m "feat(dashboard): add desktop Assistant page"
```

**Checkpoint:** Tasks 1–8 are done. The desktop shell is fully usable — Overview, Conversations, Configuration, Assistant — with zero backend changes. Tasks 9–12 add the new Test Console.

---

### Task 9: Thread `test_mode` through the guest-bot engine

**Files:**
- Modify: `backend/app/ai/engine.py`
- Modify: `backend/app/bot/dispatcher.py`
- Modify: `backend/tests/test_ai_engine.py`
- Modify: `backend/tests/test_dispatcher.py`

**Why this shape:** `generate_reply` currently returns a plain `str`. The Test Console needs to show not just the reply but *what the bot looked up* to produce it (the whole point of testing is verifying it's grounding answers, not free-forming them) — so `generate_reply` now returns a small `GeneratedReply(reply, tool_calls)` value instead of a bare string. This is a breaking change to its return type, so every existing caller and test must be updated in this same task — do not leave it half-migrated.

- [ ] **Step 1: Update the existing tests to the new return shape, and add new test_mode tests**

Rewrite `backend/tests/test_ai_engine.py` in full:

```python
import json
from types import SimpleNamespace

import pytest

from app.ai import engine


@pytest.fixture(autouse=True)
def _no_active_notice(monkeypatch):
    """Default for every test in this file — override in a specific test to
    exercise the active_notice injection path."""

    async def fake_get_active_notice(tenant_id):
        return None

    monkeypatch.setattr(engine.handlers, "get_active_notice", fake_get_active_notice)


@pytest.fixture(autouse=True)
def _no_company_info(monkeypatch):
    """Default for every test in this file — override in a specific test to
    exercise the company-info injection path."""

    async def fake_get_company_info(tenant_id):
        return None

    monkeypatch.setattr(engine.handlers, "get_company_info", fake_get_company_info)


class _FakeToolCall:
    def __init__(self, id_, name, arguments):
        self.id = id_
        self.function = SimpleNamespace(name=name, arguments=json.dumps(arguments))


def _tool_call_response(tool_call):
    message = SimpleNamespace(content=None, tool_calls=[tool_call])
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _final_response(content):
    message = SimpleNamespace(content=content, tool_calls=None)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class _FakeCompletions:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._responses.pop(0)


class _FakeOpenAIClient:
    def __init__(self, responses):
        self.chat = SimpleNamespace(completions=_FakeCompletions(responses))


async def test_generate_reply_summarizes_long_history_before_main_call(monkeypatch):
    long_history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"сообщение {i}"} for i in range(20)
    ]
    client = _FakeOpenAIClient(
        [
            _final_response("Краткое содержание: клиент спрашивал про цены."),
            _final_response("Хорошо, вот ответ на ваш последний вопрос."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", long_history)

    assert result.reply == "Хорошо, вот ответ на ваш последний вопрос."
    calls = client.chat.completions.calls
    assert len(calls) == 2
    assert calls[0]["model"] == engine.SUMMARY_MODEL
    assert calls[1]["model"] == engine.MODEL

    main_messages = calls[1]["messages"]
    assert len(main_messages) == 2 + engine.RECENT_WINDOW
    assert "Краткое содержание" in main_messages[1]["content"]
    assert main_messages[-1] == long_history[-1]


async def test_generate_reply_injects_active_notice_into_system_prompt(monkeypatch):
    async def fake_get_active_notice(tenant_id):
        assert tenant_id == "tenant-1"
        return "Акция: скидка 10% на банкеты по будням в июле."

    monkeypatch.setattr(engine.handlers, "get_active_notice", fake_get_active_notice)

    client = _FakeOpenAIClient([_final_response("Да, сейчас у нас скидка 10% на будние дни в июле.")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Есть скидки?"}])

    assert result.reply == "Да, сейчас у нас скидка 10% на будние дни в июле."
    system_message = client.chat.completions.calls[0]["messages"][0]
    assert "Акция: скидка 10% на банкеты по будням в июле." in system_message["content"]


async def test_generate_reply_injects_company_info_into_system_prompt(monkeypatch):
    async def fake_get_company_info(tenant_id):
        assert tenant_id == "tenant-1"
        return {"name": "Cortège", "address": "Ташкент, ул. Examples 12", "phone": "+998 90 000-00-00"}

    monkeypatch.setattr(engine.handlers, "get_company_info", fake_get_company_info)

    client = _FakeOpenAIClient([_final_response("Мы находимся по адресу: Ташкент, ул. Examples 12.")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Где вы находитесь?"}])

    assert result.reply == "Мы находимся по адресу: Ташкент, ул. Examples 12."
    system_message = client.chat.completions.calls[0]["messages"][0]
    assert "Ташкент, ул. Examples 12" in system_message["content"]
    assert "+998 90 000-00-00" in system_message["content"]


async def test_generate_reply_returns_content_directly_when_no_tool_call(monkeypatch):
    client = _FakeOpenAIClient([_final_response("Добрый день! Чем помочь?")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    assert result.reply == "Добрый день! Чем помочь?"
    assert result.tool_calls == []
    assert len(client.chat.completions.calls) == 1


async def test_generate_reply_dispatches_tool_call_and_returns_final_content(monkeypatch):
    tool_call = _FakeToolCall("call_1", "get_package_price", {"package_name": "Стандарт"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Пакет «Стандарт» стоит 250 000 ₽."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_get_package_price(tenant_id, package_name):
        assert tenant_id == "tenant-1"
        assert package_name == "Стандарт"
        return {"name": "Стандарт", "price": 250000, "currency": "RUB"}

    monkeypatch.setattr(engine.handlers, "get_package_price", fake_get_package_price)

    result = await engine.generate_reply(
        "tenant-1", "conv-1", [{"role": "user", "content": "Сколько стоит Стандарт?"}]
    )

    assert result.reply == "Пакет «Стандарт» стоит 250 000 ₽."
    assert result.tool_calls == [
        engine.ToolCallRecord(
            "get_package_price",
            {"package_name": "Стандарт"},
            {"name": "Стандарт", "price": 250000, "currency": "RUB"},
        )
    ]
    second_call_messages = client.chat.completions.calls[1]["messages"]
    tool_messages = [m for m in second_call_messages if m["role"] == "tool"]
    assert tool_messages[0]["tool_call_id"] == "call_1"
    assert json.loads(tool_messages[0]["content"]) == {
        "name": "Стандарт",
        "price": 250000,
        "currency": "RUB",
    }


async def test_generate_reply_dispatches_list_packages_with_no_arguments(monkeypatch):
    tool_call = _FakeToolCall("call_1", "list_packages", {})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("У нас есть пакеты «Стандарт» и «Премиум»."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_list_packages(tenant_id):
        assert tenant_id == "tenant-1"
        return [{"name": "Стандарт", "price": 250000, "currency": "RUB"}]

    monkeypatch.setattr(engine.handlers, "list_packages", fake_list_packages)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Какие у вас пакеты?"}])

    assert result.reply == "У нас есть пакеты «Стандарт» и «Премиум»."


async def test_generate_reply_escalates_with_conversation_id_not_tenant_id(monkeypatch):
    tool_call = _FakeToolCall("call_1", "escalate_to_human", {"reason": "жалоба"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Передал администратору, он свяжется с вами."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_escalate(conversation_id, reason):
        assert conversation_id == "conv-1"
        assert reason == "жалоба"
        return {"conversation_id": conversation_id, "reason": reason}

    monkeypatch.setattr(engine.handlers, "escalate_to_human", fake_escalate)

    notified = []

    async def fake_notify_admin(text):
        notified.append(text)

    monkeypatch.setattr(engine, "notify_admin", fake_notify_admin)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Жалоба"}])

    assert result.reply == "Передал администратору, он свяжется с вами."
    assert len(notified) == 1
    assert "conv-1" in notified[0]
    assert "жалоба" in notified[0]


async def test_generate_reply_gives_up_after_max_tool_rounds(monkeypatch):
    tool_call = _FakeToolCall("call_1", "get_faq", {"topic": "неизвестно"})
    responses = [_tool_call_response(tool_call) for _ in range(engine.MAX_TOOL_ROUNDS)]
    client = _FakeOpenAIClient(responses)
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    async def fake_get_faq(tenant_id, topic):
        return None

    monkeypatch.setattr(engine.handlers, "get_faq", fake_get_faq)

    result = await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "?"}])

    assert result.reply == "Уточню детали у администратора и вернусь с ответом."


async def test_generate_reply_test_mode_escalation_does_not_write_or_notify(monkeypatch):
    tool_call = _FakeToolCall("call_1", "escalate_to_human", {"reason": "вопрос вне темы"})
    client = _FakeOpenAIClient(
        [
            _tool_call_response(tool_call),
            _final_response("Уточню и вернусь с ответом."),
        ]
    )
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    escalate_calls = []

    async def fake_escalate(conversation_id, reason):
        escalate_calls.append((conversation_id, reason))
        return {"conversation_id": conversation_id, "reason": reason}

    monkeypatch.setattr(engine.handlers, "escalate_to_human", fake_escalate)

    notified = []

    async def fake_notify_admin(text):
        notified.append(text)

    monkeypatch.setattr(engine, "notify_admin", fake_notify_admin)

    result = await engine.generate_reply(
        "tenant-1", "test-conv", [{"role": "user", "content": "вопрос не по теме"}], test_mode=True
    )

    assert result.reply == "Уточню и вернусь с ответом."
    assert escalate_calls == []
    assert notified == []
    assert result.tool_calls == [
        engine.ToolCallRecord("escalate_to_human", {"reason": "вопрос вне темы"}, {"would_escalate": True, "reason": "вопрос вне темы"})
    ]
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd backend && pytest tests/test_ai_engine.py -v`
Expected: FAIL on every test with `AttributeError: 'str' object has no attribute 'reply'` (or `'coroutine' object has no attribute 'reply'` before awaiting is even relevant — the point is they fail against the current plain-string return).

- [ ] **Step 3: Implement the engine changes**

In `backend/app/ai/engine.py`, add near the top (after the existing imports, before `MODEL = "gpt-4o"`):

```python
from typing import Any, NamedTuple
```

(replace the existing `from typing import Any` import with the above — it now also needs `NamedTuple`).

Add these two types directly below the existing module-level constants (`RECENT_WINDOW = 12`), before `SUMMARY_PROMPT`:

```python
class ToolCallRecord(NamedTuple):
    name: str
    arguments: dict[str, Any]
    result: Any


class GeneratedReply(NamedTuple):
    reply: str
    tool_calls: list[ToolCallRecord]
```

Replace the `_call_tool` function:

```python
async def _call_tool(
    name: str,
    arguments: dict[str, Any],
    tenant_id: str,
    conversation_id: str,
    test_mode: bool = False,
) -> Any:
    if name == "get_package_price":
        return await handlers.get_package_price(tenant_id, arguments["package_name"])
    if name == "list_packages":
        return await handlers.list_packages(tenant_id)
    if name == "check_date_availability":
        return await handlers.check_date_availability(tenant_id, arguments["date"])
    if name == "get_faq":
        return await handlers.get_faq(tenant_id, arguments["topic"])
    if name == "get_partners":
        return await handlers.get_partners(tenant_id, arguments["category"])
    if name == "escalate_to_human":
        if test_mode:
            # No DB row, no admin notification — the Test Console (see
            # backend/app/routers/internal.py) surfaces this as "would
            # escalate" in its own UI instead of a real handoff.
            return {"would_escalate": True, "reason": arguments["reason"]}
        result = await handlers.escalate_to_human(conversation_id, arguments["reason"])
        await notify_admin(
            f"🔔 Эскалация по диалогу {conversation_id}:\n{arguments['reason']}"
        )
        return result
    raise ValueError(f"Unknown tool: {name}")
```

Replace `generate_reply`:

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
        choice = response.choices[0].message
        if not choice.tool_calls:
            return GeneratedReply(choice.content or "", tool_calls_made)

        messages.append(
            {"role": "assistant", "content": choice.content, "tool_calls": choice.tool_calls}
        )
        for tool_call in choice.tool_calls:
            arguments = json.loads(tool_call.function.arguments)
            result = await _call_tool(
                tool_call.function.name, arguments, tenant_id, conversation_id, test_mode
            )
            tool_calls_made.append(ToolCallRecord(tool_call.function.name, arguments, result))
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )

    return GeneratedReply("Уточню детали у администратора и вернусь с ответом.", tool_calls_made)
```

- [ ] **Step 4: Update the one real call site**

In `backend/app/bot/dispatcher.py`, replace:

```python
    try:
        reply = await generate_reply(tenant_id, conversation_id, history)
    except Exception:
        logger.exception("generate_reply failed for conversation %s", conversation_id)
        reply = _FALLBACK_REPLY
        await notify_admin(f"⚠️ Ошибка обработки диалога {conversation_id} — смотри логи сервера.")
```

with:

```python
    try:
        result = await generate_reply(tenant_id, conversation_id, history)
        reply = result.reply
    except Exception:
        logger.exception("generate_reply failed for conversation %s", conversation_id)
        reply = _FALLBACK_REPLY
        await notify_admin(f"⚠️ Ошибка обработки диалога {conversation_id} — смотри логи сервера.")
```

- [ ] **Step 5: Update `test_dispatcher.py`'s mock to match the new return type**

In `backend/tests/test_dispatcher.py`, add the import at the top:

```python
from app.ai.engine import GeneratedReply
```

And change the fake in `test_handle_message_persists_conversation_and_replies_with_generated_content`:

```python
    async def fake_generate_reply(tenant_id, conversation_id, history):
        assert tenant_id == "tenant-1"
        assert conversation_id == "conv-1"
        assert history == [{"role": "user", "content": "Сколько стоит Стандарт?"}]
        return GeneratedReply("Пакет «Стандарт» стоит 250 000 ₽.", [])
```

(only this one test needs the change — `failing_generate_reply` in the other test just raises, unaffected by the return type, and `test_whoami_handler_replies_with_chat_id` doesn't touch `generate_reply` at all.)

- [ ] **Step 6: Run all backend tests**

Run: `cd backend && pytest -v`
Expected: PASS — all of `test_ai_engine.py` (9 tests, including the new test_mode one), `test_dispatcher.py` (3 tests), and everything else unaffected.

- [ ] **Step 7: Commit**

```bash
git add backend/app/ai/engine.py backend/app/bot/dispatcher.py backend/tests/test_ai_engine.py backend/tests/test_dispatcher.py
git commit -m "feat(backend): add test_mode to generate_reply, return tool-call trace

generate_reply now returns GeneratedReply(reply, tool_calls) instead of a
bare string, and accepts test_mode=False by default. In test_mode,
escalate_to_human returns a 'would_escalate' result instead of writing to
the escalations table or notifying the admin — needed for the dashboard's
Test Console (added in a following task) to safely exercise the real
bot without side effects."
```

---

### Task 10: Backend `/internal/test-chat` endpoint

**Files:**
- Create: `backend/app/routers/internal.py`
- Create: `backend/tests/test_internal_test_chat.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add the setting**

In `backend/app/config.py`, add one field to the `Settings` class (after `admin_telegram_chat_id`):

```python
    admin_telegram_chat_id: str | None = None
    internal_api_secret: str | None = None
    environment: str = "development"
```

- [ ] **Step 2: Add the env var placeholder**

Append to `backend/.env.example`:

```
INTERNAL_API_SECRET=
```

- [ ] **Step 3: Write the failing test**

`backend/tests/test_internal_test_chat.py`:

```python
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import app.routers.internal as internal_router
from app.ai.engine import GeneratedReply, ToolCallRecord
from app.main import app

client = TestClient(app)


def _fake_settings(secret: str = "test-secret") -> SimpleNamespace:
    return SimpleNamespace(internal_api_secret=secret)


def test_test_chat_returns_reply_and_tool_calls_with_valid_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    fake_generate_reply = AsyncMock(
        return_value=GeneratedReply(
            "Пакет «Стандарт» стоит 250 000 ₽.",
            [ToolCallRecord("get_package_price", {"package_name": "Стандарт"}, {"price": 250000})],
        )
    )
    monkeypatch.setattr(internal_router, "generate_reply", fake_generate_reply)

    response = client.post(
        "/internal/test-chat",
        json={"tenant_id": "tenant-1", "history": [{"role": "user", "content": "Сколько стоит Стандарт?"}]},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Пакет «Стандарт» стоит 250 000 ₽."
    assert body["tool_calls"] == [
        {"name": "get_package_price", "arguments": {"package_name": "Стандарт"}, "result": {"price": 250000}}
    ]
    fake_generate_reply.assert_awaited_once_with(
        "tenant-1",
        "test-tenant-1",
        [{"role": "user", "content": "Сколько стоит Стандарт?"}],
        test_mode=True,
    )


def test_test_chat_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/test-chat",
        json={"tenant_id": "tenant-1", "history": [{"role": "user", "content": "Привет"}]},
        headers={"X-Internal-Secret": "wrong-secret"},
    )

    assert response.status_code == 401


def test_test_chat_rejects_missing_secret_header(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/test-chat",
        json={"tenant_id": "tenant-1", "history": [{"role": "user", "content": "Привет"}]},
    )

    assert response.status_code == 422
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `cd backend && pytest tests/test_internal_test_chat.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.routers.internal'`.

- [ ] **Step 5: Implement the router**

`backend/app/routers/internal.py`:

```python
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.ai.engine import generate_reply
from app.config import get_settings

router = APIRouter(prefix="/internal")


class TestChatTurn(BaseModel):
    role: str
    content: str


class TestChatRequest(BaseModel):
    tenant_id: str
    history: list[TestChatTurn]


class ToolCallOut(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: Any


class TestChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCallOut]


@router.post("/test-chat", response_model=TestChatResponse)
async def test_chat(
    body: TestChatRequest,
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> TestChatResponse:
    """Owner-only: lets the dashboard's Test Console exercise the real
    guest-bot engine without writing real conversation/escalation rows or
    paging the admin. Never used by real guests — see
    dashboard/src/app/api/test-chat/route.ts for the only caller."""
    settings = get_settings()
    if not settings.internal_api_secret or x_internal_secret != settings.internal_api_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    history = [{"role": turn.role, "content": turn.content} for turn in body.history]
    result = await generate_reply(
        body.tenant_id, f"test-{body.tenant_id}", history, test_mode=True
    )
    return TestChatResponse(
        reply=result.reply,
        tool_calls=[
            ToolCallOut(name=tc.name, arguments=tc.arguments, result=tc.result)
            for tc in result.tool_calls
        ],
    )
```

- [ ] **Step 6: Register the router**

Replace `backend/app/main.py` in full:

```python
from fastapi import FastAPI

from app.routers import health, internal, telegram

app = FastAPI(title="Wedding Bot Backend")
app.include_router(health.router)
app.include_router(telegram.router)
app.include_router(internal.router)
```

- [ ] **Step 7: Run the tests**

Run: `cd backend && pytest tests/test_internal_test_chat.py -v`
Expected: PASS (3 tests).

Run: `cd backend && pytest -v`
Expected: full suite still passes (nothing else touches `main.py`'s router list).

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/internal.py backend/tests/test_internal_test_chat.py backend/app/main.py backend/app/config.py backend/.env.example
git commit -m "feat(backend): add POST /internal/test-chat for the dashboard Test Console

Shared-secret-authenticated, calls the real generate_reply() in
test_mode=True. Only caller is the dashboard's /api/test-chat relay
route — never reachable from Telegram."
```

---

### Task 11: Dashboard `/api/test-chat` relay route

**Files:**
- Create: `dashboard/src/app/api/test-chat/route.ts`
- Modify: `dashboard/.env.example`

No dedicated test for this route — it's thin auth-then-forward glue, matching this codebase's existing convention that `api/**/route.ts` handlers aren't individually unit-tested (only `lib/` logic is; see `dashboard/tests/`, which covers `initData.ts` and `auth.ts` and nothing under `api/`).

- [ ] **Step 1: Add the two new env vars**

Append to `dashboard/.env.example`:

```
# --- Internal call to the FastAPI backend's /internal/test-chat (desktop Test Console only) ---
BACKEND_URL=
INTERNAL_API_SECRET=
```

`INTERNAL_API_SECRET` here must match the backend's `INTERNAL_API_SECRET` from Task 10 exactly — they're the two sides of the same shared secret.

- [ ] **Step 2: Build the relay route**

`dashboard/src/app/api/test-chat/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  history: z.array(turnSchema).min(1),
});

interface BackendToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

interface BackendTestChatResponse {
  reply: string;
  tool_calls: BackendToolCall[];
}

export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { history } = bodySchema.parse(body);

    const backendUrl = process.env.BACKEND_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!backendUrl || !secret) {
      throw new Error("BACKEND_URL/INTERNAL_API_SECRET is not configured on the server");
    }

    const backendResponse = await fetch(`${backendUrl}/internal/test-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        history: history.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend test-chat failed (${backendResponse.status})`);
    }

    const data: BackendTestChatResponse = await backendResponse.json();
    return NextResponse.json({
      reply: data.reply,
      toolCalls: data.tool_calls.map((tc) => ({ name: tc.name, arguments: tc.arguments, result: tc.result })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 3: Verify**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/test-chat dashboard/.env.example
git commit -m "feat(dashboard): add /api/test-chat relay to the backend's internal endpoint"
```

---

### Task 12: Desktop Test Console page

**Files:**
- Create: `dashboard/src/app/d/test-console/page.tsx`
- Modify: `dashboard/src/app/globals.css` (small addition for the tool-call disclosure panel)

- [ ] **Step 1: Add CSS for the "what it looked up" disclosure**

Append to `dashboard/src/app/globals.css`:

```css
/* --- Test Console: tool-call disclosure under a bot reply --- */

.tool-call-trace {
  margin: 0.35rem 0 0.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-width: 80%;
}

.tool-call-chip {
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
  color: var(--color-text-faint);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-hairline-soft);
  border-radius: 8px;
  padding: 0.35rem 0.55rem;
}

.tool-call-chip[data-escalated="true"] {
  color: var(--color-warning);
  border-color: rgba(251, 191, 36, 0.3);
  background: var(--color-warning-tint);
}
```

- [ ] **Step 2: Build the Test Console page**

`dashboard/src/app/d/test-console/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

function ToolCallTrace({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="tool-call-trace">
      {toolCalls.map((call, index) => {
        const escalated = call.name === "escalate_to_human";
        const argsText = Object.entries(call.arguments)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(", ");
        return (
          <div key={index} className="tool-call-chip" data-escalated={escalated}>
            {escalated
              ? `Бот бы передал администратору: ${String((call.result as { reason?: string })?.reason ?? "")}`
              : `${call.name}(${argsText}) → ${JSON.stringify(call.result)}`}
          </div>
        );
      })}
    </div>
  );
}

export default function TestConsolePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed, time: now() }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await tmaFetch("/api/test-chat", {
        method: "POST",
        body: JSON.stringify({ history: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось получить ответ (${res.status})`);
      }
      const { reply, toolCalls } = (await res.json()) as { reply: string; toolCalls: ToolCall[] };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, time: now(), extra: <ToolCallTrace toolCalls={toolCalls} /> },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Тест-консоль</h1>
      <p className="muted">
        Спросите так, как спросил бы клиент — это настоящий бот, ответы не сохраняются в диалоги и не уходят
        клиентам. Под каждым ответом видно, что бот на самом деле проверил.
      </p>

      {error && <ErrorBanner message={error} />}

      <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} />
    </div>
  );
}
```

- [ ] **Step 3: Verify end-to-end**

Requires both servers running with matching secrets:

```bash
# terminal 1
cd backend && INTERNAL_API_SECRET=dev-secret uvicorn app.main:app --reload
# terminal 2
cd dashboard && BACKEND_URL=http://localhost:8000 INTERNAL_API_SECRET=dev-secret npm run dev
```

Open `/d/test-console` (with `DEV_BYPASS_INIT_DATA` set per usual local dev), ask something the real company profile can answer (e.g. a package name that exists in the seeded test tenant), and confirm:
- The reply appears as a normal bot bubble.
- A small trace line appears underneath showing the function call made (e.g. `get_package_price(package_name="...") → {...}`).
- Asking something that should escalate (e.g. a complaint) shows the amber "Бот бы передал администратору: ..." trace line, and confirm in Supabase that **no** row was added to `escalations` and **no** Telegram message arrived at the admin chat — this is the one behavior this whole task exists to guarantee.

Run: `cd dashboard && npm run build && npm test` and `cd backend && pytest`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/d/test-console dashboard/src/app/globals.css
git commit -m "feat(dashboard): add desktop Test Console

Lets the owner exercise the real guest-bot engine safely — test_mode
means no real escalation row or admin notification, and the UI shows
exactly which functions the bot called to ground each answer."
```

---

## Self-review notes (checked while writing this plan)

**Spec coverage:** every section of `docs/superpowers/specs/2026-07-11-cortege-desktop-dashboard-design.md` maps to a task — desktop IA (Tasks 3–8), Test Console architecture decision (Tasks 9–12, real-backend-call approach as specified, not the rejected TS-duplicate alternative), auth reuse (no task needed, confirmed existing `tmaFetch`/session-cookie already covers standalone browser use — verified in Task 3's manual check).

**Type consistency:** `GeneratedReply`/`ToolCallRecord` (Task 9, Python) → `TestChatResponse`/`ToolCallOut` (Task 10, pydantic, snake_case per Python/JSON convention) → `BackendTestChatResponse`/`BackendToolCall` (Task 11, TypeScript, mirrors the snake_case wire shape) → `{ reply, toolCalls }` (Task 11's response to the browser, camelCase) → `ToolCall` (Task 12, matches). The snake→camel boundary is exactly at the dashboard's API route, consistent with how `CompanyProfile` already does it elsewhere in this codebase.

**Placeholder scan:** none — every step has complete code, exact file paths, and exact commands.

**Open item carried from the spec, still open:** the exact desktop entry point beyond the `/more` link (Task 3, Step 5) — a manual link is what's implemented here; revisit if it turns out owners never find it.
