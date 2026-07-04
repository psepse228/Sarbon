import { describe, expect, it } from "vitest";

import { InitDataValidationError, validateInitData } from "@/lib/telegram/initData";
import { signInitData as signInitDataWithToken } from "./helpers/signInitData";

const BOT_TOKEN = "123456:TEST-bot-token-for-unit-tests";

/**
 * Independently builds a signed initData string per Telegram's own spec
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app),
 * without importing the implementation under test — so these tests catch
 * real bugs in src/lib/telegram/initData.ts rather than just mirroring it.
 */
function signInitData(fields: Record<string, string>, botToken = BOT_TOKEN): string {
  return signInitDataWithToken(fields, botToken);
}

function validFields(overrides: Partial<Record<string, string>> = {}) {
  return {
    query_id: "AAEmy_test",
    user: JSON.stringify({ id: 111111111, first_name: "Владелец", username: "owner_tg" }),
    auth_date: String(Math.floor(Date.now() / 1000)),
    ...overrides,
  };
}

describe("validateInitData", () => {
  it("accepts a correctly signed initData and returns the parsed user", () => {
    const initData = signInitData(validFields());

    const result = validateInitData(initData, BOT_TOKEN);

    expect(result.user.id).toBe(111111111);
    expect(result.user.username).toBe("owner_tg");
  });

  it("rejects initData whose hash does not match (tampered field)", () => {
    const initData = signInitData(validFields());
    // Flip the user id after signing, without recomputing the hash.
    const tampered = initData.replace("111111111", "999999999");

    expect(() => validateInitData(tampered, BOT_TOKEN)).toThrow(InitDataValidationError);
    expect(() => validateInitData(tampered, BOT_TOKEN)).toThrow(/hash mismatch/i);
  });

  it("rejects initData signed with a different bot token", () => {
    const initData = signInitData(validFields(), "different:bot-token");

    expect(() => validateInitData(initData, BOT_TOKEN)).toThrow(/hash mismatch/i);
  });

  it("rejects initData with a missing hash param", () => {
    const params = new URLSearchParams(validFields());

    expect(() => validateInitData(params.toString(), BOT_TOKEN)).toThrow(/missing 'hash'/i);
  });

  it("rejects stale initData older than maxAgeSeconds", () => {
    const oldAuthDate = String(Math.floor(Date.now() / 1000) - 90_000); // > 24h
    const initData = signInitData(validFields({ auth_date: oldAuthDate }));

    expect(() => validateInitData(initData, BOT_TOKEN, 86_400)).toThrow(/stale/i);
  });

  it("accepts initData within a custom maxAgeSeconds window", () => {
    const authDate = String(Math.floor(Date.now() / 1000) - 30);
    const initData = signInitData(validFields({ auth_date: authDate }));

    expect(() => validateInitData(initData, BOT_TOKEN, 60)).not.toThrow();
  });

  it("rejects initData with a future auth_date beyond clock-skew allowance", () => {
    const futureAuthDate = String(Math.floor(Date.now() / 1000) + 3600);
    const initData = signInitData(validFields({ auth_date: futureAuthDate }));

    expect(() => validateInitData(initData, BOT_TOKEN)).toThrow(/future/i);
  });

  it("rejects initData missing the user field", () => {
    const fields = validFields();
    delete (fields as Record<string, string>).user;
    const initData = signInitData(fields);

    expect(() => validateInitData(initData, BOT_TOKEN)).toThrow(/missing 'user'/i);
  });

  it("rejects initData whose user field is not valid JSON", () => {
    const initData = signInitData(validFields({ user: "not-json" }));

    expect(() => validateInitData(initData, BOT_TOKEN)).toThrow(/not valid JSON/i);
  });

  it("rejects empty initData", () => {
    expect(() => validateInitData("", BOT_TOKEN)).toThrow(/empty/i);
  });

  it("rejects when bot token is not configured", () => {
    const initData = signInitData(validFields());

    expect(() => validateInitData(initData, "")).toThrow(/bot token/i);
  });
});
