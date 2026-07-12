import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { fetchLeads } from "@/lib/leads";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchLeads(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}
