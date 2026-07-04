# Sarbon Dashboard — Owner-Facing Telegram Mini App

Next.js 14 (App Router, TypeScript) app implementing the "Dashboard" layer from
`WEDDING-BOT-CONTEXT.md`: a Telegram Mini App, authenticated via Telegram
`initData`, reading/writing Supabase directly from server-side API routes.

**Scope of this slice:** multi-tenant CRUD for `company_profile` — `packages`,
`faq`, `partners` (jsonb columns) and `policies` (text column). The AI
control-layer / conversations-viewer is out of scope here (comes later).

## Running locally

```bash
cd dashboard
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev                  # http://localhost:3000
npm test                     # vitest — 18 tests, initData HMAC + auth resolution
npm run build                # production build
npm run lint
```

### Env vars (`.env.local`, never committed)

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Same Supabase project as `backend/` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service-role** key. Server-only — used exclusively inside `src/app/api/**` route handlers and `src/lib/supabase/server.ts`, both guarded by the `server-only` import so an accidental client-bundle import fails the build. Never set as `NEXT_PUBLIC_*`. |
| `TELEGRAM_BOT_TOKEN` | Same bot token as `backend/.env` — used to verify the HMAC on incoming `initData`. |
| `TELEGRAM_OWNER_TENANT_MAP` | **Pilot stopgap**, see "Open questions" below. JSON object `{ "<telegram_user_id>": "<tenant_id>" }`. |
| `DEV_BYPASS_INIT_DATA` | Local dev only. Set to a Telegram user id (e.g. one present in `TELEGRAM_OWNER_TENANT_MAP`) to exercise the app in a plain browser outside Telegram, since real `initData` can only be produced by an actual Telegram client. **Never set in a deployed environment** — `src/lib/telegram/auth.ts` uses it to skip HMAC validation entirely. |
| `SESSION_SECRET` | Random 32+ byte secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) signing the PWA/browser session cookie set by `/api/auth/telegram-login`. Unrelated to `TELEGRAM_BOT_TOKEN`. |

### PWA / standalone-app login (Telegram Login Widget)

