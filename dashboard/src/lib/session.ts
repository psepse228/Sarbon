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
