import { createHash, createHmac } from "node:crypto";

/**
 * Test-only helper mirroring Telegram's Login Widget signing spec
 * (https://core.telegram.org/widgets/login#checking-authorization), kept
 * independent of the implementation under test
 * (src/lib/telegram/loginWidget.ts) on purpose.
 */
export function signLoginWidgetData(
  fields: Record<string, unknown>,
  botToken: string,
): Record<string, unknown> {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return { ...fields, hash };
}
