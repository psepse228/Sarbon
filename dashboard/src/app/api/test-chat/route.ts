import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  history: z.array(turnSchema).min(1),
});

interface BackendToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

interface BackendTestChatResponse {
  reply: string;
  tool_calls: BackendToolCall[];
}

export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const body = await request.json();
    const { history } = bodySchema.parse(body);

    const backendUrl = process.env.BACKEND_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!backendUrl || !secret) {
      throw new Error("BACKEND_URL/INTERNAL_API_SECRET is not configured on the server");
    }

    const backendResponse = await fetch(`${backendUrl}/internal/test-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        history: history.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend test-chat failed (${backendResponse.status})`);
    }

    const data: BackendTestChatResponse = await backendResponse.json();
    return NextResponse.json({
      reply: data.reply,
      toolCalls: data.tool_calls.map((tc) => ({ name: tc.name, arguments: tc.arguments, result: tc.result })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
