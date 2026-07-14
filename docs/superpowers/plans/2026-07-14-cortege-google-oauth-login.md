# Cortège Google OAuth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `docs/superpowers/specs/2026-07-14-cortege-google-oauth-login.md`: replace Telegram-based owner login (Login Widget + Mini App `initData`) with Google OAuth, with self-serve tenant creation on first login.

**Read before starting:** `docs/superpowers/specs/2026-07-14-cortege-google-oauth-login.md`.

**This plan touches authentication — treat every task's tests as load-bearing, not optional.** The final task runs a dedicated security-focused review (CSRF state validation, cookie flags, open-redirect, email-verification bypass, tenant-creation race) in addition to the usual code-quality pass.

**Note on test coverage:** `session.ts`, `auth.ts` (both fully unit-testable, no live network/DB), and the OAuth routes (mocked `fetch` for Google's endpoints, mocked Supabase client) all get full test coverage. The `/login` page's JSX (a static button + copy) gets no automated test, consistent with how other simple presentational pages in this codebase are handled — verified via `npm run build` plus a manual pass in the final task.

**Important — this plan touches a production secret the human must provide.** A Google Cloud OAuth 2.0 Client ID (Web application type) must be created and its redirect URI registered before real login works end-to-end. Code and tests work without it (the `DEV_BYPASS_EMAIL` escape hatch covers local dev/testing). Flag this to the user in the final task, don't block on it.

---

### Task 1: `tenants.owner_email` migration

**Files:**
- Create: `supabase/migrations/0010_add_tenant_owner_email.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0010_add_tenant_owner_email.sql
-- Links a tenant to the Google account that owns it. Unique so two Google
-- accounts can never collide onto the same tenant, and so a race between two
-- concurrent first-logins for the same brand-new email is caught by Postgres
-- (unique_violation, code 23505) rather than silently creating two tenants —
-- see dashboard/src/lib/telegram/auth.ts's resolveOrCreateTenantByEmail.

alter table tenants add column if not exists owner_email text unique;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0010_add_tenant_owner_email.sql
git commit -m "feat(db): add tenants.owner_email for Google-account tenant ownership"
```

---

### Task 2: `session.ts` field rename (`telegramUserId` → `email`)

**Files:**
- Modify: `dashboard/src/lib/session.ts`
- Modify: `dashboard/tests/session.test.ts`

- [ ] **Step 1: Rewrite `session.ts`**

Replace the whole file:

```ts
/**
 * Signed session tokens for the dashboard's Google-login flow, stored in an
 * HttpOnly cookie.
 *
 * Format: base64url(JSON payload) + "." + HMAC_SHA256(payload, SESSION_SECRET),
 * hex-encoded. Pure Node `crypto`, no framework dependency.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  email: string;
  tenantId: string;
  exp: number;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("hex");
}

export function createSessionToken(payload: SessionPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (typeof payload.email !== "string" || typeof payload.tenantId !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Update `session.test.ts`**

Replace every `telegramUserId: 111111111` with `email: "owner@example.com"` (5 occurrences: the round-trip test's `createSessionToken` call and its `toEqual` assertion, the wrong-secret test, the tampered-payload test's both `createSessionToken` call and the `tamperedPayload` object, and the expired-token test). The tampered-payload test's mismatch is what makes it a *tampered* payload — keep the tenantId the same and change only what makes the two payloads differ in a way that must still fail even with the field renamed:

```ts
import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/session";

const SECRET = "test-session-secret";

function futureExp(seconds = 3600): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: futureExp() },
      SECRET,
    );

    const payload = verifySessionToken(token, SECRET);

    expect(payload).toEqual({ email: "owner@example.com", tenantId: "tenant-1", exp: expect.any(Number) });
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: futureExp() },
      SECRET,
    );

    expect(verifySessionToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: futureExp() },
      SECRET,
    );
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: "attacker@example.com", tenantId: "tenant-1", exp: futureExp() }),
    ).toString("base64url");

    expect(verifySessionToken(`${tamperedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
    );

    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifySessionToken("not-a-real-token", SECRET)).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `cd dashboard && npm test -- --run tests/session.test.ts`
Expected: 5/5 pass. (This task alone leaves `auth.ts`/`telegram-login/route.ts` referencing the now-gone `telegramUserId` field — a type error is expected and fixed in Task 3, which rewrites both.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/session.ts dashboard/tests/session.test.ts
git commit -m "refactor(dashboard): rename session payload field telegramUserId to email"
```

---

### Task 3: Rewrite `auth.ts` — `resolveOrCreateTenantByEmail`, collapsed `authenticateOwner`

**Files:**
- Modify: `dashboard/src/lib/telegram/auth.ts`
- Modify: `dashboard/tests/auth.test.ts`
- Delete: `dashboard/tests/helpers/signInitData.ts` (only used by the old auth tests and `initData.test.ts`, both gone after this task/Task 5)

- [ ] **Step 1: Rewrite `auth.ts`**

Replace the whole file:

```ts
import "server-only";

import { getServiceSupabaseClient } from "../supabase/server";
import { verifySessionToken } from "../session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export interface AuthenticatedOwner {
  email: string;
  tenantId: string;
}

export const SESSION_COOKIE_NAME = "cortege_session";

/**
 * Looks up the tenant owned by this Google account's email, creating a new
 * tenant on first login (self-serve SaaS registration — no Solura
 * involvement needed for a new venue owner to get their own workspace).
 *
 * Only ever called at login time (the OAuth callback, or the DEV_BYPASS_EMAIL
 * shortcut) — never on the per-request authenticateOwner() hot path, which
 * stays a pure synchronous cookie-verify with zero DB calls.
 */
export async function resolveOrCreateTenantByEmail(email: string, name: string | null): Promise<string> {
  const client = getServiceSupabaseClient();

  const { data: existing, error: selectError } = await client
    .from("tenants")
    .select("id")
    .eq("owner_email", email)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (selectError) {
    throw new AuthError(`Failed to look up tenant: ${selectError.message}`, 500);
  }
  if (existing) return existing.id;

  const { data: created, error: insertError } = await client
    .from("tenants")
    .insert({ name: name?.trim() || email, owner_email: email })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    // Unique-violation race: another concurrent first-login for the same
    // brand-new email won the insert between our select and insert above.
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

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function tryAuthenticateFromSession(request: Request): AuthenticatedOwner | null {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const payload = verifySessionToken(token, secret);
  if (!payload) return null;
  return { email: payload.email, tenantId: payload.tenantId };
}

/**
 * Extracts and validates the caller's identity from an incoming API request
 * via the `cortege_session` cookie set by the Google OAuth login flow (see
 * /login and /api/auth/google/callback). This is the only path now — the
 * Telegram Login Widget and Mini App initData paths this dashboard used to
 * support have been fully replaced by Google login.
 */
export function authenticateOwner(request: Request): AuthenticatedOwner {
  const owner = tryAuthenticateFromSession(request);
  if (!owner) {
    throw new AuthError("Not authenticated", 401);
  }
  return owner;
}
```

- [ ] **Step 2: Rewrite `auth.test.ts`**

Replace the whole file:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, authenticateOwner, resolveOrCreateTenantByEmail, SESSION_COOKIE_NAME } from "@/lib/telegram/auth";
import { createSessionToken } from "@/lib/session";

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function makeRequestWithCookie(cookieValue: string | null): Request {
  const headers: Record<string, string> = {};
  if (cookieValue !== null) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;
  return new Request("http://localhost/api/company-profile", { headers });
}

describe("authenticateOwner", () => {
  beforeEach(() => {
    setEnv({ SESSION_SECRET: "test-session-secret" });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves the owner from a valid session cookie", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      "test-session-secret",
    );

    const result = authenticateOwner(makeRequestWithCookie(token));

    expect(result).toEqual({ email: "owner@example.com", tenantId: "tenant-1" });
  });

  it("throws 401 when there is no session cookie", () => {
    expect(() => authenticateOwner(makeRequestWithCookie(null))).toThrow(AuthError);
    try {
      authenticateOwner(makeRequestWithCookie(null));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(401);
    }
  });

  it("throws 401 when the session cookie is invalid", () => {
    expect(() => authenticateOwner(makeRequestWithCookie("not-a-real-token"))).toThrow(AuthError);
  });

  it("throws 401 when the session cookie is expired", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) - 10 },
      "test-session-secret",
    );

    expect(() => authenticateOwner(makeRequestWithCookie(token))).toThrow(AuthError);
  });

  it("throws 401 when SESSION_SECRET is not configured, even with an otherwise-valid cookie", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      "test-session-secret",
    );
    setEnv({ SESSION_SECRET: undefined });

    expect(() => authenticateOwner(makeRequestWithCookie(token))).toThrow(AuthError);
  });
});

