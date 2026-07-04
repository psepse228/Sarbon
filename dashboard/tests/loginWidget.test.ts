import { describe, expect, it } from "vitest";

import { LoginWidgetValidationError, validateLoginWidgetData } from "@/lib/telegram/loginWidget";
import { signLoginWidgetData } from "./helpers/signLoginWidgetData";

const BOT_TOKEN = "123456:TEST-bot-token-for-unit-tests";

function validFields(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 111111111,
    first_name: "Владелец",
    username: "owner_tg",
    auth_date: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("validateLoginWidgetData", () => {
  it("accepts a correctly signed payload", () => {
    const payload = signLoginWidgetData(validFields(), BOT_TOKEN);

    const result = validateLoginWidgetData(payload, BOT_TOKEN);

    expect(result.id).toBe(111111111);
    expect(result.username).toBe("owner_tg");
  });

  it("rejects a payload whose hash does not match (tampered id)", () => {
    const payload = signLoginWidgetData(validFields(), BOT_TOKEN);
    const tampered = { ...payload, id: 999999999 };

    expect(() => validateLoginWidgetData(tampered, BOT_TOKEN)).toThrow(LoginWidgetValidationError);
  });

  it("rejects a payload signed with a different bot token", () => {
    const payload = signLoginWidgetData(validFields(), "999999:OTHER-bot-token");

    expect(() => validateLoginWidgetData(payload, BOT_TOKEN)).toThrow(LoginWidgetValidationError);
  });

  it("rejects a stale auth_date", () => {
    const staleDate = Math.floor(Date.now() / 1000) - 90_000;
    const payload = signLoginWidgetData(validFields({ auth_date: staleDate }), BOT_TOKEN);

    expect(() => validateLoginWidgetData(payload, BOT_TOKEN)).toThrow(LoginWidgetValidationError);
  });

  it("rejects an auth_date in the future", () => {
    const futureDate = Math.floor(Date.now() / 1000) + 600;
    const payload = signLoginWidgetData(validFields({ auth_date: futureDate }), BOT_TOKEN);

    expect(() => validateLoginWidgetData(payload, BOT_TOKEN)).toThrow(LoginWidgetValidationError);
  });

  it("rejects a payload missing 'hash'", () => {
    const { hash: _hash, ...withoutHash } = signLoginWidgetData(validFields(), BOT_TOKEN);

    expect(() => validateLoginWidgetData(withoutHash, BOT_TOKEN)).toThrow(LoginWidgetValidationError);
  });

  it("rejects a payload missing a numeric 'id'", () => {
    const payload = signLoginWidgetData({ ...validFields(), id: undefined }, BOT_TOKEN);

    expect(() => validateLoginWidgetData(payload, BOT_TOKEN)).toThrow(LoginWidgetValidationError);
  });

  it("rejects when the server has no bot token configured", () => {
    const payload = signLoginWidgetData(validFields(), BOT_TOKEN);

    expect(() => validateLoginWidgetData(payload, "")).toThrow(LoginWidgetValidationError);
  });
});
