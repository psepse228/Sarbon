import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { fetchEscalations, markEscalationNotified } from "@/lib/escalations";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  id: z.string().min(1),
  notifiedOwner: z.boolean(),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchEscalations(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { id, notifiedOwner } = patchSchema.parse(body);
    await markEscalationNotified(tenantId, id, notifiedOwner);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