describe("resolveOrCreateTenantByEmail", () => {
  function makeFakeClient(overrides: {
    selectResult?: { data: unknown; error: unknown };
    insertResult?: { data: unknown; error: unknown };
    raceSelectResult?: { data: unknown; error: unknown };
  }) {
    let selectCallCount = 0;
    const selectResults = [overrides.selectResult, overrides.raceSelectResult].filter(Boolean);
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              const result = selectResults[selectCallCount] ?? selectResults[selectResults.length - 1];
              selectCallCount += 1;
              return result;
            }),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => overrides.insertResult),
        })),
      })),
    }));
    return { from };
  }

  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the existing tenant id when the email is already registered", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      getServiceSupabaseClient: () => makeFakeClient({ selectResult: { data: { id: "tenant-existing" }, error: null } }),
    }));
    const { resolveOrCreateTenantByEmail: fn } = await import("@/lib/telegram/auth");

    const tenantId = await fn("owner@example.com", "Owner Name");

    expect(tenantId).toBe("tenant-existing");
  });

  it("creates a new tenant when the email has never logged in before", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      getServiceSupabaseClient: () =>
        makeFakeClient({
          selectResult: { data: null, error: null },
          insertResult: { data: { id: "tenant-new" }, error: null },
        }),
    }));
    const { resolveOrCreateTenantByEmail: fn } = await import("@/lib/telegram/auth");

    const tenantId = await fn("new-owner@example.com", "New Owner");

    expect(tenantId).toBe("tenant-new");
  });

  it("recovers via a re-select when a concurrent first-login wins the unique-violation race", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      getServiceSupabaseClient: () =>
        makeFakeClient({
          selectResult: { data: null, error: null },
          insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
          raceSelectResult: { data: { id: "tenant-race-winner" }, error: null },
        }),
    }));
    const { resolveOrCreateTenantByEmail: fn } = await import("@/lib/telegram/auth");

    const tenantId = await fn("racing-owner@example.com", null);

    expect(tenantId).toBe("tenant-race-winner");
  });
});
```

- [ ] **Step 3: Delete the now-orphaned initData test helper's Telegram-specific sibling isn't needed here**

No action — `signInitData.ts`/`initData.test.ts`/`loginWidget.ts`/`loginWidget.test.ts`/`signLoginWidgetData.ts` are deleted in Task 5 (kept as a separate task since they're a distinct, easily-reviewed deletion instead of bundled into this rewrite).

- [ ] **Step 4: Run the tests**

Run: `cd dashboard && npm test -- --run tests/auth.test.ts tests/session.test.ts`
Expected: all pass. (`api/auth/telegram-login/route.ts` and `api/auth/me/route.ts` still reference the old `resolveTenantId`/shape at this point for `telegram-login` — that file is deleted in Task 4, not fixed here; a build error here is expected and resolved by Task 4.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/telegram/auth.ts dashboard/tests/auth.test.ts
git commit -m "feat(dashboard): replace Telegram tenant resolution with Google-account tenant lookup/creation"
```

