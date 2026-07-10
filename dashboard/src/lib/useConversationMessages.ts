"use client";

import { useCallback, useEffect, useState } from "react";

import { tmaFetch } from "@/lib/telegram/client";
import type { ConversationMessage } from "@/lib/types";

interface UseConversationMessagesResult {
  messages: ConversationMessage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Client-side data fetcher for GET /api/conversations/:id, shared by mobile and desktop pages. */
export function useConversationMessages(id: string): UseConversationMessagesResult {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tmaFetch(`/api/conversations/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data: ConversationMessage[] = await res.json();
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить сообщения");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { messages, loading, error, refetch };
}
