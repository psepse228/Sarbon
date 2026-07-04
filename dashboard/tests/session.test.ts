import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/session";

const SECRET = "test-session-secret";

function futureExp(seconds = 3600): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

describe("session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken(
      { telegramUserId: 111111111, tenantId: "tenant-1", exp: futureExp() },
      SECRET,
    );

    const payload = verifySessionToken(token, SECRET);

    expect(payload).toEqual({ telegramUserId: 111111111, tenantId: "tenant-1", exp: expect.any(Number) });
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(
      { telegramUserId: 111111111, tenantId: "tenant-1", exp: futureExp() },
      SECRET,
    );

    expect(verifySessionToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken(
      { telegramUserId: 111111111, tenantId: "tenant-1", exp: futureExp() },
      SECRET,
    );
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ telegramUserId: 999999999, tenantId: "tenant-1", exp: futureExp() }),
    ).toString("base64url");

    expect(verifySessionToken(`${tamperedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(
      { telegramUserId: 111111111, tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) - 10 },
      SECRET,
    );

    expect(verifySessionToken(token, SECRET)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifySessionToken("not-a-real-token", SECRET)).toBeNull();
  });
});
