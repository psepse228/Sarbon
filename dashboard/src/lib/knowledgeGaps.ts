import "server-only";

import { randomUUID } from "node:crypto";

import { getServiceSupabaseClient } from "./supabase/server";
import { fetchCompanyProfile, saveFaq } from "./companyProfile";
import type { KnowledgeGap } from "./types";

interface RawKnowledgeGapRow {
  id: string;
  conversation_id: string;
  question: string;
  status: "open" | "answered" | "dismissed";
  answer: string | null;
  created_at: string;
}

export async function fetchOpenKnowledgeGaps(tenantId: string): Promise<KnowledgeGap[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("knowledge_gaps")
    .select("id,conversation_id,question,status,answer,created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .returns<RawKnowledgeGapRow[]>();

  if (error) {
    throw new Error(`Failed to load knowledge_gaps: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    question: row.question,
    status: row.status,
    answer: row.answer,
    createdAt: row.created_at,
  }));
}

async function fetchGapForTenant(tenantId: string, gapId: string): Promise<RawKnowledgeGapRow> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("knowledge_gaps")
    .select("id,conversation_id,question,status,answer,created_at")
    .eq("id", gapId)
    .eq("tenant_id", tenantId)
    .maybeSingle<RawKnowledgeGapRow>();

  if (error) {
    throw new Error(`Failed to load knowledge_gaps row: ${error.message}`);
  }
  if (!data) {
    throw new Error("Knowledge gap not found for this tenant");
  }
  return data;
}

/** Appends {question, answer} to company_profile.faq (the same list
 * get_faq already reads) and marks the gap resolved. */
export async function answerKnowledgeGap(tenantId: string, gapId: string, answer: string): Promise<void> {
  const gap = await fetchGapForTenant(tenantId, gapId);

  const profile = await fetchCompanyProfile(tenantId);
  const alreadyInFaq = profile.faq.some((entry) => entry.question === gap.question);
  if (!alreadyInFaq) {
    await saveFaq(tenantId, [...profile.faq, { id: randomUUID(), question: gap.question, answer }]);
  }

  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("knowledge_gaps")
    .update({ status: "answered", answer, resolved_at: new Date().toISOString() })
    .eq("id", gapId);
  if (error) {
    throw new Error(`Failed to update knowledge_gaps: ${error.message}`);
  }
}

export async function dismissKnowledgeGap(tenantId: string, gapId: string): Promise<void> {
  await fetchGapForTenant(tenantId, gapId);

  const client = getServiceSupabaseClient();
  const { error } = await client
    .from("knowledge_gaps")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", gapId);
  if (error) {
    throw new Error(`Failed to update knowledge_gaps: ${error.message}`);
  }
}