---

### Task 4: Google OAuth routes, replacing Telegram login

**Files:**
- Create: `dashboard/src/app/api/auth/google/start/route.ts`
- Create: `dashboard/src/app/api/auth/google/callback/route.ts`
- Delete: `dashboard/src/app/api/auth/telegram-login/route.ts`

- [ ] **Step 1: Delete the old login route**

```bash
git rm dashboard/src/app/api/auth/telegram-login/route.ts
```

- [ ] **Step 2: Create the start route**

`dashboard/src/app/api/auth/google/start/route.ts`:

```ts
import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { createSessionToken } from "@/lib/session";
import { resolveOrCreateTenantByEmail, SESSION_COOKIE_NAME } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const STATE_COOKIE_NAME = "google_oauth_state";
const STATE_MAX_AGE_SECONDS = 5 * 60;
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 3600;

async function devBypassResponse(request: Request, devBypassEmail: string): Promise<NextResponse> {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ error: "SESSION_SECRET is not configured on the server" }, { status: 500 });
  }
  const tenantId = await resolveOrCreateTenantByEmail(devBypassEmail, null);
  const token = createSessionToken(
    { email: devBypassEmail, tenantId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS },
    sessionSecret,
  );
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

/** Kicks off the Google OAuth Authorization Code flow. Local dev only:
 * DEV_BYPASS_EMAIL skips the entire Google round-trip — never set this in a
 * deployed environment. */
export async function GET(request: Request) {
  const devBypassEmail = process.env.DEV_BYPASS_EMAIL;
  if (devBypassEmail) {
    return devBypassResponse(request, devBypassEmail);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth is not configured on the server" }, { status: 500 });
  }

  const state = randomBytes(24).toString("hex");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: STATE_MAX_AGE_SECONDS,
    path: "/api/auth/google",
  });
  return response;
}
```

