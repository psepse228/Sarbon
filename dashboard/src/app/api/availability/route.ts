import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { deleteAvailability, fetchAvailability, upsertAvailability } from "@/lib/availability";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД"),
  isAvailable: z.boolean(),
  eventDetails: z.string(),
});

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchAvailability(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { date, isAvailable, eventDetails } = upsertSchema.parse(body);
    await upsertAvailability(tenantId, date, isAvailable, eventDetails);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new Error("Missing id query parameter");
    }
    await deleteAvailability(tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
