import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { CompanyProfile, FaqEntry, Package, Partner } from "./types";

const COLUMNS = "packages,faq,partners,policies,updated_at";

interface CompanyProfileRow {
  packages: Package[] | null;
  faq: FaqEntry[] | null;
  partners: Partner[] | null;
  policies: string | null;
  updated_at: string | null;
}

/**
 * Fetches the single `company_profile` row for a tenant. Every caller must
 * supply a `tenantId` resolved server-side from validated Telegram
 * `initData` (see src/lib/telegram/auth.ts) — never a value taken directly
 * from client input, and never hardcoded, even though only one tenant
 * exists in production today.
 */
export async function fetchCompanyProfile(tenantId: string): Promise<CompanyProfile> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("company_profile")
    .select(COLUMNS)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle<CompanyProfileRow>();

  if (error) {
    throw new Error(`Failed to load company_profile: ${error.message}`);
  }

  if (!data) {
    // No row yet for this tenant — return an empty-but-shaped profile so the
    // UI can still render forms to create the first packages/FAQ/partners.
    return {
      tenantId,
      packages: [],
      faq: [],
      partners: [],
      policies: "",
      updatedAt: null,
    };
  }

  return {
    tenantId,
    packages: data.packages ?? [],
    faq: data.faq ?? [],
    partners: data.partners ?? [],
    policies: data.policies ?? "",
    updatedAt: data.updated_at,
  };
}

async function upsertColumn(
  tenantId: string,
  column: "packages" | "faq" | "partners" | "policies",
  value: unknown,
): Promise<void> {
  const client = getServiceSupabaseClient();

  // Update-if-exists, else insert — company_profile has no unique
  // constraint on tenant_id in the current schema, so we check first rather
  // than relying on upsert(onConflict).
  const { data: existing, error: selectError } = await client
    .from("company_profile")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (selectError) {
    throw new Error(`Failed to look up company_profile: ${selectError.message}`);
  }

  if (existing) {
    const { error } = await client
      .from("company_profile")
      .update({ [column]: value, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    if (error) {
      throw new Error(`Failed to update company_profile.${column}: ${error.message}`);
    }
    return;
  }

  const { error } = await client
    .from("company_profile")
    .insert({ tenant_id: tenantId, [column]: value });
  if (error) {
    throw new Error(`Failed to create company_profile row: ${error.message}`);
  }
}

export function savePackages(tenantId: string, packages: Package[]): Promise<void> {
  return upsertColumn(tenantId, "packages", packages);
}

export function saveFaq(tenantId: string, faq: FaqEntry[]): Promise<void> {
  return upsertColumn(tenantId, "faq", faq);
}

export function savePartners(tenantId: string, partners: Partner[]): Promise<void> {
  return upsertColumn(tenantId, "partners", partners);
}

export function savePolicies(tenantId: string, policies: string): Promise<void> {
  return upsertColumn(tenantId, "policies", policies);
}