- [ ] **Step 3: Create the callback route**

`dashboard/src/app/api/auth/google/callback/route.ts`:

```ts
import { NextResponse } from "next/server";

import { createSessionToken } from "@/lib/session";
import { readCookie, resolveOrCreateTenantByEmail, SESSION_COOKIE_NAME } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const STATE_COOKIE_NAME = "google_oauth_state";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 3600;

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  name?: string;
}

function errorRedirect(request: Request, reason: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
  response.cookies.delete(STATE_COOKIE_NAME);
  return response;
}

/**
 * Google's OAuth redirect target. No `next`/redirect-target query param is
 * ever honored here — the post-login destination is always "/", closing off
 * any open-redirect vector through this endpoint.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = readCookie(request, STATE_COOKIE_NAME);

  if (!code || !state || !cookieState || state !== cookieState) {
    return errorRedirect(request, "state");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !sessionSecret) {
    return errorRedirect(request, "config");
  }

  let accessToken: string;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenBody = (await tokenResponse.json()) as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokenBody.access_token) {
      return errorRedirect(request, "token");
    }
    accessToken = tokenBody.access_token;
  } catch {
    return errorRedirect(request, "token");
  }

  let userInfo: GoogleUserInfo;
  try {
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoResponse.ok) {
      return errorRedirect(request, "userinfo");
    }
    userInfo = (await userInfoResponse.json()) as GoogleUserInfo;
  } catch {
    return errorRedirect(request, "userinfo");
  }

  if (!userInfo.email || !userInfo.email_verified) {
    return errorRedirect(request, "unverified");
  }

  let tenantId: string;
  try {
    tenantId = await resolveOrCreateTenantByEmail(userInfo.email, userInfo.name ?? null);
  } catch {
    return errorRedirect(request, "tenant");
  }

  const token = createSessionToken(
    { email: userInfo.email, tenantId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS },
    sessionSecret,
  );

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(STATE_COOKIE_NAME);
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds. (`/api/auth/me/route.ts` already only destructures `{ tenantId }` from `authenticateOwner()`'s result — no change needed there.)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/auth/google
git commit -m "feat(dashboard): add Google OAuth login routes, remove Telegram login route"
```

---

### Task 5: Delete dead Telegram-auth code (initData, loginWidget)

**Files:**
- Delete: `dashboard/src/lib/telegram/initData.ts`
- Delete: `dashboard/src/lib/telegram/loginWidget.ts`
- Delete: `dashboard/tests/initData.test.ts`
- Delete: `dashboard/tests/loginWidget.test.ts`
- Delete: `dashboard/tests/helpers/signInitData.ts`
- Delete: `dashboard/tests/helpers/signLoginWidgetData.ts`

- [ ] **Step 1: Confirm nothing still imports these before deleting**

