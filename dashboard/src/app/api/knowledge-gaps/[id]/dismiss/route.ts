import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { dismissKnowledgeGap } from "@/lib/knowledgeGaps";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    await dismissKnowledgeGap(tenantId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
