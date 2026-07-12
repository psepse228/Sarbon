import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { updateLeadStatus } from "@/lib/leads";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ status: z.enum(["new", "contacted", "booked", "lost"]) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { status } = bodySchema.parse(await request.json());
    await updateLeadStatus(tenantId, params.id, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
