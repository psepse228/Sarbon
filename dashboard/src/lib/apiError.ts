import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError } from "./telegram/auth";

/** Converts a thrown error into a consistent JSON error response. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.issues },
      { status: 400 },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  // eslint-disable-next-line no-console
  console.error(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
