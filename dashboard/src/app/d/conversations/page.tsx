"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { useT } from "@/lib/i18n/LocaleProvider";
import { useConversationMessages } from "@/lib/useConversationMessages";
import { useConversations } from "@/lib/useConversations";
import type { ConversationSummary } from "@/lib/types";

function initialFor(clientId: string): string {
  return clientId.slice(-2, -1).toUpperCase() || clientId.slice(0, 1).toUpperCase() || "?";
}

function relativeTime(iso: string, t: (key: string) => string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return t("conversations.timeNow");
  if (diffMin < 60) return t("conversations.timeMinutes").replace("{n}", String(diffMin));
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t("conversations.timeHours").replace("{n}", String(diffHr));
  const diffDay = Math.round(diffHr / 24);
  return t("conversations.timeDays").replace("{n}", String(diffDay));
}

function statusLabelsFor(t: (key: string) => string): Record<string, string> {
  return {
    active: t("conversations.statusActive"),
    escalated: t("conversations.statusEscalated"),
    closed: t("conversations.statusClosed"),
  };
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
  const t = useT();
  const statusLabels = statusLabelsFor(t);
  const timestamp = conversation.lastMessageAt ?? conversation.createdAt;
  return (
    <button type="button" className="inbox-row" data-active={active} onClick={onSelect}>
      <span className="inbox-row-avatar" data-status={conversation.status}>
        {initialFor(conversation.clientId)}
      </span>
      <span className="inbox-row-body">
        <span className="inbox-row-name">{t("conversations.client")} {conversation.clientId}</span>
        <span className="inbox-row-preview">{statusLabels[conversation.status] ?? conversation.status}</span>
      </span>
      <span className="inbox-row-time">{relativeTime(timestamp, t)}</span>
    </button>
  );
}

export default function DesktopConversationsPage() {
  const t = useT();
  const { items, loading, error } = useConversations();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId || items.length === 0) return;
    // Deep-link support: Обзор/Лиды/Пробелы link here with ?conversationId=
    // to open a specific conversation directly, instead of always landing on
    // the first one in the list.
    const requestedId = searchParams.get("conversationId");
    const requested = requestedId ? items.find((item) => item.id === requestedId) : null;
    setSelectedId((requested ?? items[0]!).id);
  }, [items, selectedId, searchParams]);

  const { messages, loading: messagesLoading, error: messagesError } = useConversationMessages(selectedId ?? "");
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const statusLabels = statusLabelsFor(t);

  const roleLabels: Record<string, string> = {
    client: t("conversations.roleClient"),
    bot: t("conversations.roleBot"),
    human: t("conversations.roleHuman"),
  };

  return (
    <div>
      <h1>{t("conversations.title")}</h1>
      <p className="muted">{t("conversations.subtitle")}</p>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">{t("conversations.loading")}</p>}
      {!loading && !error && items.length === 0 && <p className="muted">{t("conversations.noneYet")}</p>}

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
            {!selected && <p className="muted inbox-thread-empty">{t("conversations.selectPrompt")}</p>}
            {selected && (
              <>
                <div className="inbox-thread-header">
                  <span className="inbox-row-avatar" data-status={selected.status}>
                    {initialFor(selected.clientId)}
                  </span>
                  <strong>{t("conversations.client")} {selected.clientId}</strong>
                  <span className="inbox-thread-status-badge" data-status={selected.status}>
                    {statusLabels[selected.status] ?? selected.status}
                  </span>
                </div>
                <div className="inbox-thread-messages">
                  {messagesError && <ErrorBanner message={messagesError} />}
                  {messagesLoading && <p className="muted">{t("conversations.loading")}</p>}
                  {!messagesLoading && !messagesError && messages.length === 0 && (
                    <p className="muted">{t("conversations.noMessagesYet")}</p>
                  )}
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
                            {roleLabels[message.role] ?? message.role} · {new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
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
