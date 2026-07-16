# Cortège Connectors, Instagram-style Inbox, Test Console Split & Readability — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** A batch of five owner-requested design-review items for the desktop dashboard. Scoped explicitly with the owner: full RU/EN translation is **out of scope for this batch** — it's a large, separate effort tracked on its own (see the follow-up i18n spec).

## A. Readability — more blur, slightly bolder text

**Problem:** the live GemSmoke shader background bleeds through the glass panels enough that text is hard to read against it, per owner feedback on a live screenshot.

**Fix:** every glass-panel rule sharing the `blur(28px) saturate(150%)` treatment (`.card`, `.kpi-tile`, `.chat-frame`, `.desktop-header`, `.account-menu-dropdown`, `.calendar-day-editor`, catalog cards, etc. — all rules using this exact value, `globals.css`) bumps to `blur(40px) saturate(165%)`, and `--glass` gets very slightly more opaque (`rgba(255,255,255,0.055)` → `rgba(255,255,255,0.075)`) so the panel itself does more of the contrast work instead of relying purely on blur. Base body text weight bumps from default (400) to 450 for the small readability gain on non-heading text without making everything look bold; `.muted` text (currently `--color-text-faint`, quite low contrast against a moving background) shifts to `--color-text-soft` wherever it sits directly on glass rather than a solid card.

## B. Header search — quick navigation, not full search

**Problem:** the search box in `DesktopHeader` is a non-functional placeholder (Ctrl+K focuses it, nothing else happens).

**Fix (scoped with the owner — quick nav, not full data search):** typing filters a fixed list of every desktop destination (Обзор, Диалоги, Лиды, Рассылки, Отзывы, Каталог, Календарь, Коннекторы, Настройки, Тест-консоль, Ассистент) by label (simple case-insensitive substring match, no fuzzy scoring needed for ~11 items), rendered as a dropdown under the search box; Enter or click navigates to the top match. Esc clears/closes. No backend call — this is a pure client-side `Array.filter` over a static route list already known by `Sidebar.tsx`.

## C. New "Коннекторы" (Connectors) section

**Problem:** no visible list of which messaging channels are connected; the owner wants a page in the spirit of the BRAI reference screenshot they shared (channel cards with a Connect button), reimagined in Cortège's own brand, not copied.

**Fix:** new sidebar destination `/d/connectors`, "Коннекторы", placed after Календарь and before Настройки. Renders a grid of channel cards:
- **Telegram** — real status: connected/not-connected is derived from whether `TELEGRAM_BOT_TOKEN` is configured server-side, surfaced via a new lightweight endpoint (`GET /api/connectors/status` — no new backend route needed, checks the same env var the dashboard's `internal.ts`-style calls already assume is configured, reusing the existing `BACKEND_URL`/`INTERNAL_API_SECRET` internal-call pattern is overkill for a boolean env-var check that the *dashboard's own* Next.js server process can answer directly by checking `process.env.TELEGRAM_BOT_TOKEN` — no backend involvement needed here at all). Shows "Подключено" (connected, mint badge) or "Не настроено" (not configured, muted badge) — never a fake "Connect" button that does nothing, since this channel's connection is a real env-var-configured integration already serving guest traffic.
- **WhatsApp, Instagram, Facebook Messenger, Email** — shown as cards with a disabled "Скоро" (Coming soon) pill instead of a working Connect button — explicitly **not** faking a working integration, consistent with this codebase's "never fabricate" principle. This matches the owner's own confirmed scope (Telegram real, others "coming soon") and the existing roadmap note that Instagram is next, not immediate.
- **Web Chat** — also "Скоро", since there's no widget/embed infrastructure yet.

New icons (monochrome, in the existing icon style — generic glyphs, not literal brand logos): `TelegramIcon` (paper plane), `WhatsAppIcon`/`MessengerIcon` (generic chat-bubble variants), `InstagramIcon` (rounded-square/lens abstraction), `MailIcon` (envelope).

## D. "Диалоги" — Instagram-Direct-style two-pane inbox

