# Cortège Desktop Dashboard — Polish Pass (header, sidebar grouping, framed chats, sparklines, Test Console presets)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Address the owner's design review notes on the live desktop dashboard — a new top header (search + language toggle), a grouped/collapsible sidebar for CRM-related pages, real framed containers around the two chat surfaces, sparkline charts on KPI tiles, and a real Test Console upgrade (intro copy + quick-switchable skill presets — **not** raw system-prompt editing, see below).

**Why now:** First real design-review pass since the glassmorphism redesign and CRM expansion both shipped functionally complete but visually unrefined (owner's words: "doesn't look like a finished premium site," floating content with no frame). Owner reviewed the live dashboard against a competitor screenshot and sent concrete notes.

## Explicit scope correction: no raw system-prompt editor

The owner's original note asked for "a text field where you can write a prompt" in Test Console. **Confirmed with the owner this means structured presets, not raw prompt editing** — Cortège has a standing, permanent architectural decision against exposing the raw system prompt (see the BRAI competitive-teardown roadmap: "conflicts with Cortège's core differentiator: structured, grounded facts drive answers, not an owner hand-editing a raw prompt that could break grounding"). What ships instead: **3 default, editable, quick-switchable presets**, each just a named combination of the *existing* 4 toggleable skill groups (`packages`, `availability`, `faq`, `partners` — the same ones Phase 4a's Настройки → Навыки tab already manages via `company_profile.disabled_skills`).

**Critical constraint:** switching a preset in Test Console must be a **test-mode-only override** — it must never write to the tenant's real `company_profile.disabled_skills`, which the live guest-facing bot reads. Trying "Только цены" in the console must not silently disable FAQ/partners for real guests.

## A. Desktop header (new — doesn't exist today)

`dashboard/src/app/d/layout.tsx` currently has no header at all — just `.desktop-ambient` + `Sidebar` + `.desktop-content`. Add a new `DesktopHeader` component, rendered once above `.desktop-content` (sidebar stays full-height on the left, unaffected):

- **Search input**, placeholder `Поиск по разделам, лидам, диалогам…`, with a `Ctrl K` shortcut hint chip on the right edge of the input (visual only for this pass — pressing `Ctrl+K` focuses the input; **no actual search/filtering logic** is in scope here, this is a v1 visual + focus-shortcut only, not a real search backend). Reuse the existing `.card`-adjacent glass tokens for styling, not a new visual language.
- **RU/EN toggle** — a two-state pill button (matching `.segmented` styling already in `globals.css`) that sets a `locale` value in `localStorage` (`cortege-dashboard-locale`, default `"ru"`). **Scope for this pass: persists the choice and changes the toggle's own visual state only** — it does not yet translate any dashboard UI strings (that's a much larger i18n effort, out of scope) and is unrelated to Task A's separate multi-language *guest bot reply* feature (already shipped) — this toggle is for the owner's own dashboard chrome, not the guest bot.

## B. Sidebar: collapsible "CRM" group

`dashboard/src/components/Sidebar.tsx`'s flat `ITEMS` array becomes two kinds of entries: plain links (Обзор, Настройки, Тест-консоль, Ассистент) and one collapsible group. Confirmed grouping: a **"CRM"** parent containing Диалоги, Лиды, Рассылки, Отзывы as children, rendered indented underneath when expanded (matching the reference screenshot's "Sales" pattern — chevron toggle, children slide in below the parent label). Default state: **expanded** if the current route is one of the CRM children (so navigating directly to `/d/leads` doesn't hide the very item you're on), collapsed otherwise, persisted in `localStorage` (`cortege-sidebar-crm-expanded`).

New nav order: Обзор → **CRM ▾** (Диалоги, Лиды, Рассылки, Отзывы) → Настройки → Тест-консоль → Ассистент.

## C. Icons on more labels + KPI sparklines

Scope this concretely rather than "everywhere":

