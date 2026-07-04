import { createHmac } from "node:crypto";

/**
 * Test-only helper mirroring Telegram's own initData signing spec, shared by
 * initData.test.ts and auth.test.ts. Kept independent of the implementation
 * under test (src/lib/telegram/initData.ts) on purpose.
 */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}
