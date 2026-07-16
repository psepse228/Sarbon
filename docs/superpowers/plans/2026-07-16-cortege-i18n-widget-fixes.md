# Cortège i18n, Floating Assistant, SEO & Tenant Hardening Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

Read spec first: `docs/superpowers/specs/2026-07-16-cortege-i18n-widget-fixes.md`.

**Note on tests:** infra (LocaleProvider/useT) gets no new tests — consistent with this repo's convention of not testing pure UI plumbing. `resolveOrCreateTenantByEmail`'s retry hardening extends the existing `auth.test.ts` race-retry test.

---

### Task 1: noindex

Modify `dashboard/src/app/layout.tsx`. In the `metadata` export, add:
```ts
robots: { index: false, follow: false },
```
Build, commit: `fix(dashboard): noindex the owner dashboard (not a marketing page)`.

---

### Task 2: Tenant-creation hardening

Modify `dashboard/src/lib/telegram/auth.ts`'s `resolveOrCreateTenantByEmail`. In the `if (insertError.code === "23505")` branch, after the first re-select fails to find a row, add one delayed retry before giving up:

```ts
if (insertError.code === "23505") {
  const reselect = async () =>
    client.from("tenants").select("id").eq("owner_email", email).limit(1).maybeSingle<{ id: string }>();

  let { data: raceWinner } = await reselect();
  if (!raceWinner) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    ({ data: raceWinner } = await reselect());
  }
  if (raceWinner) return raceWinner.id;
  throw new AuthError("Не удалось войти — попробуйте ещё раз.", 500);
}
```

Remove the old `retryError` variable/message entirely (replaced by the above). Update `dashboard/tests/auth.test.ts`'s race-retry test (`"recovers via a re-select..."`) — it should still pass unchanged since the first `reselect()` call already returns the winner in that test's mock; add one more test: `"retries a second time if the first re-select also comes back empty"` using the same `makeFakeClient` pattern with a THIRD select result now needed (extend `makeFakeClient`'s `selectResults` array logic to support two race-selects, or add a dedicated fake client for this one test — implementer's judgment, whichever is less awkward given the existing helper).

Build + test, commit: `fix(dashboard): retry tenant race-select once more, use an owner-facing error message`.

---

### Task 3: i18n infrastructure

**Files:** create `dashboard/src/lib/i18n/translations.ts`, `dashboard/src/lib/i18n/LocaleProvider.tsx`; modify `dashboard/src/app/d/layout.tsx`, `dashboard/src/components/DesktopHeader.tsx`.

