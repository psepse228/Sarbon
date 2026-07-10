"use client";

import { useCallback, useEffect, useState } from "react";

import { tmaFetch } from "@/lib/telegram/client";
import type { ConversationSummary } from "@/lib/types";

interface UseConversationsResult {
  items: ConversationSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Client-side data fetcher for GET /api/conversations, shared by mobile and desktop pages. */
export function useConversations(): UseConversationsResult {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tmaFetch("/api/conversations");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data: ConversationSummary[] = await res.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить диалоги");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
