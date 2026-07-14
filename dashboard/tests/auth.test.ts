import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, authenticateOwner, resolveOrCreateTenantByEmail, SESSION_COOKIE_NAME } from "@/lib/telegram/auth";
import { createSessionToken } from "@/lib/session";

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function makeRequestWithCookie(cookieValue: string | null): Request {
  const headers: Record<string, string> = {};
  if (cookieValue !== null) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;
  return new Request("http://localhost/api/company-profile", { headers });
}

describe("authenticateOwner", () => {
  beforeEach(() => {
    setEnv({ SESSION_SECRET: "test-session-secret" });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("resolves the owner from a valid session cookie", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      "test-session-secret",
    );

    const result = authenticateOwner(makeRequestWithCookie(token));

    expect(result).toEqual({ email: "owner@example.com", tenantId: "tenant-1" });
  });

  it("throws 401 when there is no session cookie", () => {
    expect(() => authenticateOwner(makeRequestWithCookie(null))).toThrow(AuthError);
    try {
      authenticateOwner(makeRequestWithCookie(null));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).status).toBe(401);
    }
  });

  it("throws 401 when the session cookie is invalid", () => {
    expect(() => authenticateOwner(makeRequestWithCookie("not-a-real-token"))).toThrow(AuthError);
  });

  it("throws 401 when the session cookie is expired", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) - 10 },
      "test-session-secret",
    );

    expect(() => authenticateOwner(makeRequestWithCookie(token))).toThrow(AuthError);
  });

  it("throws 401 when SESSION_SECRET is not configured, even with an otherwise-valid cookie", () => {
    const token = createSessionToken(
      { email: "owner@example.com", tenantId: "tenant-1", exp: Math.floor(Date.now() / 1000) + 3600 },
      "test-session-secret",
    );
    setEnv({ SESSION_SECRET: undefined });

    expect(() => authenticateOwner(makeRequestWithCookie(token))).toThrow(AuthError);
  });
});

describe("resolveOrCreateTenantByEmail", () => {
  function makeFakeClient(overrides: {
    selectResult?: { data: unknown; error: unknown };
    insertResult?: { data: unknown; error: unknown };
    raceSelectResult?: { data: unknown; error: unknown };
  }) {
    let selectCallCount = 0;
    const selectResults = [overrides.selectResult, overrides.raceSelectResult].filter(Boolean);
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              const result = selectResults[selectCallCount] ?? selectResults[selectResults.length - 1];
              selectCallCount += 1;
              return result;
            }),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => overrides.insertResult),
        })),
      })),
    }));
    return { from };
  }

  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the existing tenant id when the email is already registered", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      getServiceSupabaseClient: () => makeFakeClient({ selectResult: { data: { id: "tenant-existing" }, error: null } }),
    }));
    const { resolveOrCreateTenantByEmail: fn } = await import("@/lib/telegram/auth");

    const tenantId = await fn("owner@example.com", "Owner Name");

    expect(tenantId).toBe("tenant-existing");
  });

  it("creates a new tenant when the email has never logged in before", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      getServiceSupabaseClient: () =>
        makeFakeClient({
          selectResult: { data: null, error: null },
          insertResult: { data: { id: "tenant-new" }, error: null },
        }),
    }));
    const { resolveOrCreateTenantByEmail: fn } = await import("@/lib/telegram/auth");

    const tenantId = await fn("new-owner@example.com", "New Owner");

    expect(tenantId).toBe("tenant-new");
  });

  it("recovers via a re-select when a concurrent first-login wins the unique-violation race", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      getServiceSupabaseClient: () =>
        makeFakeClient({
          selectResult: { data: null, error: null },
          insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
          raceSelectResult: { data: { id: "tenant-race-winner" }, error: null },
        }),
    }));
    const { resolveOrCreateTenantByEmail: fn } = await import("@/lib/telegram/auth");

    const tenantId = await fn("racing-owner@example.com", null);

    expect(tenantId).toBe("tenant-race-winner");
  });
});
