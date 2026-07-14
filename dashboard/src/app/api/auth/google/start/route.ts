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
