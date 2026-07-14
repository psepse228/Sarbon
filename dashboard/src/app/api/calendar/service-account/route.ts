import { NextResponse } from "next/server";

import { fetchServiceAccountEmail } from "@/lib/calendar";
import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    authenticateOwner(request);
    return NextResponse.json({ email: await fetchServiceAccountEmail() });
  } catch (err) {
    return toErrorResponse(err);
  }
}
