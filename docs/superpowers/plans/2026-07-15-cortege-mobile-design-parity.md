# Cortège Mobile Design Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `docs/superpowers/specs/2026-07-15-cortege-mobile-design-parity.md`: extend the desktop glassmorphism shell to mobile, frame mobile's Ассистент chat, replace mobile's old availability list with the visual `CalendarGrid`, and add a dismissible "open desktop" banner for PC visitors.

**Read before starting:** `docs/superpowers/specs/2026-07-15-cortege-mobile-design-parity.md`.

**Note on test coverage:** This is a presentational/CSS batch, consistent with every prior design pass this project — no new automated tests, verified via `npm run build` plus a manual pass in the final task.

---

### Task 1: Mobile glass shell

**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/src/components/GemSmokeBackground.tsx`
- Modify: `dashboard/src/app/(mobile)/layout.tsx`

- [ ] **Step 1: Rename `.desktop-ambient` → `.ambient-shader`**

In `dashboard/src/app/globals.css`, find:
```css
.desktop-ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.55;
}
```
Replace with:
```css
.ambient-shader {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.55;
}
```

In `dashboard/src/components/GemSmokeBackground.tsx`, find:
```tsx
    <div className="desktop-ambient" aria-hidden="true">
```
Replace with:
```tsx
    <div className="ambient-shader" aria-hidden="true">
```

Also update the component's doc comment (currently "Replaces the desktop shell's old CSS-orb ambient background...") to note it's now used by both shells — find:
```tsx
/** Replaces the desktop shell's old CSS-orb ambient background with a live
 * shader, tinted to Cortège's mint/gold identity. Skips rendering entirely
 * under prefers-reduced-motion rather than trying to freeze a single frame —
 * there's no static fallback worth showing for a shader like this. */
```
Replace with:
```tsx
/** Ambient shader background, tinted to Cortège's mint/gold identity, shared
 * by both the desktop shell and the mobile shell. Skips rendering entirely
 * under prefers-reduced-motion rather than trying to freeze a single frame —
 * there's no static fallback worth showing for a shader like this. */
```

- [ ] **Step 2: Extend the glass rule to `.mobile-shell`**

In `dashboard/src/app/globals.css`, find:
```css
/* --- Desktop shell: glass primitive (glassmorphism visual refresh) ---
   Scoped under .desktop-shell so mobile's identical .card/.kpi-tile class
   names (used throughout (mobile)/**) are completely untouched — this is
   desktop-only. */

.desktop-shell .card,
.desktop-shell .kpi-tile {
```
Replace with:
```css
/* --- Glass primitive (glassmorphism visual refresh) ---
   Shared by .desktop-shell and .mobile-shell — both trees use the same
   .card/.kpi-tile class names, so one rule covers both. */

.desktop-shell .card,
.desktop-shell .kpi-tile,
.mobile-shell .card,
.mobile-shell .kpi-tile {
```

Then find:
```css
.desktop-shell .card::before,
.desktop-shell .kpi-tile::before {
```
Replace with:
```css
.desktop-shell .card::before,
.desktop-shell .kpi-tile::before,
.mobile-shell .card::before,
.mobile-shell .kpi-tile::before {
```

Then find:
```css
.desktop-shell .meter-fill {
  background: linear-gradient(90deg, var(--color-accent-strong), var(--color-accent));
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.45);
}

.desktop-shell .meter-track {
  border: 1px solid var(--glass-border-soft);
}
```
Replace with:
```css
.desktop-shell .meter-fill,
.mobile-shell .meter-fill {
  background: linear-gradient(90deg, var(--color-accent-strong), var(--color-accent));
  box-shadow: 0 0 16px rgba(52, 211, 153, 0.45);
}

.desktop-shell .meter-track,
.mobile-shell .meter-track {
  border: 1px solid var(--glass-border-soft);
}
```

- [ ] **Step 3: Add the `.mobile-shell` wrapper, stacking-context fix, and header/tab-bar glass tokens**

In `dashboard/src/app/globals.css`, find:
```css
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.1rem 1.1rem calc(5.5rem + env(safe-area-inset-bottom));
}
```
Replace with:
```css
.mobile-shell {
  position: relative;
  min-height: 100vh;
}

.container {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 1.1rem 1.1rem calc(5.5rem + env(safe-area-inset-bottom));
}
```

Then find:
```css
.top-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  padding: calc(0.6rem + env(safe-area-inset-top)) 1.1rem 0.75rem;
  background: rgba(11, 13, 18, 0.4);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
```
Replace with:
```css
.top-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  padding: calc(0.6rem + env(safe-area-inset-top)) 1.1rem 0.75rem;
  background: var(--glass);
  border-bottom: 1px solid var(--glass-border-soft);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}
```

Then find:
```css
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  justify-content: space-around;
  padding: 0.55rem 0.5rem calc(0.6rem + env(safe-area-inset-bottom));
  background: rgba(18, 21, 28, 0.82);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--color-hairline);
}
```
Replace with:
```css
.tab-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  justify-content: space-around;
  padding: 0.55rem 0.5rem calc(0.6rem + env(safe-area-inset-bottom));
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border-top: 1px solid var(--glass-border-soft);
}
```

- [ ] **Step 4: Wrap the mobile layout in `.mobile-shell` and add the ambient shader**

Replace the whole file `dashboard/src/app/(mobile)/layout.tsx`:

```tsx
import { DesktopSuggestBanner } from "@/components/DesktopSuggestBanner";
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { TabBar } from "@/components/TabBar";
import { TopHeader } from "@/components/TopHeader";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell">
      <GemSmokeBackground />
      <DesktopSuggestBanner />
      <TopHeader />
      <main className="container">{children}</main>
      <TabBar />
    </div>
  );
}
```

(`DesktopSuggestBanner` is created in Task 4 — this step references it now so the layout only needs one edit; if Task 4 hasn't run yet when this step executes, temporarily omit the `DesktopSuggestBanner` import/usage and revisit once Task 4 lands.)

- [ ] **Step 5: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds (Task 4 not done yet if running tasks in order — `DesktopSuggestBanner` won't exist; either sequence Task 4 first or stub it temporarily per the note above. Recommended: do Task 4 before Task 1 Step 4/5, or do Steps 1–3 of this task, then Task 4, then return for Step 4/5).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/globals.css dashboard/src/components/GemSmokeBackground.tsx dashboard/src/app/\(mobile\)/layout.tsx
git commit -m "feat(dashboard): extend desktop glassmorphism shell to mobile"
```

