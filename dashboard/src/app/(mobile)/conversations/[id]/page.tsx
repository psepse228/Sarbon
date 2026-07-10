"use client";

import { ErrorBanner } from "@/components/StatusBanner";
import { useConversationMessages } from "@/lib/useConversationMessages";

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  bot: "Бот",
  human: "Администратор",
};

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  const { messages, loading, error } = useConversationMessages(params.id);

  return (
    <div>
      <h1>Диалог</h1>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}

      {messages.map((message) => (
        <div key={message.id} className="card">
          <div className="card-title-row">
            <strong>{ROLE_LABEL[message.role] ?? message.role}</strong>
            <span className="muted">{new Date(message.createdAt).toLocaleString("ru-RU")}</span>
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p>
        </div>
      ))}
    </div>
  );
}
