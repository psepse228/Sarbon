import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { fetchConversationMessages } from "@/lib/conversations";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchConversationMessages(tenantId, params.id));
  } catch (err) {
    return toErrorResponse(err);
  }
}