`dashboard/src/lib/i18n/translations.ts`:
```ts
export type Locale = "ru" | "en";

export const translations: Record<Locale, Record<string, string>> = {
  ru: {
    "sidebar.overview": "Обзор",
    "sidebar.crm": "CRM",
    "sidebar.conversations": "Диалоги",
    "sidebar.leads": "Лиды",
    "sidebar.broadcasts": "Рассылки",
    "sidebar.reviews": "Отзывы",
    "sidebar.catalog": "Каталог",
    "sidebar.calendar": "Календарь",
    "sidebar.connectors": "Коннекторы",
    "sidebar.configuration": "Настройки",
    "sidebar.testConsole": "Тест-консоль",
    "sidebar.assistant": "Ассистент",
    "header.searchPlaceholder": "Поиск по разделам…",
    "header.searchEmpty": "Ничего не найдено",
  },
  en: {
    "sidebar.overview": "Overview",
    "sidebar.crm": "CRM",
    "sidebar.conversations": "Conversations",
    "sidebar.leads": "Leads",
    "sidebar.broadcasts": "Broadcasts",
    "sidebar.reviews": "Reviews",
    "sidebar.catalog": "Catalog",
    "sidebar.calendar": "Calendar",
    "sidebar.connectors": "Connectors",
    "sidebar.configuration": "Settings",
    "sidebar.testConsole": "Test Console",
    "sidebar.assistant": "Assistant",
    "header.searchPlaceholder": "Search sections…",
    "header.searchEmpty": "No matches",
  },
};
```
(This seed covers Sidebar + header only — every later task in this plan that touches a page ADDS its own keys to both `ru`/`en` objects here, same file, same pattern. Do not create per-page dictionary files — one shared file, additive edits, so there's a single source of truth.)

`dashboard/src/lib/i18n/LocaleProvider.tsx`:
```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { translations, type Locale } from "./translations";

const LOCALE_KEY = "cortege-dashboard-locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === "ru" || stored === "en") setLocaleState(stored);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }, []);

  const t = useCallback((key: string) => translations[locale][key] ?? key, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

/** Safe outside a LocaleProvider (e.g. a shared component also rendered on
 * mobile, which has no provider) — falls back to Russian passthrough rather
 * than throwing, so shared components work on both trees. */
export function useT(): (key: string) => string {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx.t;
  return (key: string) => translations.ru[key] ?? key;
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider (desktop-only)");
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}
```

`dashboard/src/app/d/layout.tsx` — wrap children:
```tsx
import { DesktopHeader } from "@/components/DesktopHeader";
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { Sidebar } from "@/components/Sidebar";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="desktop-shell">
        <GemSmokeBackground />
        <Sidebar />
        <div className="desktop-main">
          <DesktopHeader />
          <main className="desktop-content">{children}</main>
        </div>
      </div>
    </LocaleProvider>
  );
}
```
(Read the current file first — `FloatingAssistant` from Task 5 also gets added here; if Task 5 runs after this one, add it then rather than guessing its final shape now.)

`DesktopHeader.tsx`: replace its own local `locale`/`setLocaleAndPersist` state with `useLocale()` from the new provider; replace the hardcoded search placeholder/empty-state strings with `t("header.searchPlaceholder")`/`t("header.searchEmpty")` using `useT()`. Read the current file (it has `useEffect` reading `LOCALE_KEY` locally, an `inputRef`/`rootRef`/search-matching logic from the recent Connectors batch) and adapt precisely — don't remove the search/quick-nav logic, only the locale state and the two hardcoded strings change.

Build, commit: `feat(dashboard): add i18n infrastructure (LocaleProvider, useT) wired to the header toggle`.

---

### Task 4: Translate Sidebar

Modify `dashboard/src/components/Sidebar.tsx`: import `useT` from `@/lib/i18n/LocaleProvider`; call `const t = useT();` inside the component; replace every hardcoded `label:` string in `TOP_ITEMS_BEFORE_GROUP`/`CRM_GROUP_ITEMS`/`TOP_ITEMS_AFTER_GROUP` with a lookup — since those arrays are module-level constants (not inside the component, so they can't call hooks directly), restructure so each entry stores a translation KEY instead of the literal label (e.g. `{ href: "/d", labelKey: "sidebar.overview", Icon: HomeIcon }`), and `renderLink` (inside the component, has access to `t`) resolves `t(item.labelKey)` when rendering `<span>{label}</span>`. The "CRM" group-toggle button's own literal `<span>CRM</span>` becomes `<span>{t("sidebar.crm")}</span>`. All dictionary keys already exist from Task 3 — no new translations.ts edits needed for this task.

Build, commit: `feat(dashboard): translate Sidebar labels`.

---

### Task 5: Floating Assistant widget

**Files:** create `dashboard/src/components/FloatingAssistant.tsx`; modify `dashboard/src/app/d/layout.tsx`, `dashboard/src/app/globals.css`.

Read `dashboard/src/app/d/assistant/page.tsx` first for the exact `/api/assistant/chat` call shape to mirror (message state, `send()`, suggestions).

`FloatingAssistant.tsx` — a client component with local `open` state (starts `false`):
- Collapsed: fixed bottom-right circular button (`SparkleIcon`), `.floating-assistant-trigger`.
- Expanded: a `.floating-assistant-window` (~360×520px, fixed bottom-right, glass, same `.chat-frame`-style treatment but sized smaller) containing a small header ("Ваш Ассистент" + a close button) and a `ChatThread` wired to `/api/assistant/chat` exactly like `dashboard/src/app/d/assistant/page.tsx` (same suggestions array, same send logic — duplicate the ~30 lines rather than extracting a shared hook, matching this codebase's existing style of small per-page duplication over premature abstraction, e.g. Test Console's `AssistantPane`/`TestPane` already duplicate similarly-shaped chat logic side by side).

CSS: `.floating-assistant-trigger` (fixed, bottom:2rem, right:2rem, z-index:50, 56px circle, glass+accent), `.floating-assistant-window` (fixed, bottom:2rem, right:2rem, z-index:50, width:360px, height:520px, same glass/blur/border/shadow language as `.chat-frame`, flex column with its own header + a `.chat-frame`-like scrollable body), `.floating-assistant-close` (small icon button top-right of the window header).

Render `<FloatingAssistant />` in `dashboard/src/app/d/layout.tsx` as a sibling of `Sidebar`/`DesktopHeader`, inside `LocaleProvider` (so it can use `useT()` for its own strings — add `"assistant.floatingTitle": "Ваш Ассистент"` / English `"Your Assistant"`, `"assistant.close": "Закрыть"` / `"Close"` to `translations.ts`).

Build, commit: `feat(dashboard): add a persistent floating Ассистент widget alongside the full page`.

---

### Task 6: Translate Обзор, Коннекторы, Каталог, Календарь

Read each of `dashboard/src/app/d/page.tsx`, `dashboard/src/app/d/connectors/page.tsx`, `dashboard/src/app/d/catalog/page.tsx`, `dashboard/src/app/d/calendar/page.tsx` (plus `CalendarGrid.tsx`, `PackagesEditor.tsx`, `PartnersEditor.tsx` since Каталог/Календарь render them). For each: add `"use client"` `useT()` call where not already a client component (all of these already are), replace every user-visible hardcoded Russian string (headings, `muted` paragraph copy, button labels, empty-state text, status-badge labels, field labels) with `t("<namespace>.<key>")`, adding both `ru` and `en` entries to `translations.ts` (namespaces: `overview.*`, `connectors.*`, `catalog.*`, `calendar.*`). Leave alone: anything that is data the owner typed (package names/prices, an actual client's message content) — only the dashboard's own chrome gets translated, per the spec.

`PackagesEditor`/`PartnersEditor` are shared with mobile — use `useT()` (the safe-fallback version), not `useLocale()`, so they don't crash when rendered inside `(mobile)/catalog`.

Build, commit: `feat(dashboard): translate Обзор, Коннекторы, Каталог, Календарь`.

---

### Task 7: Translate Диалоги, Тест-консоль, Ассистент, Настройки

Read `dashboard/src/app/d/conversations/page.tsx`, `dashboard/src/app/d/test-console/page.tsx`, `dashboard/src/app/d/assistant/page.tsx`, `dashboard/src/app/d/configuration/page.tsx` (plus `FaqEditor.tsx`, `PoliciesEditor.tsx`, `CompanyInfoEditor.tsx`, `KnowledgeGapsEditor.tsx`, `SkillsEditor.tsx` rendered from Настройки/Тест-консоль). Same approach as Task 6: `useT()`, replace chrome strings, add `conversations.*`/`testConsole.*`/`assistant.*`/`configuration.*` keys to both locales. `STATUS_LABEL`/`ROLE_LABEL` maps in the Диалоги page become functions of `t()` instead of static `Record<string,string>` literals. Shared editors (`FaqEditor`, `PoliciesEditor`, `CompanyInfoEditor`, `SkillsEditor`) use the safe-fallback `useT()`, same reasoning as Task 6.

Build, commit: `feat(dashboard): translate Диалоги, Тест-консоль, Ассистент, Настройки`.

---

### Task 8: Translate Лиды, Рассылки, Отзывы

Read `dashboard/src/app/d/leads/page.tsx`, `dashboard/src/app/d/broadcasts/page.tsx`, `dashboard/src/app/d/reviews/page.tsx`, and `LeadsList.tsx`. Same pattern, `leads.*`/`broadcasts.*`/`reviews.*` keys. `LeadsList`'s Kanban column headers (status labels) and the lead-status enum mapping become `t()`-driven.

Build, commit: `feat(dashboard): translate Лиды, Рассылки, Отзывы`.

---

### Task 9: Final verification

Run `cd dashboard && npm run build && npm test -- --run` — build succeeds, all tests pass (Task 2 adds one new test, everything else unchanged).

Manually toggle RU/EN in a browser (dev server, dev-bypass) and click through every desktop page — confirm no page shows a raw translation key (e.g. literal text `"overview.title"` on screen) instead of real text on either language, and that `t()`'s fallback-to-key behavior would make any miss immediately obvious rather than silently blank.

Grep for accidental double-translation or leftover hardcoded strings is not practical to automate here (Russian Cyrillic text is legitimate in plenty of intentionally non-translated data fields) — the manual click-through is the real check. Report explicitly which pages were verified live vs. only build-verified.
