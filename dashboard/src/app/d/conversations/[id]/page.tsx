"use client";

import { ErrorBanner } from "@/components/StatusBanner";
import { useConversationMessages } from "@/lib/useConversationMessages";

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  bot: "Бот",
  human: "Администратор",
};

export default function DesktopConversationDetailPage({ params }: { params: { id: string } }) {
  const { messages, loading, error } = useConversationMessages(params.id);

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