---

### Task 2: Mobile Ассистент — chat frame

**Files:**
- Modify: `dashboard/src/app/(mobile)/assistant/page.tsx`

- [ ] **Step 1: Wrap ChatThread in `.chat-frame`**

In `dashboard/src/app/(mobile)/assistant/page.tsx`, find:
```tsx
      <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
```
Replace with:
```tsx
      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
      </div>
```

- [ ] **Step 2: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "dashboard/src/app/(mobile)/assistant/page.tsx"
git commit -m "feat(dashboard): frame mobile Ассистент chat to match desktop"
```

---

### Task 3: Mobile calendar — `CalendarGrid` replaces `AvailabilityManager`

**Files:**
- Modify: `dashboard/src/app/(mobile)/company-profile/page.tsx`
- Delete: `dashboard/src/components/AvailabilityManager.tsx`

- [ ] **Step 1: Rewrite the company-profile page**

Replace the whole file `dashboard/src/app/(mobile)/company-profile/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { CalendarGrid } from "@/components/CalendarGrid";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { ErrorBanner } from "@/components/StatusBanner";
import { PoliciesEditor } from "@/components/PoliciesEditor";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";

export default function CompanyProfilePage() {
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  function loadEntries() {
    setLoadingEntries(true);
    tmaFetch("/api/availability")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить даты (${res.status})`);
        return (await res.json()) as AvailabilityEntry[];
      })
      .then(setEntries)
      .catch((err) => setEntriesError(err instanceof Error ? err.message : "Не удалось загрузить даты"))
      .finally(() => setLoadingEntries(false));
  }

  useEffect(() => {
    loadEntries();
  }, []);

  return (
    <div>
      <h1>Профиль компании</h1>
      <p className="muted">Данные о заведении, политики и календарь доступности.</p>

      <CompanyInfoEditor />
      <PoliciesEditor />

      <div className="card">
        {loadingEntries && <p className="muted">Загрузка…</p>}
        {entriesError && <ErrorBanner message={entriesError} />}
        {!loadingEntries && !entriesError && <CalendarGrid entries={entries} onChanged={loadEntries} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Confirm nothing else imports `AvailabilityManager`**

Run: `cd dashboard && grep -rln "AvailabilityManager" src`
Expected: no output (this task's Step 1 was the only remaining caller — desktop already dropped it in the Catalog/Calendar batch).

- [ ] **Step 3: Delete it**

```bash
git rm dashboard/src/components/AvailabilityManager.tsx
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "dashboard/src/app/(mobile)/company-profile/page.tsx"
git rm dashboard/src/components/AvailabilityManager.tsx
git commit -m "feat(dashboard): replace mobile's availability list with the visual CalendarGrid"
```

---

### Task 4: Desktop-suggest banner

**Files:**
- Create: `dashboard/src/components/DesktopSuggestBanner.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add the banner CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Desktop-suggest banner (mobile shell only) --- */

.desktop-suggest-banner {
  position: sticky;
  top: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 1.1rem;
  background: var(--color-accent-tint);
  border-bottom: 1px solid rgba(52, 211, 153, 0.3);
  font-size: 0.82rem;
  color: var(--color-text);
}

.desktop-suggest-banner-text {
  flex: 1;
}

.desktop-suggest-banner-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.desktop-suggest-banner-cta {
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: var(--color-accent);
  color: #04120c;
  font-weight: 700;
  font-size: 0.8rem;
  white-space: nowrap;
}

.desktop-suggest-banner-close {
  color: var(--color-text-faint);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.2rem 0.4rem;
}

.desktop-suggest-banner-close:hover {
  color: var(--color-text);
}
```

- [ ] **Step 2: Create the component**

`dashboard/src/components/DesktopSuggestBanner.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const DISMISS_KEY = "cortege-desktop-suggest-dismissed";
const DESKTOP_QUERY = "(min-width: 1024px) and (hover: hover) and (pointer: fine)";

/**
 * Suggests (never forces) switching to the desktop shell when the mobile
 * view is opened from a real mouse-driven computer — hover:hover + pointer:fine
 * specifically excludes wide-viewport tablets/phones-in-landscape, which
 * shouldn't see this. Dismissal is remembered for the current tab/session
 * only (sessionStorage), so it reappears on a fresh visit rather than being
 * permanently gone — same pattern as a typical "install this app" prompt.
 */
export function DesktopSuggestBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const query = window.matchMedia(DESKTOP_QUERY);
    setVisible(query.matches);

    const listener = (event: MediaQueryListEvent) => {
      if (!sessionStorage.getItem(DISMISS_KEY)) setVisible(event.matches);
    };
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [pathname]);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  if (pathname === "/login" || !visible) return null;

  return (
    <div className="desktop-suggest-banner">
      <span className="desktop-suggest-banner-text">
        Вы открыли Cortège с компьютера — desktop-версия даёт больше возможностей.
      </span>
      <div className="desktop-suggest-banner-actions">
        <a href="/d" className="desktop-suggest-banner-cta">
          Открыть десктоп
        </a>
        <button type="button" onClick={dismiss} aria-label="Закрыть" className="desktop-suggest-banner-close">
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the mobile layout**

Already specified in Task 1, Step 4 — if Task 1 ran before this task, confirm `dashboard/src/app/(mobile)/layout.tsx` imports and renders `<DesktopSuggestBanner />`; if not yet present, add the import and render it directly under `<GemSmokeBackground />` and above `<TopHeader />`, matching Task 1 Step 4's target file content exactly.

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/DesktopSuggestBanner.tsx dashboard/src/app/globals.css "dashboard/src/app/(mobile)/layout.tsx"
git commit -m "feat(dashboard): suggest the desktop version when opened from a computer"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build and test suite**

Run: `cd dashboard && npm run build && npm test -- --run`
Expected: build succeeds, all tests pass (this batch adds no tests and changes no tested logic — a pure regression check).

- [ ] **Step 2: Confirm no dangling references**

Run: `cd dashboard && grep -rln "desktop-ambient\|AvailabilityManager" src`
Expected: no output.

- [ ] **Step 3: Manual/browser verification**

Run `cd dashboard && npm run dev`. Check, to whatever extent possible in this environment (no real Supabase/session credentials — note explicitly what could only be confirmed via code inspection):
1. Mobile pages (`/`, `/catalog`, `/company-profile`, `/assistant`, `/more`) render cards with the same glass blur/sheen as desktop, not the old flat surface.
2. `/assistant` on mobile shows the chat inside a bounded, bordered frame like desktop's Test Console/Ассистент.
3. `/company-profile` shows a month-grid calendar, not the old flat availability list.
4. Resize the browser to a wide desktop-like viewport with a mouse (not touch emulation) — the desktop-suggest banner should appear at the top of any mobile page except `/login`; clicking the × should hide it for the rest of the session; clicking "Открыть десктоп" should navigate to `/d`.
5. Narrow/touch-emulated viewports should never show the banner.

- [ ] **Step 4: Report**

Summarize what was verified vs. what could only be confirmed via build/code inspection.
