import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { saveGoogleCalendarId } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ calendarId: z.string().min(1).nullable() });

export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { calendarId } = bodySchema.parse(await request.json());
    await saveGoogleCalendarId(tenantId, calendarId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
