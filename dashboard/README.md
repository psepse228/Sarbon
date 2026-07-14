# Sarbon Dashboard — Owner-Facing Telegram Mini App

Next.js 14 (App Router, TypeScript) app implementing the "Dashboard" layer from
`WEDDING-BOT-CONTEXT.md`: an owner-facing dashboard authenticated via Google
OAuth login, reading/writing Supabase directly from server-side API routes.

**Scope of this slice:** multi-tenant CRUD for `company_profile` — `packages`,
`faq`, `partners` (jsonb columns) and `policies` (text column). The AI
control-layer / conversations-viewer is out of scope here (comes later).

## Running locally

```bash
cd dashboard
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev                  # http://localhost:3000
npm test                     # vitest — session token signing + Google-account tenant resolution
npm run build                # production build
npm run lint
```

### Env vars (`.env.local`, never committed)

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Same Supabase project as `backend/` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service-role** key. Server-only — used exclusively inside `src/app/api/**` route handlers and `src/lib/supabase/server.ts`, both guarded by the `server-only` import so an accidental client-bundle import fails the build. Never set as `NEXT_PUBLIC_*`. |
| `TELEGRAM_BOT_TOKEN` | Same bot token as `backend/.env` — used only by the guest-facing bot's own tenant resolution now; the dashboard itself no longer touches Telegram for owner auth. |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` | Owner login. Create an OAuth 2.0 Client ID (type: **Web application**) in Google Cloud Console, add the deployed callback URL to its "Authorized redirect URIs". A different credential type from `GOOGLE_SERVICE_ACCOUNT_JSON` (backend, Calendar sync) — that's a service account, this is a user-login OAuth client. |
| `DEV_BYPASS_EMAIL` | Local dev only. Set to any email to skip the entire Google OAuth round-trip and log in directly (creating a tenant for that email if one doesn't exist). **Never set in a deployed environment.** |
| `SESSION_SECRET` | Random 32+ byte secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) signing the session cookie set by `/api/auth/google/callback`. |

### Owner login (Google OAuth)

The owner logs in via `/login` → "Войти через Google" → Google's OAuth
Authorization Code flow → `/api/auth/google/callback`, which looks up (or, on
first login, creates) the tenant owned by that Google account's email
(`tenants.owner_email`) and sets a signed session cookie
(`src/lib/session.ts`). A brand-new Google account gets a brand-new tenant
automatically — no Solura involvement needed for a new venue owner to sign
up. `authenticateOwner()` (`src/lib/telegram/auth.ts`) is now a single-tier
check of that session cookie; there is no more Telegram-based owner-auth path
(Login Widget or Mini App `initData`) — those were fully replaced.

To run the dashboard locally without a real Google Cloud OAuth client:

```
DEV_BYPASS_EMAIL=owner@example.com
SESSION_SECRET=<any random string>
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
        auth.ts                # authenticateOwner(): session cookie -> {email, tenantId}; resolveOrCreateTenantByEmail()
        client.ts              # browser-only @twa-dev/sdk wrapper (webview sizing) + tmaFetch()
      supabase/
        server.ts              # service-role client, server-only
  tests/
    auth.test.ts               # session-cookie auth + tenant lookup/creation (incl. race-condition retry)
    session.test.ts            # session token sign/verify round-trip
    mocks/server-only.ts       # vitest alias target (see below)
```

## How auth works

1. Owner visits `/login` and clicks "Войти через Google", hitting
   `/api/auth/google/start`, which redirects to Google's OAuth Authorization
   Code flow with a random CSRF `state` value stashed in a short-lived
   HttpOnly cookie.
2. Google redirects back to `/api/auth/google/callback`, which validates
   `state`, exchanges the `code` for an access token, and calls Google's
   `userinfo` endpoint to get `{ email, email_verified, name }`. An
   unverified email is rejected.
3. `resolveOrCreateTenantByEmail()` (`src/lib/telegram/auth.ts`) looks up the
   tenant owned by that email (`tenants.owner_email`), creating one on first
   login. A signed session cookie (`src/lib/session.ts`) is set with
   `{ email, tenantId }`.
4. Every subsequent API call's `authenticateOwner()` is a pure, synchronous
   verify of that cookie — no DB call on the per-request hot path, only at
   login time.

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

1. **Single owner vs. multiple owners per tenant.** One Google account = one
   tenant today (`tenants.owner_email` is unique). Team invites / multiple
   owners per tenant are out of scope for now — confirm if/when that's
   needed.
2. **jsonb array `id` fields leaking into function-calling responses** — see
   above, low-stakes but worth a decision from whoever owns `backend/`.
3. **Deployment** — a Vercel project exists (`sarbon`, see `.vercel/project.json`)
   but needs the Google OAuth env vars (`GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`/
   `_REDIRECT_URI`) set for real login to work, plus a real Google Cloud OAuth
   2.0 Client ID (Web application type) with that redirect URI registered.
   No `DEV_BYPASS_EMAIL` in that environment — it fully bypasses auth.
4. **RLS on `company_profile`.** This dashboard only ever talks to Supabase
   via the service-role key from trusted server code, so table-level RLS
   policies aren't load-bearing for *this* app's security — tenant isolation
   is enforced entirely by `authenticateOwner()` + the `.eq("tenant_id", …)`
   filter in `src/lib/companyProfile.ts`. Worth confirming that's
   acceptable long-term (vs. also adding RLS as defense-in-depth once
   `backend/`'s Supabase access patterns are settled).

## What's NOT done in this slice

- No RLS policies added (see open question 4).
- No team invites / multiple owners per tenant.
- No direct photo upload (Supabase Storage) — Catalog uses photo URLs only.
