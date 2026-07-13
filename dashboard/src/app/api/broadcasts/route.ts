import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { fetchBroadcasts, sendBroadcast } from "@/lib/broadcasts";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const sendSchema = z.object({
  audience: z.enum(["all", "leads_new", "leads_contacted", "leads_booked"]),
  message: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchBroadcasts(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { audience, message } = sendSchema.parse(body);
    const recipientCount = await sendBroadcast(tenantId, audience, message);
    return NextResponse.json({ recipientCount });
  } catch (err) {
    return toErrorResponse(err);
  }
}
