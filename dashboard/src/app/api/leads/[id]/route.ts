import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { updateLeadNotes, updateLeadStatus } from "@/lib/leads";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    status: z.enum(["new", "contacted", "booked", "lost"]).optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((body) => body.status !== undefined || body.notes !== undefined, {
    message: "status or notes is required",
  });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { status, notes } = bodySchema.parse(await request.json());
    if (status !== undefined) await updateLeadStatus(tenantId, params.id, status);
    if (notes !== undefined) await updateLeadNotes(tenantId, params.id, notes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
