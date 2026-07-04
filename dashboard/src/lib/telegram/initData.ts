/**
 * Server-side validation of Telegram Mini App `initData`.
 *
 * Algorithm per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app :
 *   1. Parse initData as a query string; pull out `hash`, drop it from the set.
 *   2. Build a "data-check-string": remaining key=value pairs, sorted by key,
 *      joined with "\n".
 *   3. secret_key = HMAC_SHA256(data: botToken, key: "WebAppData")
 *   4. computed_hash = HEX( HMAC_SHA256(data: data-check-string, key: secret_key) )
 *   5. Compare computed_hash to the provided hash (constant-time).
 *   6. Reject if `auth_date` is older than maxAgeSeconds (replay protection).
 *
 * This module is pure Node `crypto` with no Next.js dependency so it can be
 * unit-tested directly (see dashboard/tests/initData.test.ts).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramInitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user: TelegramInitDataUser;
  authDate: number;
  raw: Record<string, string>;
}

export class InitDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitDataValidationError";
  }
}

const WEBAPP_DATA_KEY = "WebAppData";

function buildDataCheckString(params: URLSearchParams): string {
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  return pairs.join("\n");
}

function computeHash(dataCheckString: string, botToken: string): string {
  const secretKey = createHmac("sha256", WEBAPP_DATA_KEY).update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function constantTimeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validates a raw Telegram Mini App `initData` string.
 *
 * @param initDataRaw the raw query-string exactly as provided by
 *   `window.Telegram.WebApp.initData` on the client.
 * @param botToken the tenant's bot token (the same secret used to compute
 *   the hash on Telegram's side).
 * @param maxAgeSeconds reject initData whose `auth_date` is older than this
 *   many seconds (replay-attack mitigation). Defaults to 24h, matching
 *   Telegram's own guidance for Mini App session lifetime.
 */
export function validateInitData(
  initDataRaw: string,
  botToken: string,
  maxAgeSeconds = 86_400,
): ValidatedInitData {
  if (!initDataRaw) {
    throw new InitDataValidationError("initData is empty");
  }
  if (!botToken) {
    throw new InitDataValidationError("bot token is not configured");
  }

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) {
    throw new InitDataValidationError("initData is missing 'hash'");
  }

  const dataCheckString = buildDataCheckString(params);
  const expectedHash = computeHash(dataCheckString, botToken);

  if (!constantTimeHexEqual(hash, expectedHash)) {
    throw new InitDataValidationError("initData hash mismatch (invalid or tampered)");
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number.parseInt(authDateRaw, 10) : NaN;
  if (!Number.isFinite(authDate)) {
    throw new InitDataValidationError("initData is missing a valid 'auth_date'");
  }
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > maxAgeSeconds) {
    throw new InitDataValidationError(`initData is stale (${Math.floor(ageSeconds)}s old)`);
  }
  if (ageSeconds < -60) {
    // allow a small clock-skew window, but a large negative age means a
    // manufactured future timestamp
    throw new InitDataValidationError("initData auth_date is in the future");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new InitDataValidationError("initData is missing 'user'");
  }

  let user: TelegramInitDataUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new InitDataValidationError("initData 'user' field is not valid JSON");
  }
  if (typeof user?.id !== "number") {
    throw new InitDataValidationError("initData 'user.id' is missing or not a number");
  }

  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    raw[key] = value;
  }

  return { user, authDate, raw };
}
