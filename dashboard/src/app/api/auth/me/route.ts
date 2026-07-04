import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

/** Lightweight auth check used by AuthGate — 200 if the caller is
 * authenticated (session cookie or Mini App initData), 401/403 otherwise. */
export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json({ ok: true, tenantId });
  } catch (err) {
    return toErrorResponse(err);
  }
}
