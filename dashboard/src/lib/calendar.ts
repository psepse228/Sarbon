import "server-only";

async function callInternal<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!backendUrl || !secret) {
    throw new Error("BACKEND_URL/INTERNAL_API_SECRET is not configured on the server");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Internal-Secret": secret, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Backend calendar call failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchServiceAccountEmail(): Promise<string> {
  const { email } = await callInternal<{ email: string }>("/internal/calendar-service-account-email");
  return email;
}

export async function syncGoogleCalendar(tenantId: string, calendarId: string): Promise<number> {
  const { synced_count: syncedCount } = await callInternal<{ synced_count: number }>("/internal/sync-calendar", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId, calendar_id: calendarId }),
  });
  return syncedCount;
}
