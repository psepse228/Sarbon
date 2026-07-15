import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/telegram/auth";

export const runtime = "nodejs";

/** Clears the session cookie — the only server-side state this dashboard's
 * auth has (see src/lib/session.ts, no server-side session store to revoke). */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