1. **KPI tiles get a small icon + sparkline.** `.kpi-tile` (Overview page and the Reviews page's average-rating tile) gains a top-row icon (reuse existing icon set: `BellIcon` for open-escalations, `ChatIcon` for total-conversations, `AnalyticsIcon` for resolution-rate/average-rating, `CalendarIcon` for free-dates) and a small trend sparkline under the number. **Sparkline data:** since there's no historical time-series storage yet, the sparkline for this pass renders from whatever short run of real numbers is cheaply available (e.g., the KPI's own value repeated/flat, or omitted with a "недостаточно данных" state) — **do not fabricate fake historical trend data.** Read the `dataviz` skill before implementing any chart in this pass.
2. **Panel headers** (`.card-title-row h3` on Overview's meter/activity panels, Reviews, Broadcasts) get a small leading icon matching their content, reusing existing icons — no new icons needed beyond what Section A/B/E already require.

## D. Framed chat surfaces (Test Console + Assistant)

Both `dashboard/src/app/d/test-console/page.tsx` and `dashboard/src/app/d/assistant/page.tsx` render the shared `ChatThread` component with no visible container — it just sits on the ambient background. **`ChatThread.tsx` itself is not modified** (it's also used by the mobile `/assistant` page, which is out of scope — mobile stays untouched, same boundary every prior phase used). Instead, each desktop page wraps its own `<ChatThread>` in a new `.chat-frame` container: a glass panel (reusing the `.desktop-shell .card` glass treatment, scoped so it doesn't affect the mobile chat), fixed reasonable height (e.g. `min-height: 560px`) so the chat reads as a bounded window instead of floating text over the ambient background, with the chat log scrolling inside it and the input row docked to the frame's bottom edge (not the viewport bottom, which is how `.chat-input-row`'s `position: sticky` currently behaves — desktop already has a `.desktop-content .chat-input-row { bottom: 0 }` override from Phase 1; this pass changes that positioning to be relative to `.chat-frame` instead of the content column).

## E. Test Console specifics

- Add intro copy under the `<h1>`: replace/extend the current description with the owner's requested line, **"Постройте и протестируйте вашего бота."**, kept alongside (not replacing) the existing explanatory paragraph about test isolation.
- Add a preset switcher above the chat frame: 3 named preset chips/buttons (`Полный`, `Только цены`, `Без бронирования` — reasonable defaults, editable per below) — clicking one sets which of the 4 skill groups are treated as disabled **for this Test Console session only**.
  - `Полный` → all 4 enabled (empty disabled set)
  - `Только цены` → `packages` enabled, `availability`/`faq`/`partners` disabled
  - `Без бронирования` → `packages`/`faq`/`partners` enabled, `availability` disabled
- "Editable" means: each preset chip, when active, reveals the 4 skill checkboxes (reuse the existing checkbox pattern from Настройки → Навыки) so the owner can tweak that preset's combination on the fly before sending a test message — changes are session-local (React state), not persisted anywhere (not to `company_profile`, not to `localStorage` — resets to the 3 defaults on page reload, since these are scratch presets for exploring behavior, not saved configuration; Настройки → Навыки remains the one place that actually configures the live bot).
- **Backend change required:** `POST /internal/test-chat` needs an optional `disabled_skills: list[str] | None` field on `TestChatRequest`. When present, `generate_reply` must use it instead of fetching the tenant's real `company_profile.disabled_skills` — **only in `test_mode=True` calls**, never for real guest traffic. `dashboard/src/app/api/test-chat/route.ts` passes through the active preset's disabled-skills list on each send.

## F. Assistant page rename + frame

`dashboard/src/app/d/assistant/page.tsx`: `<h1>Ассистент</h1>` → `<h1>Ваш Личный Ассистент</h1>`. Sidebar label for `/d/assistant` stays "Ассистент" (short label for nav real estate — only the page's own heading changes, matching how e.g. "Настройки" in the sidebar maps to a page that might have a longer on-page title elsewhere in this codebase's existing convention... actually no existing precedent for this split — **decide during planning**: either keep both in sync (`Ассистент` everywhere) or make this explicit split; default to matching the owner's literal request (rename the page heading only, leave the compact sidebar label as "Ассистент") since a longer label doesn't fit the sidebar's fixed width well). Same `.chat-frame` treatment as Test Console (Section D) — reuse the identical frame, not a bespoke second design.

## Explicitly out of scope for this pass

- Real backend-wired search (Section A's search box is visual/focus-only)
- Dashboard UI translation/i18n (Section A's RU/EN toggle only persists a preference, doesn't translate anything yet)
- Raw system-prompt text editing (explicitly rejected, see top)
- Real historical time-series storage for sparklines (Section C uses only currently-available data, no fabrication)
- Any change to mobile app pages, including `ChatThread.tsx`'s own internals

## Open questions for planning

1. Exact `DesktopHeader` component placement/height and how it interacts with `.desktop-content`'s existing padding — implementation detail.
2. Icon choices for the two new sidebar/header controls (search, globe/language) — pick reasonable new additions to `dashboard/src/components/icons.tsx` following its existing 22×22/stroke-1.7 convention, not a design blocker.
