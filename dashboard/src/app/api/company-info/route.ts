import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { saveCompanyInfo } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { companyInfoSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PUT /api/company-info — replaces company_name/address/phone/socials for the caller's tenant. */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const info = companyInfoSchema.parse(body);
    await saveCompanyInfo(tenantId, info);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
