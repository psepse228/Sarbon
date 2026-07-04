import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { saveFaq } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { faqArraySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PUT /api/faq — replaces the entire `faq` array for the caller's tenant. */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const faq = faqArraySchema.parse(body);
    await saveFaq(tenantId, faq);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
