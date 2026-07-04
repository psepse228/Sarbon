import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { savePolicies } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { policiesSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PUT /api/policies — replaces the `policies` text column for the caller's tenant. */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { policies } = policiesSchema.parse(body);
    await savePolicies(tenantId, policies);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
