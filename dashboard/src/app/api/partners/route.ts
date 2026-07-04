import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { savePartners } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { partnersArraySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PUT /api/partners — replaces the entire `partners` array for the caller's tenant. */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const partners = partnersArraySchema.parse(body);
    await savePartners(tenantId, partners);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