Run: `cd dashboard && grep -rln "telegram/initData\|telegram/loginWidget" src tests`
Expected: no output (Task 3/4 already removed the only real importers — `auth.ts` and `telegram-login/route.ts`). If anything unexpected still matches, stop and re-check before deleting — do not delete a file something still depends on.

- [ ] **Step 2: Delete**

```bash
git rm dashboard/src/lib/telegram/initData.ts dashboard/src/lib/telegram/loginWidget.ts dashboard/tests/initData.test.ts dashboard/tests/loginWidget.test.ts dashboard/tests/helpers/signInitData.ts dashboard/tests/helpers/signLoginWidgetData.ts
```

- [ ] **Step 3: Verify build and full test suite**

Run: `cd dashboard && npm run build && npm test -- --run`
Expected: build succeeds, all remaining tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(dashboard): remove dead Telegram initData/loginWidget validation code"
```

---

### Task 6: Simplify `tmaFetch`, update `/login` page and `AuthGate` copy

**Files:**
- Modify: `dashboard/src/lib/telegram/client.ts`
- Modify: `dashboard/src/app/(mobile)/login/page.tsx`
- Modify: `dashboard/src/components/AuthGate.tsx`

- [ ] **Step 1: Simplify `tmaFetch`**

In `dashboard/src/lib/telegram/client.ts`, replace the `tmaFetch` function (keep `loadWebApp`/`initTelegramWebApp` above it untouched — those size the webview when opened inside Telegram for unrelated reasons and are out of scope here):

```ts
/**
 * `fetch` wrapper used by every dashboard API call. The dashboard now
 * authenticates purely via the `cortege_session` cookie (Google login, see
 * src/lib/telegram/auth.ts) — this wrapper no longer attaches any Telegram
 * initData header, but keeps its name/call signature since ~20 call sites
 * across the dashboard already depend on it.
 */
export async function tmaFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}
```

- [ ] **Step 2: Rewrite the login page**

Replace the whole file `dashboard/src/app/(mobile)/login/page.tsx`:

```tsx
const ERROR_MESSAGES: Record<string, string> = {
  state: "Сессия входа истекла или недействительна. Попробуйте снова.",
  token: "Не удалось подтвердить вход через Google. Попробуйте снова.",
  userinfo: "Не удалось получить данные аккаунта Google. Попробуйте снова.",
  unverified: "Email в вашем Google-аккаунте не подтверждён.",
  tenant: "Не удалось найти или создать рабочее пространство. Попробуйте снова.",
  config: "Вход через Google временно недоступен. Попробуйте позже.",
  oauth: "Не удалось войти через Google. Попробуйте снова.",
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.oauth : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "5rem", gap: "0.75rem" }}>
      <h1>Вход в Cortège</h1>
      <p className="muted" style={{ textAlign: "center", maxWidth: 320 }}>
        Войдите через Google, чтобы открыть панель владельца. Если вы входите впервые, для вас автоматически
        создастся новое рабочее пространство.
      </p>
      {errorMessage && <p style={{ color: "var(--color-danger)" }}>{errorMessage}</p>}
      <a href="/api/auth/google/start" className="btn btn-primary" style={{ marginTop: "1.5rem" }}>
        Войти через Google
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Update `AuthGate.tsx` copy**

In `dashboard/src/components/AuthGate.tsx`, find:

```tsx
        <p className="muted" style={{ textAlign: "center", maxWidth: 280 }}>
          Откройте панель через Telegram, чтобы продолжить.
        </p>
        <Link href="/login" className="btn btn-primary">
          Войти через Telegram
        </Link>
```

Replace with:

```tsx
        <p className="muted" style={{ textAlign: "center", maxWidth: 280 }}>
          Войдите через Google, чтобы продолжить.
        </p>
        <Link href="/login" className="btn btn-primary">
          Войти через Google
        </Link>
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/telegram/client.ts "dashboard/src/app/(mobile)/login/page.tsx" dashboard/src/components/AuthGate.tsx
git commit -m "feat(dashboard): switch login page and AuthGate copy to Google login"
```

---

