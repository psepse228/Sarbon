import { NextResponse } from "next/server";
import { z } from "zod";

import { generateAssistantReply } from "@/lib/assistant";
import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  history: z.array(messageSchema).min(1),
});

export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { history } = bodySchema.parse(body);

    const reply = await generateAssistantReply(tenantId, history);
    return NextResponse.json({ reply });
  } catch (err) {
    return toErrorResponse(err);
  }
}
