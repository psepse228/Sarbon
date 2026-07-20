import "server-only";

import { upsertAvailability } from "./availability";
import { getServiceSupabaseClient } from "./supabase/server";
import type { Lead } from "./types";

interface RawLeadRow {
  id: string;
  conversation_id: string;
  name: string | null;
  phone: string | null;
  preferred_date: string | null;
  guest_count: number | null;
  budget: string | null;
  status: "new" | "contacted" | "booked" | "lost";
  notes: string | null;
  created_at: string;
}

const LEAD_COLUMNS = "id,conversation_id,name,phone,preferred_date,guest_count,budget,status,notes,created_at";

export async function fetchLeads(tenantId: string): Promise<Lead[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("cortege_leads")
    .select(LEAD_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RawLeadRow[]>();

  if (error) {
    throw new Error(`Failed to load leads: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    name: row.name,
    phone: row.phone,
    preferredDate: row.preferred_date,
    guestCount: row.guest_count,
    budget: row.budget,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

async function fetchLeadForTenant(tenantId: string, leadId: string): Promise<RawLeadRow> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("cortege_leads")
    .select(LEAD_COLUMNS)
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle<RawLeadRow>();

  if (error) {
    throw new Error(`Failed to load lead: ${error.message}`);
  }
  if (!data) {
    throw new Error("Lead not found for this tenant");
  }
  return data;
}

/** Updates a lead's status. When moving to "booked" with a preferred_date
 * set, also marks that date unavailable in availability_cache — so the
 * bot's own check_date_availability immediately reflects it. Moving off
 * "booked" does not auto-revert availability_cache; the owner handles that
 * manually via the existing Calendar tab, same as any other availability
 * change. */
export async function updateLeadStatus(tenantId: string, leadId: string, status: Lead["status"]): Promise<void> {
  const lead = await fetchLeadForTenant(tenantId, leadId);

  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("cortege_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", tenantId);
  if (error) {
    throw new Error(`Failed to update lead: ${error.message}`);
  }

  if (status === "booked" && lead.preferred_date) {
    await upsertAvailability(tenantId, lead.preferred_date, false, `Бронь: ${lead.name ?? "без имени"}`);
  }
}

export async function updateLeadNotes(tenantId: string, leadId: string, notes: string): Promise<void> {
  await fetchLeadForTenant(tenantId, leadId); // confirms tenant ownership before writing

  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("cortege_leads")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", tenantId);
  if (error) {
    throw new Error(`Failed to update lead notes: ${error.message}`);
  }
}
