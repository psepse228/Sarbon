import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

/** Whether the dashboard's own env has TELEGRAM_BOT_TOKEN configured — the
 * same variable the guest-facing bot itself needs to run at all, so "set"
 * here is a real signal the Telegram channel is live, not a guess. */
export async function GET(request: Request) {
  try {
    authenticateOwner(request);
    return NextResponse.json({ telegramConnected: Boolean(process.env.TELEGRAM_BOT_TOKEN) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
