import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { fetchCompanyProfile } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

/** GET /api/company-profile — the full profile (packages, faq, partners, policies) for the caller's tenant. */
export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const profile = await fetchCompanyProfile(tenantId);
    return NextResponse.json(profile);
  } catch (err) {
    return toErrorResponse(err);
  }
}
