import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { syncGoogleCalendar } from "@/lib/calendar";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

// Deliberately does not accept a calendarId from the request body -- the
// backend resolves the calendar to sync from this tenant's own saved
// company_profile.google_calendar_id. Accepting a client-supplied calendarId
// here was a cross-tenant IDOR: any authenticated tenant could sync (and
// then read back) any other tenant's real Google Calendar just by naming it.
export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const syncedCount = await syncGoogleCalendar(tenantId);
    return NextResponse.json({ syncedCount });
  } catch (err) {
    return toErrorResponse(err);
  }
}
