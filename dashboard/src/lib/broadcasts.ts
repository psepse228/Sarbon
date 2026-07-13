import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { Broadcast, BroadcastAudience, Lead } from "./types";

interface RawBroadcastRow {
  id: string;
  message: string;
  audience: BroadcastAudience;
  recipient_count: number;
  created_at: string;
}

export async function fetchBroadcasts(tenantId: string): Promise<Broadcast[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("broadcasts")
    .select("id,message,audience,recipient_count,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RawBroadcastRow[]>();

  if (error) {
    throw new Error(`Failed to load broadcasts: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    message: row.message,
    audience: row.audience,
    recipientCount: row.recipient_count,
    createdAt: row.created_at,
  }));
}

async function resolveAudience(tenantId: string, audience: BroadcastAudience): Promise<string[]> {
  const client = getServiceSupabaseClient();

  if (audience === "all") {
    const { data, error } = await client.from("conversations").select("client_id").eq("tenant_id", tenantId);
    if (error) throw new Error(`Failed to resolve audience: ${error.message}`);
    return [...new Set((data ?? []).map((row) => row.client_id as string))];
  }

  const status = audience.replace("leads_", "") as Lead["status"];
  const { data: leadRows, error: leadsError } = await client
    .from("cortege_leads")
    .select("conversation_id")
    .eq("tenant_id", tenantId)
    .eq("status", status);
  if (leadsError) throw new Error(`Failed to resolve audience: ${leadsError.message}`);

  const conversationIds = (leadRows ?? []).map((row) => row.conversation_id as string);
  if (conversationIds.length === 0) return [];

  const { data: convRows, error: convError } = await client
    .from("conversations")
    .select("client_id")
    .in("id", conversationIds);
  if (convError) throw new Error(`Failed to resolve audience: ${convError.message}`);

  return [...new Set((convRows ?? []).map((row) => row.client_id as string))];
}

export async function sendBroadcast(tenantId: string, audience: BroadcastAudience, message: string): Promise<number> {
  const chatIds = await resolveAudience(tenantId, audience);

  const backendUrl = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!backendUrl || !secret) {
    throw new Error("BACKEND_URL/INTERNAL_API_SECRET is not configured on the server");
  }

  let sentCount = 0;
  if (chatIds.length > 0) {
    const response = await fetch(`${backendUrl}/internal/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
      body: JSON.stringify({ chat_ids: chatIds, message }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Backend broadcast failed (${response.status})`);
    }
    const data: { sent_count: number } = await response.json();
    sentCount = data.sent_count;
  }

  const client = getServiceSupabaseClient();
  const { error } = await client.from("broadcasts").insert({
    tenant_id: tenantId,
    message,
    audience,
    recipient_count: sentCount,
  });
  if (error) {
    // The message was already sent — a failure here means the history row
    // is missing, not that the send failed. Don't throw: that would surface
    // as a UI failure and invite a retry, which would resend to the same
    // audience. Log it and still report the real sent count.
    console.error(`Failed to log broadcast: ${error.message}`);
  }

  return sentCount;
}
