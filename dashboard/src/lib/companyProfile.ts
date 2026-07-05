import "server-only";

import { randomUUID } from "node:crypto";

import { getServiceSupabaseClient } from "./supabase/server";
import type { CompanyProfile, FaqEntry, Package, Partner } from "./types";

const COLUMNS = "packages,faq,partners,policies,active_notice,company_name,address,phone,socials,updated_at";

// Rows seeded directly in Supabase (before this dashboard existed) predate
// the client-generated `id` field and, for partners, can have a null
// `contact`. These raw types describe what's actually on disk; the accessors
// below normalize them into the dashboard's `Package`/`FaqEntry`/`Partner`
// shape (id backfilled, `contact` defaulted to "").
type RawPackage = Omit<Package, "id"> & { id?: string };
type RawFaqEntry = Omit<FaqEntry, "id"> & { id?: string };
type RawPartner = Omit<Partner, "id" | "contact"> & { id?: string; contact: string | null };

interface CompanyProfileRow {
  packages: RawPackage[] | null;
  faq: RawFaqEntry[] | null;
  partners: RawPartner[] | null;
  policies: string | null;
  active_notice: string | null;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  socials: string | null;
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
      activeNotice: null,
      companyName: null,
      address: null,
      phone: null,
      socials: null,
      updatedAt: null,
    };
  }

  return {
    tenantId,
    packages: (data.packages ?? []).map((p) => ({ ...p, id: p.id ?? randomUUID() })),
    faq: (data.faq ?? []).map((f) => ({ ...f, id: f.id ?? randomUUID() })),
    partners: (data.partners ?? []).map((p) => ({ ...p, id: p.id ?? randomUUID(), contact: p.contact ?? "" })),
    policies: data.policies ?? "",
    activeNotice: data.active_notice ?? null,
    companyName: data.company_name ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    socials: data.socials ?? null,
    updatedAt: data.updated_at,
  };
}

async function upsertColumns(tenantId: string, columns: Record<string, unknown>): Promise<void> {
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
      .update({ ...columns, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    if (error) {
      throw new Error(`Failed to update company_profile: ${error.message}`);
    }
    return;
  }

  const { error } = await client
    .from("company_profile")
    .insert({ tenant_id: tenantId, ...columns });
  if (error) {
    throw new Error(`Failed to create company_profile row: ${error.message}`);
  }
}

function upsertColumn(
  tenantId: string,
  column: "packages" | "faq" | "partners" | "policies" | "active_notice",
  value: unknown,
): Promise<void> {
  return upsertColumns(tenantId, { [column]: value });
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

/** Read by the client-facing bot (backend/app/functions/handlers.py's
 * get_active_notice) and woven into its system prompt when set. */
export function saveActiveNotice(tenantId: string, notice: string | null): Promise<void> {
  return upsertColumn(tenantId, "active_notice", notice);
}

export interface CompanyInfoInput {
  companyName: string;
  address: string;
  phone: string;
  socials: string;
}

/** Read by the client-facing bot (backend/app/functions/handlers.py's
 * get_company_info) and woven into its system prompt when set. */
export function saveCompanyInfo(tenantId: string, info: CompanyInfoInput): Promise<void> {
  return upsertColumns(tenantId, {
    company_name: info.companyName,
    address: info.address,
    phone: info.phone,
    socials: info.socials,
  });
}
