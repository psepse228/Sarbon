import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

/** Lightweight auth check used by AuthGate (and AccountMenu, for the
 * signed-in email) — 200 if the caller has a valid session cookie, 401
 * otherwise.
 *
 * Also carries subscriptionStatus (v1 billing -- no payment processor yet,
 * manually managed by the owner via tenants.subscription_status) so AuthGate
 * can block a suspended tenant right where it already blocks an
 * unauthenticated one, instead of adding a DB call to authenticateOwner
 * itself, which every API route depends on. */
export async function GET(request: Request) {
  try {
    const { tenantId, email } = authenticateOwner(request);

    const client = getServiceSupabaseClient();
    const { data } = await client
      .from("tenants")
      .select("subscription_status")
      .eq("id", tenantId)
      .limit(1)
      .maybeSingle();
    // Fails open to "active" if the row lookup comes back empty -- a lookup
    // hiccup should never look identical to a real suspension.
    const subscriptionStatus = data?.subscription_status ?? "active";

    return NextResponse.json({ ok: true, tenantId, email, subscriptionStatus });
  } catch (err) {
    return toErrorResponse(err);
  }
}
