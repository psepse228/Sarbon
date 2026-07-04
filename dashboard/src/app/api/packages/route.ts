import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { savePackages } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { packagesArraySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * PUT /api/packages — replaces the entire `packages` array for the caller's
 * tenant. jsonb columns have no per-item primary key, so the dashboard
 * treats each array as a single editable document: the client loads the
 * full list, edits it, and saves the whole thing back.
 */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const packages = packagesArraySchema.parse(body);
    await savePackages(tenantId, packages);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
