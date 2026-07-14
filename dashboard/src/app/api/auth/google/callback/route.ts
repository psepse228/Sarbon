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
