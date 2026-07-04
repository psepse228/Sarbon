import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { createSessionToken } from "@/lib/session";
import { AuthError, resolveTenantId, SESSION_COOKIE_NAME } from "@/lib/telegram/auth";
import { LoginWidgetValidationError, validateLoginWidgetData } from "@/lib/telegram/loginWidget";

export const runtime = "nodejs";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 3600;

/** Receives the Telegram Login Widget's callback payload, verifies it, and
 * sets a signed session cookie — the PWA/browser counterpart to the Mini
 * App's initData header flow. */
export async function POST(request: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new AuthError("TELEGRAM_BOT_TOKEN is not configured on the server", 500);
    }
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      throw new AuthError("SESSION_SECRET is not configured on the server", 500);
    }

    const body = await request.json();
    let validated;
    try {
      validated = validateLoginWidgetData(body, botToken);
    } catch (err) {
      if (err instanceof LoginWidgetValidationError) {
        throw new AuthError(err.message, 401);
      }
      throw err;
    }
    const tenantId = resolveTenantId(validated.id);

    const token = createSessionToken(
      {
        telegramUserId: validated.id,
        tenantId,
        exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
      },
      sessionSecret,
    );

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  } catch (err) {
    return toErrorResponse(err);
  }
}
