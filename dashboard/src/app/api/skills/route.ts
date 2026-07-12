import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { saveDisabledSkills } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";
import { disabledSkillsSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** PUT /api/skills — replaces the entire `disabled_skills` array for the caller's tenant. */
export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const disabledSkills = disabledSkillsSchema.parse(body);
    await saveDisabledSkills(tenantId, disabledSkills);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
