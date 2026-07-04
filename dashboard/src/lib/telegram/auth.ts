import "server-only";

import { InitDataValidationError, validateInitData } from "./initData";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export interface AuthenticatedOwner {
  telegramUserId: number;
  tenantId: string;
}

/**
 * PILOT STOPGAP — see dashboard/README.md "Open questions" section.
 *
 * The `tenants` table (supabase/migrations/0001_init_schema.sql) has no
 * column linking a Telegram owner's user id to a tenant. Rather than invent
 * a migration for that unilaterally, this resolves the mapping from an env
 * var (`TELEGRAM_OWNER_TENANT_MAP`, a JSON object of
 * `{ "<telegram_user_id>": "<tenant_id>" }`).
 *
 * This keeps the dashboard multi-tenant-shaped (every query still filters by
 * the resolved `tenant_id`, never a hardcoded one) without inventing schema.
 * Swap this function's body for a real `tenant_owners` (or similar) table
 * lookup once that schema question is answered — nothing else in the
 * dashboard needs to change.
 */
function resolveTenantId(telegramUserId: number): string {
  const raw = process.env.TELEGRAM_OWNER_TENANT_MAP;
  if (!raw) {
    throw new AuthError(
      "TELEGRAM_OWNER_TENANT_MAP is not configured on the server",
      500,
    );
  }

  let map: Record<string, string>;
  try {
    map = JSON.parse(raw);
  } catch {
    throw new AuthError("TELEGRAM_OWNER_TENANT_MAP is not valid JSON", 500);
  }

  const tenantId = map[String(telegramUserId)];
  if (!tenantId) {
    throw new AuthError(
      `Telegram user ${telegramUserId} is not registered as an owner of any tenant`,
      403,
    );
  }
  return tenantId;
}

/**
 * Extracts and validates the caller's identity from an incoming API request.
 *
 * Expects the client to send raw Telegram `initData` in an
 * `Authorization: tma <initData>` header — the scheme Telegram's own docs
 * recommend for Mini Apps talking to a backend
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 *
 * `DEV_BYPASS_INIT_DATA` (local dev only, never set in a deployed env) lets
 * you exercise the dashboard from a plain browser outside the Telegram
 * webview, since initData can only be produced by a real Telegram client.
 */
export function authenticateOwner(request: Request): AuthenticatedOwner {
  const devBypass = process.env.DEV_BYPASS_INIT_DATA;
  if (devBypass) {
    const telegramUserId = Number.parseInt(devBypass, 10);
    if (!Number.isFinite(telegramUserId)) {
      throw new AuthError("DEV_BYPASS_INIT_DATA must be a numeric Telegram user id", 500);
    }
    return { telegramUserId, tenantId: resolveTenantId(telegramUserId) };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, initDataRaw] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "tma" || !initDataRaw) {
    throw new AuthError("Missing or malformed 'Authorization: tma <initData>' header");
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new AuthError("TELEGRAM_BOT_TOKEN is not configured on the server", 500);
  }

  try {
    const validated = validateInitData(initDataRaw, botToken);
    const telegramUserId = validated.user.id;
    return { telegramUserId, tenantId: resolveTenantId(telegramUserId) };
  } catch (err) {
    if (err instanceof InitDataValidationError) {
      throw new AuthError(err.message, 401);
    }
    throw err;
  }
}
