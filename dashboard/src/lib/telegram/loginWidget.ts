/**
 * Server-side validation of the Telegram Login Widget callback payload.
 *
 * Algorithm per https://core.telegram.org/widgets/login#checking-authorization :
 *   1. Build a "data-check-string": all fields except `hash`, sorted by key,
 *      joined as "key=value" with "\n".
 *   2. secret_key = SHA256(bot_token)  — NOT the HMAC("WebAppData", ...)
 *      construction Mini App initData uses; the Login Widget spec is
 *      deliberately different.
 *   3. computed_hash = HEX( HMAC_SHA256(data: data-check-string, key: secret_key) )
 *   4. Compare computed_hash to the provided hash (constant-time).
 *   5. Reject if `auth_date` is older than maxAgeSeconds (replay protection).
 *
 * Pure Node `crypto`, no Next.js dependency, so it's unit-testable directly.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramLoginData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export class LoginWidgetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginWidgetValidationError";
  }
}

function buildDataCheckString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter((key) => key !== "hash" && data[key] !== undefined && data[key] !== null)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");
}

function computeHash(dataCheckString: string, botToken: string): string {
  const secretKey = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function constantTimeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validates a Telegram Login Widget callback payload.
 *
 * @param data the JSON object passed to the widget's `data-onauth` callback
 *   (id, first_name, ..., auth_date, hash).
 * @param botToken the tenant's bot token.
 * @param maxAgeSeconds reject payloads whose `auth_date` is older than this
 *   many seconds. Defaults to 24h.
 */
export function validateLoginWidgetData(
  data: Record<string, unknown>,
  botToken: string,
  maxAgeSeconds = 86_400,
): TelegramLoginData {
  if (!botToken) {
    throw new LoginWidgetValidationError("bot token is not configured");
  }
  const hash = data.hash;
  if (typeof hash !== "string" || !hash) {
    throw new LoginWidgetValidationError("payload is missing 'hash'");
  }
  if (typeof data.id !== "number") {
    throw new LoginWidgetValidationError("payload 'id' is missing or not a number");
  }
  if (typeof data.auth_date !== "number") {
    throw new LoginWidgetValidationError("payload 'auth_date' is missing or not a number");
  }

  const dataCheckString = buildDataCheckString(data);
  const expectedHash = computeHash(dataCheckString, botToken);
  if (!constantTimeHexEqual(hash, expectedHash)) {
    throw new LoginWidgetValidationError("hash mismatch (invalid or tampered)");
  }

  const ageSeconds = Date.now() / 1000 - data.auth_date;
  if (ageSeconds > maxAgeSeconds) {
    throw new LoginWidgetValidationError(`auth_date is stale (${Math.floor(ageSeconds)}s old)`);
  }
  if (ageSeconds < -60) {
    throw new LoginWidgetValidationError("auth_date is in the future");
  }

  return data as unknown as TelegramLoginData;
}
