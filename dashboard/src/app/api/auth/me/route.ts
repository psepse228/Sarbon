import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

/** Lightweight auth check used by AuthGate (and AccountMenu, for the
 * signed-in email) — 200 if the caller has a valid session cookie, 401
 * otherwise. */
export async function GET(request: Request) {
  try {
    const { tenantId, email } = authenticateOwner(request);
    return NextResponse.json({ ok: true, tenantId, email });
  } catch (err) {
    return toErrorResponse(err);
  }
}
