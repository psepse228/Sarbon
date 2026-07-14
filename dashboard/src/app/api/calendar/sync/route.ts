import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { syncGoogleCalendar } from "@/lib/calendar";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ calendarId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { calendarId } = bodySchema.parse(await request.json());
    const syncedCount = await syncGoogleCalendar(tenantId, calendarId);
    return NextResponse.json({ syncedCount });
  } catch (err) {
    return toErrorResponse(err);
  }
}
