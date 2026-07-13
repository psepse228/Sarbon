import "server-only";

import { getServiceSupabaseClient } from "./supabase/server";
import type { Review } from "./types";

interface RawReviewRow {
  id: string;
  conversation_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function fetchReviews(tenantId: string): Promise<Review[]> {
  const client = getServiceSupabaseClient();
  const { data, error } = await client
    .from("reviews")
    .select("id,conversation_id,rating,comment,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RawReviewRow[]>();

  if (error) {
    throw new Error(`Failed to load reviews: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }));
}
