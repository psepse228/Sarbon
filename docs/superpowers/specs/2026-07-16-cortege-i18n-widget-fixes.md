# Cortège i18n, Floating Assistant, SEO noindex & Tenant-Creation Hardening — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Follow-through on the full findings list from the SEO/UI review pass: make the RU/EN toggle real (full desktop i18n), turn "Ваш Ассистент" into an always-available floating widget in addition to its full page, add a `noindex` tag (this is an internal owner tool, not a marketing page), and hardenresolveOrCreateTenantByEmail`'s error path.

## A. SEO — `noindex`

**Problem:** confirmed via raw HTML inspection that the dashboard has a real title/description/viewport/favicon already — nothing missing there. What it's actually missing is telling search engines to stay out: this is a login-gated owner tool, not content meant to rank.

**Fix:** `dashboard/src/app/layout.tsx`'s `metadata` export gains `robots: { index: false, follow: false }`. One line, no other SEO work needed — Open Graph/structured data are irrelevant for a page nobody should discover via search.

## B. `resolveOrCreateTenantByEmail` — honest error, no silent data risk

**Problem:** observed a real `insertError.code === "23505"` (Postgres unique-violation) followed by the retry-select finding zero rows, during manual testing with a throwaway test email under rapid repeated requests — most likely a transient network blip between the dashboard and Supabase during that specific test session, not a reproduced logic bug (the `owner_email` unique constraint is the only one that could produce a 23505 here, and re-querying by that exact email should always find the row a moment after a real unique-violation). Not confidently reproducible, but the current fallback message ("unknown race error") is not something a real user should ever see verbatim.

**Fix (proportionate — hardening, not a rewrite):** on the race-retry path, if the re-select still comes back empty, retry the select **once more** after a short delay (150ms) before giving up — closes the plausible "insert committed a moment after our first re-select ran" timing window without adding real complexity. The final fallback error message becomes owner-facing-appropriate: "Не удалось войти — попробуйте ещё раз." (rather than exposing "unknown race error"). This is genuinely just defensive hardening of an edge case already handled — not a claim that a concrete bug was found and fixed.

## C. Floating "Ассистент" widget (additive, not a replacement)

**Problem:** the owner's sketch showed the Ассистент panel moved to a small window anchored bottom-right, rather than only living as a full sidebar page.

**Design decision:** add a persistent floating chat widget, available on every `/d/**` page, **in addition to** the existing full `/d/assistant` page (which stays, for anyone who wants the larger surface — this is additive, nothing is removed). Collapsed state: a small round button bottom-right (mint, `SparkleIcon`, matching the sidebar's own icon for this feature) with a subtle glass ring. Clicking expands it into a compact chat window (roughly 360×520px, anchored to the same bottom-right corner) reusing the exact same `/api/assistant/chat` call and `ChatThread` component the full page already uses — so behavior/effect on the real bot is identical, just the presentation differs. Collapsing/expanding state is **not** persisted across page loads (starts collapsed every time) — a chat window staying open across every navigation would be visually noisy; this matches how most chat widgets in other products behave (Intercom, Drift, etc. also default to closed on load).

Implementation: new `FloatingAssistant.tsx` client component, rendered once in `dashboard/src/app/d/layout.tsx` (the desktop shell), sibling to `Sidebar`/`DesktopHeader`, so it persists across all desktop route changes without remounting.

## D. Full RU/EN translation of the desktop dashboard

**Scope confirmed with the owner: full desktop dashboard.** Mobile has no RU/EN toggle and is out of scope (unaffected).

**Architecture:** a plain dictionary + React Context, no new npm dependency (matches this codebase's established preference for hand-rolled solutions over pulling in a library like `next-intl` for something this contained):

- `dashboard/src/lib/i18n/translations.ts` — a single `Record<Locale, Record<string, string>>` dictionary (`Locale = "ru" | "en"`), namespaced flat keys (e.g. `"sidebar.overview"`, `"overview.title"`, `"catalog.addPackage"`). Flat namespaced keys (not nested objects) keep the diff simple when many keys get added across one pass.
- `dashboard/src/lib/i18n/LocaleProvider.tsx` — a context provider owning `locale`/`setLocale` (backed by the same `localStorage` key `DesktopHeader` already reads, `cortege-dashboard-locale` — no migration needed, it already persists a value there, this just makes it do something) and a `t(key: string): string` function that looks up the current locale's entry, falling back to the key itself if missing (so a forgotten translation is visibly wrong in the UI rather than silently blank — easy to spot in review).
- `dashboard/src/app/d/layout.tsx` wraps its children in `<LocaleProvider>`.
- `DesktopHeader`'s RU/EN buttons call the real `setLocale` from context instead of only updating local component state.
- Every desktop-only page/component under `dashboard/src/app/d/**` and the desktop-specific components it renders (`Sidebar`, `DesktopHeader`, `AccountMenu`, editors used from `/d/catalog`+`/d/configuration`, `CalendarGrid`, `ChatThread` when rendered on a desktop page, `LeadsList`, `KnowledgeGapsEditor`) call `useT()` and replace hardcoded Russian strings with `t("namespace.key")` calls, with both `ru`/`en` entries added to the dictionary at the same time. Components already shared with mobile (`PackagesEditor`, `PartnersEditor`, `FaqEditor`, `PoliciesEditor`, `CompanyInfoEditor`, `SkillsEditor`) get their hardcoded strings translated too **only when rendered inside `/d/**`** — since `useT()` reads from `LocaleProvider` context, and mobile's route tree is never wrapped in that provider, calling `t()` from a shared component would crash on mobile with "no LocaleProvider found." To avoid this, `useT()` returns a safe passthrough (`t = (key) => translations.ru[key] ?? key`) when no provider is present, rather than throwing — so shared components work correctly on both trees: real translation on desktop, Russian-only (today's actual current behavior) on mobile, with zero risk of a crash.

**Explicitly out of scope for this pass:**
- Translating the mobile app — no toggle exists there, not requested.
- Translating dynamic data (lead names, chat message content, package names the owner typed in) — only the dashboard's own UI chrome (labels, headings, buttons, placeholders) is translated. A message the client actually sent, or a package name the owner wrote in Russian, stays as literally entered — translating user-authored content would be fabricating a fact.
- A third language — RU/EN only, matching the existing toggle's only two options.
