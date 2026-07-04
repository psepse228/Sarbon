import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { Escalation } from "./types";

interface RawEscalationRow {
  id: string;
  conversation_id: string;
  reason: string | null;
  notified_owner: boolean | null;
  created_at: string;
  conversations: { tenant_id: string; client_id: string; channel: string } | null;
}

/** Tenant-scoped by joining through `conversations` — `escalations` has no `tenant_id` column of its own. */
export async function fetchEscalations(tenantId: string): Promise<Escalation[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("escalations")
    .select("id,conversation_id,reason,notified_owner,created_at,conversations!inner(tenant_id,client_id,channel)")
    .eq("conversations.tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RawEscalationRow[]>();

  if (error) {
    throw new Error(`Failed to load escalations: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    reason: row.reason ?? "",
    notifiedOwner: row.notified_owner ?? false,
    createdAt: row.created_at,
    clientId: row.conversations?.client_id ?? "",
    channel: row.conversations?.channel ?? "",
  }));
}

export async function markEscalationNotified(
  tenantId: string,
  escalationId: string,
  notified: boolean,
): Promise<void> {
  const client = getServiceSupabaseClient();

  // Defense in depth: confirm the escalation actually belongs to this tenant
  // (via its conversation) before allowing the update.
  const { data: existing, error: selectError } = await client
    .from("escalations")
    .select("id,conversations!inner(tenant_id)")
    .eq("id", escalationId)
    .eq("conversations.tenant_id", tenantId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to verify escalation: ${selectError.message}`);
  }
  if (!existing) {
    throw new Error("Escalation not found for this tenant");
  }

  const { error } = await client
    .from("escalations")
    .update({ notified_owner: notified })
    .eq("id", escalationId);

  if (error) {
    throw new Error(`Failed to update escalation: ${error.message}`);
  }
}
