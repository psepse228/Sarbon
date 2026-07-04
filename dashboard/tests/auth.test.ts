import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthError, authenticateOwner } from "@/lib/telegram/auth";
import { signInitData } from "./helpers/signInitData";

const BOT_TOKEN = "123456:TEST-bot-token-for-unit-tests";
const TENANT_ID = "005ece7a-2af4-4f22-84f7-25d5e743af9e";
const OWNER_TELEGRAM_ID = 111111111;

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/company-profile", { headers });
}

describe("authenticateOwner", () => {
  beforeEach(() => {
    setEnv({
      TELEGRAM_BOT_TOKEN: BOT_TOKEN,
      TELEGRAM_OWNER_TENANT_MAP: JSON.stringify({ [OWNER_TELEGRAM_ID]: TENANT_ID }),
      DEV_BYPASS_INIT_DATA: undefined,
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves the tenant for a validly signed Authorization header", () => {
    const initData = signInitData(
      {
        user: JSON.stringify({ id: OWNER_TELEGRAM_ID }),
        auth_date: String(Math.floor(Date.now() / 1000)),
      },
      BOT_TOKEN,
    );

    const result = authenticateOwner(makeRequest({ Authorization: `tma ${initData}` }));

    expect(result).toEqual({ telegramUserId: OWNER_TELEGRAM_ID, tenantId: TENANT_ID });
  });

  it("throws 401 when the Authorization header is missing", () => {
    expect(() => authenticateOwner(makeRequest())).toThrow(AuthError);
    try {
      authenticateOwner(makeRequest());
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(401);
    }
  });

  it("throws 401 when the Authorization scheme is not 'tma'", () => {
    expect(() => authenticateOwner(makeRequest({ Authorization: "Bearer some-token" }))).toThrow(AuthError);
  });

  it("throws 401 when initData hash is invalid", () => {
    const initData = signInitData(
      { user: JSON.stringify({ id: OWNER_TELEGRAM_ID }), auth_date: String(Math.floor(Date.now() / 1000)) },
      "wrong-token",
    );

    try {
      authenticateOwner(makeRequest({ Authorization: `tma ${initData}` }));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(401);
    }
  });

  it("throws 403 when the Telegram user is not a mapped tenant owner", () => {
    const unmappedUserId = 222222222;
    const initData = signInitData(
      { user: JSON.stringify({ id: unmappedUserId }), auth_date: String(Math.floor(Date.now() / 1000)) },
      BOT_TOKEN,
    );

    try {
      authenticateOwner(makeRequest({ Authorization: `tma ${initData}` }));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(403);
    }
  });

  it("throws 500 when TELEGRAM_OWNER_TENANT_MAP is not configured", () => {
    setEnv({ TELEGRAM_OWNER_TENANT_MAP: undefined });
    const initData = signInitData(
      { user: JSON.stringify({ id: OWNER_TELEGRAM_ID }), auth_date: String(Math.floor(Date.now() / 1000)) },
      BOT_TOKEN,
    );

    try {
      authenticateOwner(makeRequest({ Authorization: `tma ${initData}` }));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(500);
    }
  });

  it("uses DEV_BYPASS_INIT_DATA as the Telegram user id when set, ignoring headers", () => {
    setEnv({ DEV_BYPASS_INIT_DATA: String(OWNER_TELEGRAM_ID) });

    const result = authenticateOwner(makeRequest());

    expect(result).toEqual({ telegramUserId: OWNER_TELEGRAM_ID, tenantId: TENANT_ID });
  });
});
