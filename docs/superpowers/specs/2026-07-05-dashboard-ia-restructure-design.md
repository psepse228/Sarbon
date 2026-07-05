# Cortège dashboard IA restructure — Каталог, Аналитика, Профиль компании

## Context / motivation

The owner's actual usage pattern is reactive: they open the dashboard after a
Telegram notification (bot escalation or error), not by browsing proactively.
Deep-linking the notification straight into the relevant escalation/conversation
was considered and explicitly deemed **not critical** — out of scope here.

The current "Ещё" hub flatly mixes two different kinds of data:
- "fill once and rarely revisit" venue data (Пакеты, FAQ, Партнёры, Политики)
- "check often" client-activity data (Диалоги, Эскалации)

This restructure separates them into three clear buckets:
- **Каталог** — what we offer clients (Пакеты + Партнёры)
- **Аналитика** — how we're doing with clients (self-resolution rate,
  escalation counts, upcoming availability, plus links into Диалоги/FAQ/Эскалации)
- **Профиль компании** — one-time company setup (new company info fields +
  Политики + Календарь)

## Navigation changes

Tab bar: `{Обзор, Ассистент, Календарь, Ещё}` → `{Обзор, Аналитика, Ассистент, Ещё}`.
Календарь loses its own tab and moves into Профиль компании (inside Ещё).

Routes:
- `/analytics` (**new**) — Аналитика tab destination.
- `/catalog` (**new**) — segmented Пакеты/Партнёры view. Replaces `/packages`
  and `/partners` as linked destinations; those two routes are removed. The
  existing `PackagesEditor`/`PartnersEditor` components are reused unchanged,
  just mounted inside a segmented-toggle wrapper.
- `/company-profile` (**new**) — company info + Политики + Календарь.
  Replaces `/policies` and `/availability` as linked destinations; those two
  routes are removed. Existing `PoliciesEditor` and the Availability form/list
  are reused unchanged, just relocated.
- `/more` (Ещё) — becomes a 2-group hub: "Клиентское предложение" → Каталог;
  "Компания" → Профиль компании.
- `/escalations`, `/conversations`, `/faq` are unchanged, now linked from the
  Аналитика hub-list instead of the Overview card.

The Overview ("Работа с клиентами") card added earlier this session is
**removed** once Аналитика ships — it would otherwise duplicate Аналитика's
hub-list (same lesson as the Overview/Статус профиля cleanup done earlier).

## Аналитика page (`/analytics`)

All three metrics are computed client-side from the existing
`/api/escalations` and `/api/conversations` responses — no new backend
aggregation endpoint is needed (these were explicitly scoped as snapshot
ratios/counts, not day-by-day trends; see "Out of scope").

1. **Meter** — "Бот справляется сам": `% = conversations with zero matching
   escalations ÷ total conversations`. Rendered as a horizontal meter (fill =
   `--color-accent`, track = `--color-accent-tint`, per dataviz guidance a
   single ratio is a meter, not a donut/pie), big percentage value above,
   one-line caption below (e.g. "41 из 50 диалогов закрыты без эскалации").
2. **KPI row** — three stat tiles: Эскалации открыто (`notifiedOwner===false`
   count), Эскалации решено (`notifiedOwner===true` count), Свободных дат
   (`isAvailable && date >= today` count).
3. **Hub list** — Диалоги с клиентами → `/conversations`, Частые вопросы →
   `/faq`, Эскалации → `/escalations` (same `.hub-row` pattern used elsewhere).

## Каталог page (`/catalog`)

Segmented toggle at top, reusing the `.segmented` pattern already used on the
Availability page: **Пакеты | Партнёры** (Пакеты is the default tab). Each
panel renders the existing `PackagesEditor` / `PartnersEditor` component
unchanged — this is a navigation/grouping change only, no CRUD logic changes.

## Профиль компании page (`/company-profile`)

Three stacked cards, top to bottom:
1. **Company info** (new data) — editable fields: `company_name`, `address`,
   `phone`, `socials` (free text, one line per entry, e.g.
   `Instagram: @venue`). New `CompanyInfoEditor` component, same save pattern
   as the other editors (PUT + optimistic success/error banner).
2. **Политики** — existing `PoliciesEditor`, unchanged.
3. **Календарь** — existing Availability add-form + list, unchanged, just
   relocated here instead of living on its own tab.

## Backend / schema changes

- New migration `supabase/migrations/0003_add_company_info.sql`: adds nullable
  `company_name text`, `address text`, `phone text`, `socials text` to
  `company_profile` (same additive, no-backfill-needed shape as the
  `active_notice` migration).
- `backend/app/functions/handlers.py`: extend `_fetch_company_profile`'s
  select list with the 4 new columns.
- `backend/app/ai/engine.py`: `_system_message()` gets the same
  always-injected treatment as `active_notice` — if any of
  company_name/address/phone/socials is set, append a short "О ЗАВЕДЕНИИ"
  block to the system prompt, so the bot can answer "где вы находитесь" /
  "как до вас дозвониться" without needing a dedicated tool call (same
  reasoning as why `active_notice` is injected directly rather than
  tool-gated: it's small, always-relevant background fact, not something
  worth a round-trip).
- New backend tests mirroring the existing `active_notice` coverage: field
  passthrough in `_fetch_company_profile`, and system-prompt injection when
  the fields are set vs. absent.

## Dashboard type / data-layer changes

- `src/lib/types.ts`: `CompanyProfile` gains `companyName: string | null`,
  `address: string | null`, `phone: string | null`, `socials: string | null`.
- `src/lib/companyProfile.ts`: `COLUMNS`, row mapping, and `upsertColumn`'s
  column union extended for the 4 new fields; new `saveCompanyInfo()` helper
  mirroring `saveActiveNotice()`.

## Out of scope

- Deep-linking Telegram notifications into specific escalations/conversations
  — explicitly deemed not critical during the brainstorm.
- Day-by-day trend charts / time-series aggregation — the three approved
  Аналитика metrics are all current-snapshot ratios/counts, which the dataviz
  guidance says should be a stat tile / meter, not a chart; a trends view
  would need a new backend aggregation endpoint and wasn't requested.
- Assistant page visual redesign v2 (WorldFirst reference) — separate thread,
  pending reference screenshots from the user, tracked independently of this
  spec.

## Testing / verification plan

- Backend: `pytest` covering the new migration's field passthrough and
  system-prompt injection (mirrors the existing `active_notice` tests).
- Dashboard: `npm run lint` + `npm run build` after each page move; Playwright
  screenshots of `/analytics`, `/catalog`, `/company-profile`, `/more`, and the
  tab bar at mobile viewport, following the verification pattern used
  throughout this session.
- Manual: confirm the bot correctly answers an address/phone question once
  `company_name`/`address`/`phone` are filled in, mirroring how
  `active_notice` was verified end-to-end earlier this session.