### Task 7: Env vars and docs

**Files:**
- Modify: `dashboard/.env.example`
- Modify: `dashboard/README.md`

- [ ] **Step 1: Update `.env.example`**

Replace the Telegram-owner-map and dev-bypass blocks:

```
# --- Telegram bot, used by the guest-facing bot's own tenant resolution ---
TELEGRAM_BOT_TOKEN=

# --- Google OAuth (owner login) ---
# Create an OAuth 2.0 Client ID (type: Web application) in Google Cloud
# Console, and add GOOGLE_OAUTH_REDIRECT_URI to its "Authorized redirect
# URIs". This is a different credential type from GOOGLE_SERVICE_ACCOUNT_JSON
# (backend/.env, used for read-only Calendar sync) — that's a service
# account, this is an OAuth client for user login.
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
# e.g. https://sarbon-khaki.vercel.app/api/auth/google/callback

# --- Session cookie signing (also used by the Google login callback) ---
SESSION_SECRET=

# --- Local dev only: skips the Google OAuth round-trip entirely. ---
# Never set this in a deployed environment. See src/lib/telegram/auth.ts.
DEV_BYPASS_EMAIL=

# --- Internal call to the FastAPI backend's /internal/test-chat (desktop Test Console only) ---
BACKEND_URL=
INTERNAL_API_SECRET=
```

Remove the old `TELEGRAM_OWNER_TENANT_MAP` and `DEV_BYPASS_INIT_DATA` blocks entirely (superseded above). Keep the `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` block at the top unchanged.

- [ ] **Step 2: Update `README.md`**

Find the "Open questions" section's entry about `TELEGRAM_OWNER_TENANT_MAP` (owner-to-tenant mapping) and any description of the Telegram Login Widget / Mini App initData login flow. Replace with a short paragraph describing the Google OAuth flow instead: owner logs in via `/login` → Google OAuth → `/api/auth/google/callback` creates or looks up a tenant by the Google account's email (`tenants.owner_email`) → session cookie. Remove the "Open question" framing entirely for this — it's no longer an open question, it's now implemented. (Read the file first to make a surgical edit rather than guessing exact surrounding text — do not rewrite unrelated sections.)

- [ ] **Step 3: Commit**

```bash
git add dashboard/.env.example dashboard/README.md
git commit -m "docs(dashboard): document Google OAuth login env vars, remove stale Telegram-login docs"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd dashboard && npm run build && npm test -- --run`
Expected: build succeeds, all tests pass.

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all tests pass (this plan makes no backend changes, so this is a regression check only).

- [ ] **Step 2: Confirm no remaining references to removed symbols**

Run: `cd dashboard && grep -rln "TELEGRAM_OWNER_TENANT_MAP\|DEV_BYPASS_INIT_DATA\|resolveTenantId\b\|telegramUserId" src tests`
Expected: no output. If anything remains, it's a missed spot from an earlier task — fix it there rather than patching around it here.

- [ ] **Step 3: Manual/browser verification**

Run `cd dashboard && npm run dev`. Set `DEV_BYPASS_EMAIL=owner@example.com` and `SESSION_SECRET=dev-secret` in `.env.local` (this worktree likely has no real Supabase credentials either — note that explicitly and verify what's checkable: at minimum, hitting `/login` should render the Google button with no console errors, and `/api/auth/google/start` without `DEV_BYPASS_EMAIL` set should redirect toward `accounts.google.com` with the expected query params (client_id/redirect_uri may be empty/missing in this environment — that's expected, not a bug, since no real Google Cloud OAuth client exists yet)).

- [ ] **Step 4: Report**

Summarize what was verified vs. what could only be confirmed via build/tests/code inspection. Flag explicitly, for the human: **a Google Cloud OAuth 2.0 Client ID (Web application type) must be created, with the deployed callback URL registered as an Authorized redirect URI, before real Google login works** — `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`/`GOOGLE_OAUTH_REDIRECT_URI` need to be set in the real deployment environment. Also flag: **the current pilot tenant's owner must log in via Google at least once to get a (new) tenant** — their old Telegram-based session/identity no longer works at all, by design (confirmed with the owner).