The dashboard is installable as a PWA (`app/manifest.ts`, `app/icon.png`,
`app/apple-icon.png`) so it can run outside Telegram's Mini App webview —
but outside Telegram there's no `initData`. `src/lib/telegram/loginWidget.ts`
validates the [Telegram Login Widget](https://core.telegram.org/widgets/login)
callback instead (a *different* HMAC construction than Mini App `initData` —
see the doc comment), and `/api/auth/telegram-login` exchanges it for a
signed session cookie (`src/lib/session.ts`). `authenticateOwner()` now
checks the session cookie first, falling back to the `initData` header —
both paths resolve through the same `TELEGRAM_OWNER_TENANT_MAP` stopgap.

**Required one-time setup**: message `@BotFather` → `/setdomain` → select
the bot → give it the dashboard's domain (e.g. `sarbon-khaki.vercel.app`).
The Login Widget button silently refuses to render on any domain the bot
hasn't been told about — this isn't scriptable via the Bot API, it's a
BotFather-chat-only step.

To run the dashboard against the real pilot tenant locally:

```
TELEGRAM_OWNER_TENANT_MAP={"<your-telegram-user-id>":"005ece7a-2af4-4f22-84f7-25d5e743af9e"}
DEV_BYPASS_INIT_DATA=<your-telegram-user-id>
```

## File tree

```
dashboard/
  .env.example
  README.md
  package.json / tsconfig.json / next.config.mjs / vitest.config.ts / .eslintrc.json
  src/
    app/
      layout.tsx            # root layout: fonts, <Nav/>, <TelegramInit/>
      globals.css            # Solura design tokens (bg/white/sky/indigo/gray, Syne+DM Sans)
      page.tsx               # overview: profile status + counts per section
      packages/page.tsx
      faq/page.tsx
      partners/page.tsx
      policies/page.tsx
      api/
        company-profile/route.ts   # GET — full profile for the caller's tenant
        packages/route.ts          # PUT — replace the whole packages[] array
        faq/route.ts               # PUT — replace the whole faq[] array
        partners/route.ts          # PUT — replace the whole partners[] array
        policies/route.ts          # PUT — replace the policies text
    components/
      Nav.tsx
      TelegramInit.tsx        # mounts WebApp.ready()/expand() once
      StatusBanner.tsx        # error/success/dev-mode banners
      PackagesEditor.tsx
      FaqEditor.tsx
      PartnersEditor.tsx
      PoliciesEditor.tsx
    lib/
      types.ts                # Package / FaqEntry / Partner / CompanyProfile
      validation.ts           # zod schemas, mirrored client/server
      apiError.ts             # AuthError/ZodError -> consistent JSON responses
      companyProfile.ts       # server-only Supabase reads/writes, tenant-scoped
      useCompanyProfile.ts    # client hook: GET /api/company-profile
      telegram/
        initData.ts           # pure HMAC validation (no framework deps)
        auth.ts                # authenticateOwner(): header -> {telegramUserId, tenantId}
        client.ts              # browser-only @twa-dev/sdk wrapper + tmaFetch()
      supabase/
        server.ts              # service-role client, server-only
  tests/
    initData.test.ts          # 11 tests: valid/tampered/stale/missing-field cases
    auth.test.ts               # 7 tests: header parsing, tenant resolution, dev bypass
    helpers/signInitData.ts    # test-only, independently re-implements Telegram's signing spec
    mocks/server-only.ts       # vitest alias target (see below)
```

## How auth works

1. Client (inside Telegram) reads `window.Telegram.WebApp.initData` via
   `@twa-dev/sdk` and sends it on every API call as
   `Authorization: tma <initData>` — the header scheme Telegram's own docs
   recommend for Mini Apps talking to a backend.
2. `src/lib/telegram/initData.ts` validates the HMAC server-side
   (`HMAC_SHA256(secret=HMAC_SHA256("WebAppData", bot_token), data=sorted "key=value" pairs)`)
   and rejects stale (`auth_date` > 24h old) or tampered payloads.
3. `src/lib/telegram/auth.ts` then resolves the validated Telegram user id to
   a `tenant_id` (see "Open questions" — this mapping is a stopgap) and every
   subsequent Supabase query is filtered by that resolved `tenant_id`, never
   a hardcoded value, even though only one tenant exists today.

`@twa-dev/sdk` reads `window` at module import time, which crashes under
Next.js's server-side prerendering of "use client" pages. `src/lib/telegram/client.ts`
works around this with a lazy `import("@twa-dev/sdk")` inside an
`if (typeof window === "undefined") return null` guard, instead of a static
top-level import.

## Data model note: `id` fields on jsonb array items

`Package`, `FaqEntry`, and `Partner` each carry a client-generated `id`
(`crypto.randomUUID()`) not present in `WEDDING-BOT-CONTEXT.md`'s schema
sketch. The jsonb array items have no natural primary key, and the dashboard
needs one for stable React keys / edit-delete targeting. This is additive:
`backend/app/functions/handlers.py` matches on `name` (packages), `question`
substring (faq), and `category` (partners) — it never looks at `id` — so
existing backend behavior is unaffected. One side effect worth knowing: the
`id` field will now also appear in the dict that `get_package_price`/`get_faq`/
`get_partners` return to the LLM function-calling layer. That's harmless
today (the model has no use for it) but flag it if the backend owner wants a
cleaner payload — could be stripped in `handlers.py` before returning, or the
dashboard could keep ids in a side index instead of embedding them. Left
as-is for this slice since backend is explicitly out of scope here.

## Design system

Warm "stationery/ledger" palette, diverging from the dark Solura brand
tokens in `WEDDING-BOT-CONTEXT.md` — chosen for an owner-facing back-office
tool where warmth and readability at a glance beat the client-facing dark
brand aesthetic. Cream/paper background (`#F2E8D5`/`#FBF6EC`), deep navy ink
and primary accent (`#223A63`), muted antique gold secondary accent
(`#96731F`), warm taupe for muted text (`#83765F`), terracotta for danger
states (`#B3492E`). Defined as CSS custom properties in
`src/app/globals.css`.

Fonts: **Yeseva One** (headings — a serif display face with the character
often used in Russian wedding/stationery branding) + **Golos Text** (body —
a modern Russian-designed sans), loaded via `next/font/google` in
`src/app/layout.tsx`. Both ship a `cyrillic` subset on Google Fonts, unlike
the previous Syne/DM Sans pair, so Russian UI copy now renders in-brand
instead of falling back to the system font.

The tone used is plain internal-admin Russian (not the client-facing "вы"
formal register from the context doc, since this audience is the restaurant
owner, not a client) — per the task's explicit instruction.

## Open questions (need a human answer)

1. **Telegram-owner → tenant_id mapping.** `tenants`
   (`supabase/migrations/0001_init_schema.sql`) has no column linking a
   Telegram user id to a tenant. This dashboard resolves it via an env var
   (`TELEGRAM_OWNER_TENANT_MAP`, a JSON map) as a stopgap — every query is
   still tenant-scoped through `authenticateOwner()`, so the SaaS shape is
   preserved, but the mapping itself lives in config instead of the
   database. Before onboarding a second tenant this should become a real
   table (e.g. `tenant_owners(tenant_id, telegram_user_id)`) so owners can be
   added without a redeploy. I did not add this migration myself per your
   instruction to flag rather than invent schema — need a decision on the
   table shape (single owner per tenant vs. many-to-many) before I or
   whoever owns `backend/`/`supabase/migrations` adds it.
2. **Single owner vs. multiple owners per tenant.** The stopgap map already
   supports N Telegram user ids -> same tenant_id, so multiple owners "just
   work" today. Confirm that's the intended long-term shape.
3. **jsonb array `id` fields leaking into function-calling responses** — see
   above, low-stakes but worth a decision from whoever owns `backend/`.
4. **Deployment** — nothing has been deployed to Vercel; no `vercel.json`
   or project link exists yet. Needs: a Vercel project pointed at this
   `dashboard/` subdirectory (monorepo root override), the four env vars
   above set as Vercel env vars (service-role key marked sensitive), and a
   production `TELEGRAM_OWNER_TENANT_MAP` (no `DEV_BYPASS_INIT_DATA` in that
   environment — it fully bypasses auth).
5. **Telegram bot menu button** — not configured. Once deployed, the bot
   needs `setChatMenuButton` (or BotFather's `/setmenubutton`) pointed at the
   Vercel URL so the owner can actually open the Mini App from Telegram.
6. **RLS on `company_profile`.** This dashboard only ever talks to Supabase
   via the service-role key from trusted server code, so table-level RLS
   policies aren't load-bearing for *this* app's security — tenant isolation
   is enforced entirely by `authenticateOwner()` + the `.eq("tenant_id", …)`
   filter in `src/lib/companyProfile.ts`. Worth confirming that's
   acceptable long-term (vs. also adding RLS as defense-in-depth once
   `backend/`'s Supabase access patterns are settled).

## What's NOT done in this slice

- No deployment (Vercel project, env vars, domain).
- No Telegram bot menu-button wiring.
- No `tenant_owners`-style DB migration (flagged above, intentionally not invented).
- No RLS policies added (see open question 6).
- No conversations viewer / AI control layer (explicitly out of scope).
- No availability_cache / calendar UI (not part of `company_profile`).
