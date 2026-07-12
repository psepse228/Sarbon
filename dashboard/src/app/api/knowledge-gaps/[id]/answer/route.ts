import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { answerKnowledgeGap } from "@/lib/knowledgeGaps";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ answer: z.string().min(1) });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { answer } = bodySchema.parse(await request.json());
    await answerKnowledgeGap(tenantId, params.id, answer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
