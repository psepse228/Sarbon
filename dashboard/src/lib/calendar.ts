import "server-only";

/** Stable, translatable code -- thrown for EVERY way this call can fail
 * (our own AbortSignal firing, a network error, or the backend's own
 * `calendar_unreachable` detail). Previously a raw error surfaced straight
 * to the owner ("The operation was aborted due to timeout" -- literally
 * the browser/Node AbortSignal message, untranslated, on a Russian UI) --
 * callers should catch this and show `calendar.syncError` instead of
 * `.message`. */
export class CalendarUnavailableError extends Error {
  constructor() {
    super("calendar_unreachable");
    this.name = "CalendarUnavailableError";
  }
}

async function callInternal<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!backendUrl || !secret) {
    throw new Error("BACKEND_URL/INTERNAL_API_SECRET is not configured on the server");
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Internal-Secret": secret, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Abort (our own timeout) or a network-level failure -- both look the
    // same to the caller: the backend didn't answer in time.
    throw new CalendarUnavailableError();
  }
  if (!response.ok) {
    throw new CalendarUnavailableError();
  }
  return response.json() as Promise<T>;
}

export async function fetchServiceAccountEmail(): Promise<string> {
  const { email } = await callInternal<{ email: string }>("/internal/calendar-service-account-email");
  return email;
}

export async function syncGoogleCalendar(tenantId: string): Promise<number> {
  // No calendarId parameter -- the backend looks up this tenant's own
  // company_profile.google_calendar_id itself rather than trusting a
  // client-supplied value (see the IDOR note in api/calendar/sync/route.ts).
  const { synced_count: syncedCount } = await callInternal<{ synced_count: number }>("/internal/sync-calendar", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId }),
  });
  return syncedCount;
}
