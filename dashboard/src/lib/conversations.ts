import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { ConversationMessage, ConversationSummary } from "./types";

interface RawConversationRow {
  id: string;
  client_id: string;
  channel: string;
  status: string | null;
  last_message_at: string | null;
  created_at: string;
}

export async function fetchConversations(tenantId: string): Promise<ConversationSummary[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("conversations")
    .select("id,client_id,channel,status,last_message_at,created_at")
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .returns<RawConversationRow[]>();

  if (error) {
    throw new Error(`Failed to load conversations: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    channel: row.channel,
    status: row.status ?? "active",
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  }));
}

interface RawMessageRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

/** Verifies the conversation belongs to `tenantId` before returning its messages. */
export async function fetchConversationMessages(
  tenantId: string,
  conversationId: string,
): Promise<ConversationMessage[]> {
  const client = getServiceSupabaseClient();

  const { data: conversation, error: conversationError } = await client
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string }>();

  if (conversationError) {
    throw new Error(`Failed to verify conversation: ${conversationError.message}`);
  }
  if (!conversation) {
    throw new Error("Conversation not found for this tenant");
  }

  const { data, error } = await client
    .from("messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<RawMessageRow[]>();

  if (error) {
    throw new Error(`Failed to load messages: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}
