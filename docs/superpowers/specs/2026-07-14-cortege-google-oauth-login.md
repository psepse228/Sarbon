# Cortège Google OAuth Login & Self-Serve Tenant Registration — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Replace Telegram-based owner login (both the web Login Widget → session-cookie path, and the Telegram Mini App → `initData` header path) with Google OAuth. A brand-new Google account logging in for the first time gets a brand-new tenant automatically — no Solura involvement needed. Confirmed with the owner: this fully replaces both existing Telegram auth paths (no Mini App fallback kept), and the current pilot tenant simply re-registers fresh via Google (its old `tenant_id`/data stays orphaned under the old Telegram-based identity — acceptable, this is a low-stakes pilot).

## Current state (confirmed via code read, not assumption)

- `dashboard/src/lib/telegram/auth.ts`'s `authenticateOwner()` is a 3-tier chain: `DEV_BYPASS_INIT_DATA` → session cookie (`cortege_session`, HMAC-signed via `dashboard/src/lib/session.ts`) → Mini App `Authorization: tma <initData>` header (validated in `dashboard/src/lib/telegram/initData.ts`). All three tiers end by calling `resolveTenantId(telegramUserId)`, which does a **synchronous env-var read** of `TELEGRAM_OWNER_TENANT_MAP` (a JSON `{telegram_user_id: tenant_id}` map) — no database call, no real `tenant_owners` table.
- `tenants` table (`supabase/migrations/0001_init_schema.sql`) exists but has **no owner-identity column** — only `telegram_bot_token` (used by the guest-facing bot's *own* tenant resolution in `backend/app/tenant.py`, a completely separate mechanism this change does not touch).
- `company_profile` has no unique constraint on `tenant_id` — `dashboard/src/lib/companyProfile.ts`'s `upsertColumns` already does select-then-insert-or-update and gracefully returns an empty shaped profile when no row exists yet. **No change needed there**: a freshly-created tenant with no `company_profile` row yet already renders correctly.
- No backend endpoint creates tenants today; tenant rows are created manually in Supabase.
- The dashboard is dual-mode: reachable as a public PWA/website (session cookie) and inside Telegram as a Mini App (`initData`). This change collapses it to **session-cookie-only** — there is no more Mini App owner-auth path, so `dashboard/src/lib/telegram/initData.ts` and `dashboard/src/lib/telegram/loginWidget.ts` become dead code.
- `tmaFetch` (`dashboard/src/lib/telegram/client.ts`) currently attaches an `Authorization: tma <initData>` header when running inside the Telegram webview. Since the server will no longer look at that header, this branch becomes dead and is removed; `tmaFetch` becomes a thin fetch wrapper (kept under its existing name/path to avoid touching the ~15+ call sites across the dashboard that already import it — a pure rename would add risk for zero behavioral benefit).

## A. Database: `tenants.owner_email`

```sql
alter table tenants add column if not exists owner_email text unique;
```

One nullable-until-set, unique column. Unique so two Google accounts never collide onto the same tenant, and so a race between two simultaneous first-logins for the same brand-new email is caught by Postgres rather than silently creating two tenants (see race handling in section B).

## B. `resolveOrCreateTenantByEmail` (replaces `resolveTenantId`)

Lives in the same file (`dashboard/src/lib/telegram/auth.ts` — kept at this path despite the folder being named `telegram/`, since renaming it means touching ~15 importers for zero functional gain; a comment notes the path is legacy). Async (does a real Supabase call), unlike the old synchronous env-var read — but this only runs **once, at login time** (inside the OAuth callback route), never on the per-request `authenticateOwner()` hot path, which stays a pure synchronous cookie-verify with zero DB calls (an improvement over today, where the Mini App tier did a synchronous env-var parse on every single request — this is now zero work per request instead).

```ts
async function resolveOrCreateTenantByEmail(email: string, name: string | null): Promise<string> {
  const client = getServiceSupabaseClient();

  const { data: existing, error: selectError } = await client
    .from("tenants")
    .select("id")
    .eq("owner_email", email)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (selectError) throw new AuthError(`Failed to look up tenant: ${selectError.message}`, 500);
  if (existing) return existing.id;

  const { data: created, error: insertError } = await client
    .from("tenants")
    .insert({ name: name?.trim() || email, owner_email: email })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    // Unique-violation race: someone else's concurrent first-login for the
    // same brand-new email won the insert between our select and insert.
    // Postgres error code 23505 = unique_violation.
    if (insertError.code === "23505") {
      const { data: raceWinner, error: retryError } = await client
        .from("tenants")
        .select("id")
        .eq("owner_email", email)
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (raceWinner) return raceWinner.id;
      throw new AuthError(`Failed to create tenant: ${retryError?.message ?? "unknown race error"}`, 500);
    }
    throw new AuthError(`Failed to create tenant: ${insertError.message}`, 500);
  }
  return created.id;
}
```

`AuthenticatedOwner` changes from `{ telegramUserId, tenantId }` to `{ email, tenantId }`. `SessionPayload` (`dashboard/src/lib/session.ts`) gets the same field rename. `authenticateOwner()` collapses to a single tier:

```ts
export function authenticateOwner(request: Request): AuthenticatedOwner {
  const owner = tryAuthenticateFromSession(request);
  if (!owner) throw new AuthError("Not authenticated", 401);
  return owner;
}
```

## C. OAuth flow — hand-rolled Authorization Code flow, no new npm dependency

This codebase already hand-rolls HMAC session signing (`session.ts`) and Telegram HMAC validation (`initData.ts`, being deleted) rather than reaching for a library — the same style applies here. No `next-auth`/`jose`/`google-auth-library` dependency is added. Two new routes:

**`GET /api/auth/google/start`**
- Local-dev-only escape hatch: if `DEV_BYPASS_EMAIL` is set (replaces `DEV_BYPASS_INIT_DATA`), skip the entire Google round-trip — call `resolveOrCreateTenantByEmail(devBypassEmail, null)` directly, mint a session cookie, redirect to `/`. Never set in a deployed environment (same convention as the env var it replaces).
- Otherwise: requires `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_REDIRECT_URI` (500 if missing). Generates a random `state` (32 bytes, `crypto.randomBytes(...).toString("hex")`), sets it in a short-lived (5 min) HttpOnly cookie scoped to `path=/api/auth/google`, then 302-redirects to `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile`, `state`, `access_type=online`, `prompt=select_account`.

**`GET /api/auth/google/callback`**
- Reads the `state` query param and the `google_oauth_state` cookie (via `next/headers`'s `cookies()`); clears the cookie regardless of outcome. If either is missing or they don't match, redirect to `/login?error=state` — this is the CSRF defense (an attacker cannot forge a callback hit without first getting their own state value accepted into the victim's cookie jar).
- Exchanges `code` for tokens: `POST https://oauth2.googleapis.com/token` with `client_id`, `client_secret` (`GOOGLE_OAUTH_CLIENT_SECRET`, server-only env var, never sent to the browser), `code`, `redirect_uri`, `grant_type=authorization_code`. On any non-2xx or network failure, redirect to `/login?error=token` — never let a raw exception escape to a 500 in a route the user's browser is mid-redirect through.
- Calls `GET https://www.googleapis.com/oauth2/v3/userinfo` with `Authorization: Bearer <access_token>` to get `{ email, email_verified, name, sub }`. This is a live, TLS-authenticated call to Google's own server asking "who is this token for" — equivalent trust to verifying an `id_token`'s signature, without needing a JWT/JWKS verification library.
- **Requires `email_verified === true`** — an unverified Google email must not be allowed to claim/create a tenant. If false, redirect to `/login?error=unverified`.
- Calls `resolveOrCreateTenantByEmail(email, name)`.
- Mints a session token (`createSessionToken({ email, tenantId, exp: now + 30d }, sessionSecret)`), sets the same `cortege_session` cookie as before (`httpOnly, secure, sameSite: "lax", maxAge: 30 days, path: "/"`), redirects to `/`.
- No `next` / redirect-target query parameter is honored anywhere in this flow — the post-login redirect target is hardcoded to `/`, closing off any open-redirect vector through this endpoint.

**`/login` page** (`dashboard/src/app/(mobile)/login/page.tsx`, same route kept so every existing `/login` link keeps working): replaces the Telegram Login Widget script-injection with a single "Войти через Google" button (`<a href="/api/auth/google/start" className="btn btn-primary">`) plus copy explaining a first-time sign-in creates a new Cortège workspace. Reads `?error=` from the query string to show a friendly message for each of the callback's failure branches (`state`, `token`, `unverified`, generic `oauth`).

**`AuthGate.tsx`**: copy changes from "Войдите через Telegram" / "Войти через Telegram" to the Google equivalent; behavior (probe `/api/auth/me`, show login prompt if 401) is unchanged.

## D. Deleted / simplified

- `dashboard/src/app/api/auth/telegram-login/route.ts` — deleted, replaced by the two `google/*` routes.
- `dashboard/src/lib/telegram/initData.ts` + `dashboard/tests/initData.test.ts` + `dashboard/tests/helpers/signInitData.ts` — deleted (no more Mini App owner-auth tier to validate).
- `dashboard/src/lib/telegram/loginWidget.ts` + `dashboard/tests/loginWidget.test.ts` + `dashboard/tests/helpers/signLoginWidgetData.ts` — deleted (no more Login Widget).
- `dashboard/src/lib/telegram/client.ts`'s `tmaFetch` loses the `Authorization: tma` header branch (dead now that the server doesn't read it) but keeps its name/signature — every existing call site (`PackagesEditor`, `SkillsEditor`, `CalendarGrid`, every `d/*` page, etc.) needs zero changes.
- `dashboard/src/components/TelegramInit.tsx` / `initTelegramWebApp()` / `@twa-dev/sdk` dependency: **left untouched**. That code sizes the webview when the dashboard happens to be opened inside Telegram for any other reason (e.g. a bot deep-link) and is unrelated to owner authentication — removing it is out of scope for this change and not something either confirmed decision calls for.
- `dashboard/tests/auth.test.ts` — rewritten to cover `resolveOrCreateTenantByEmail` (new tenant created, existing tenant reused, race-condition retry path) and the collapsed single-tier `authenticateOwner` instead of the old 3-tier/env-var tests.
- `dashboard/tests/session.test.ts` — field rename only (`telegramUserId` → `email`), same 5 assertions.

## E. Env vars

New (`dashboard/.env.example`):
```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
# e.g. https://sarbon-khaki.vercel.app/api/auth/google/callback — must exactly
# match an "Authorized redirect URI" registered on the OAuth client in Google
# Cloud Console. Fixed via env var rather than derived from the request's Host
# header, since trusting an inbound Host header to pick the redirect_uri would
# let anyone who can spoof that header redirect the OAuth code exchange
# elsewhere.
DEV_BYPASS_EMAIL=
# Local dev only, never set in a deployed environment — replaces
# DEV_BYPASS_INIT_DATA.
```
Removed: `TELEGRAM_OWNER_TENANT_MAP`, `DEV_BYPASS_INIT_DATA`. `TELEGRAM_BOT_TOKEN` stays in `.env.example` (dashboard's `/api/test-chat`/broadcast internal-call plumbing doesn't need it directly, but leaving vs. removing it is a wash either way — leaving it since the backend still needs its own `TELEGRAM_BOT_TOKEN` and dashboard `.env.example` documents the whole deployment's env surface). Also adding the already-in-use-but-previously-undocumented `SESSION_SECRET` to `.env.example` (a pre-existing gap noted during research, unrelated to this feature but trivial to fix while touching this file).

## Explicitly out of scope for this pass

- Multiple owners per tenant / team invites — one Google account = one tenant, matching the existing one-owner-per-tenant assumption.
- Any migration/data-carry-over for the pilot tenant's existing `company_profile`/leads/etc. — confirmed with the owner: pilot just re-registers fresh.
- Removing `@twa-dev/sdk` or `TelegramInit.tsx` — unrelated to auth, not requested.
- Any change to the guest-facing bot's own tenant resolution (`backend/app/tenant.py`, bot-token-based) — entirely separate mechanism, untouched.
- PKCE — not needed for a confidential (server-side-secret-holding) OAuth client; the `state` param alone is the correct/sufficient CSRF defense here.

## Manual setup required from the owner (flag, don't block on)

A Google Cloud OAuth 2.0 Client ID (type: **Web application**) must be created in Google Cloud Console, with the deployed callback URL added to "Authorized redirect URIs" (e.g. `https://sarbon-khaki.vercel.app/api/auth/google/callback`). This is separate from the existing `GOOGLE_SERVICE_ACCOUNT_JSON` service account (that's for read-only Calendar API access; this is a completely different credential type, for user login). The resulting Client ID/Secret populate `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`. Code and tests in this plan work without it configured (dev bypass covers local testing), but real login won't function until this manual step is done — same pattern as the Calendar batch's `GOOGLE_SERVICE_ACCOUNT_JSON` flag.