**Problem:** current `/d/conversations` is a plain HTML table linking to a separate detail page — the owner wants it redesigned as a proper inbox, explicitly referencing Instagram Direct's layout.

**Fix:** collapse the list+detail pages into one `/d/conversations` page with a two-pane layout (list never navigates away — no more `/d/conversations/[id]` route):
- **Left pane** (fixed width, own scroll): one row per conversation — an avatar-style initial-circle (from `clientId`), a bolded first line (client identifier — same data already shown, "Клиент {clientId}"), a second line "muted" preview (best-effort: the status label, since message previews aren't fetched in the list endpoint and adding one is out of scope for this pass — see Explicitly out of scope), and a right-aligned relative timestamp. The selected row is highlighted (mint-tinted background), matching the sidebar's own active-item treatment for visual consistency.
- **Right pane**: the selected conversation's full message thread, re-using the same `.chat-row`/`.chat-bubble` visual language as `ChatThread` (not the component itself, since this is read-only history rendering three roles — client/bot/human — not an interactive send-a-message chat; a small local read-only render avoids force-fitting `ChatThread`'s send-focused props). Client messages align left, bot messages align right (mint, matching how the dashboard treats "the bot" elsewhere as the mint/accent-colored bubble), human/admin messages align right in a distinct muted-gold-bordered bubble so an admin's own manual reply is visually distinguishable from the bot's. Empty state ("Выберите диалог слева") when nothing is selected yet; first conversation auto-selected on load if the list is non-empty.
- `dashboard/src/app/d/conversations/[id]/page.tsx` is deleted — its logic (`useConversationMessages`) is reused, not duplicated, by the new combined page.

## E. Test Console — split into "prompt" and "test" panes

**Problem:** owner's sketch (two rectangles drawn over the current single chat area) asks for two side-by-side chats: one where the owner "prompts"/instructs the bot, one where the bot is actually tested as a guest would experience it.

**Design decision (this is genuinely two different chat sessions with two different purposes, not a cosmetic split):**
- **Left pane — "Настройка"**: this *is* the existing `/d/assistant` personal-assistant chat (the one that lets the owner say things like "у нас акция, скажи об этом клиентам" and have it actually take effect) — reused here as a second, smaller instance so the owner can adjust behavior and immediately test the effect without leaving the page. Rather than embed a second full copy of `/d/assistant`'s page component (which owns its own route/heading), Test Console renders the same `ChatThread` + `/api/assistant/chat` call pattern locally, labeled "Настройка боту" with a caption clarifying this actually changes real bot behavior (same distinction already drawn between the ephemeral skill-preset switcher and the real "Навыки ИИ" section below it).
- **Right pane — "Проверка"**: the existing test-chat flow (`/api/test-chat`, `disabledSkills`, tool-call trace) — unchanged in behavior, just repositioned into the right half of a two-column layout instead of the sole chat on the page.
- Both panes are `.chat-frame`s side by side (`.test-console-split`, a two-column grid, stacking to one column under ~900px so it doesn't break on a narrower window); the preset-row/skill-toggle editor stays above the right ("Проверка") pane specifically, since presets only affect the test flow, not the assistant-instruction flow. The real "Навыки ИИ" section stays below both panes, full width, unchanged.

## Explicitly out of scope for this pass

- Full RU/EN translation (separate spec/plan, tracked on its own — this is the single largest remaining item and deserves dedicated review).
- Real backend integrations for WhatsApp/Instagram/Facebook Messenger/Email/Web Chat — "Скоро" placeholders only, per the owner's own confirmed scope.
- A message-preview column in the Диалоги list (would need a new list-endpoint field returning each conversation's last message text) — the list still shows status + timestamp only; flagged as a natural fast-follow, not invented here.
- Replying to a guest from the Диалоги inbox (send-a-message) — this pass is read-only history viewing, matching the existing page's own stated purpose ("для контроля качества ответов").
- Real full-text search across leads/conversations/reviews — quick navigation between existing sections only, per the owner's own confirmed scope.
