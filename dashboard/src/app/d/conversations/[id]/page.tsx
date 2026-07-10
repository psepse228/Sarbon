"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { ConversationMessage } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  bot: "Бот",
  human: "Администратор",
};

export default function DesktopConversationDetailPage({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await tmaFetch(`/api/conversations/${params.id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        setMessages(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить сообщения");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  return (
    <div>
      <h1>Диалог</h1>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}

      {!loading && !error && (
        <div className="card">
          {messages.map((message) => (
            <p key={message.id} style={{ whiteSpace: "pre-wrap" }}>
              <strong>{ROLE_LABEL[message.role] ?? message.role}</strong>{" "}
              <span className="muted">{new Date(message.createdAt).toLocaleString("ru-RU")}</span>
              <br />
              {message.content}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
