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
      const reselect = () =>
        client.from("tenants").select("id").eq("owner_email", email).limit(1).maybeSingle<{ id: string }>();

      let { data: raceWinner } = await reselect();
      if (!raceWinner) {
        // The winning insert may not have committed/become visible to our
        // connection yet — one short delayed retry before giving up.
        await new Promise((resolve) => setTimeout(resolve, 150));
        ({ data: raceWinner } = await reselect());
      }
      if (raceWinner) return raceWinner.id;
      throw new AuthError("Не удалось войти — попробуйте ещё раз.", 500);
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
