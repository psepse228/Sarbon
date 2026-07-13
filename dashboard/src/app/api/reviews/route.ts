import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { fetchReviews } from "@/lib/reviews";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    return NextResponse.json(await fetchReviews(tenantId));
  } catch (err) {
    return toErrorResponse(err);
  }
}
