"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { useConversationMessages } from "@/lib/useConversationMessages";
import { useConversations } from "@/lib/useConversations";
import type { ConversationSummary } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  escalated: "Эскалирован",
  closed: "Закрыт",
};

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  bot: "Бот",
  human: "Администратор",
};

function initialFor(clientId: string): string {
  return clientId.slice(-2, -1).toUpperCase() || clientId.slice(0, 1).toUpperCase() || "?";
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "сейчас";
  if (diffMin < 60) return `${diffMin} мин`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ч`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} дн`;
}

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const timestamp = conversation.lastMessageAt ?? conversation.createdAt;
  return (
    <button type="button" className="inbox-row" data-active={active} onClick={onSelect}>
      <span className="inbox-row-avatar">{initialFor(conversation.clientId)}</span>
      <span className="inbox-row-body">
        <span className="inbox-row-name">Клиент {conversation.clientId}</span>
        <span className="inbox-row-preview">{STATUS_LABEL[conversation.status] ?? conversation.status}</span>
      </span>
      <span className="inbox-row-time">{relativeTime(timestamp)}</span>
    </button>
  );
}

export default function DesktopConversationsPage() {
  const { items, loading, error } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0]!.id);
  }, [items, selectedId]);

  const { messages, loading: messagesLoading, error: messagesError } = useConversationMessages(selectedId ?? "");
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div>
      <h1>Диалоги</h1>
      <p className="muted">Переписка бота с клиентами — для контроля качества ответов.</p>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}
      {!loading && !error && items.length === 0 && <p className="muted">Диалогов пока нет.</p>}

      {items.length > 0 && (
        <div className="inbox-shell">
          <div className="inbox-list">
            {items.map((item) => (
              <ConversationRow
                key={item.id}
                conversation={item}
                active={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
          </div>
          <div className="inbox-thread">
            {!selected && <p className="muted inbox-thread-empty">Выберите диалог слева</p>}
            {selected && (
              <>
                <div className="inbox-thread-header">
                  <span className="inbox-row-avatar">{initialFor(selected.clientId)}</span>
                  <strong>Клиент {selected.clientId}</strong>
                </div>
                <div className="inbox-thread-messages">
                  {messagesError && <ErrorBanner message={messagesError} />}
                  {messagesLoading && <p className="muted">Загрузка…</p>}
                  {!messagesLoading &&
                    !messagesError &&
                    messages.map((message) => (
                      <div key={message.id} className="chat-row" data-role={message.role === "client" ? "assistant" : "user"}>
                        <div
                          className="chat-bubble"
                          data-role={message.role === "client" ? "assistant" : "user"}
                          data-sender={message.role}
                        >
                          <span className="chat-bubble-text">{message.content}</span>
                          <span className="chat-bubble-time">
                            {ROLE_LABEL[message.role] ?? message.role} · {new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
