import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. `import "server-only"` above makes any
 * accidental import from a Client Component fail the build instead of
 * leaking `SUPABASE_SERVICE_ROLE_KEY` into the browser bundle.
 *
 * Only ever call this from Route Handlers (src/app/api/**) or other
 * server-only code — never from a component marked "use client".
 */
let cachedClient: SupabaseClient | null = null;

export function getServiceSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server-side only)",
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
