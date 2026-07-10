"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { ConversationSummary } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  escalated: "Эскалирован",
  closed: "Закрыт",
};

export default function DesktopConversationsPage() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await tmaFetch("/api/conversations");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        setItems(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить диалоги");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h1>Диалоги</h1>
      <p className="muted">Переписка бота с клиентами — для контроля качества ответов.</p>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}
      {!loading && !error && items.length === 0 && <p className="muted">Диалогов пока нет.</p>}

      {items.length > 0 && (
        <table className="desktop-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Последнее сообщение</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/d/conversations/${item.id}`}>Клиент {item.clientId}</Link>
                </td>
                <td>{STATUS_LABEL[item.status] ?? item.status}</td>
                <td>
                  {item.lastMessageAt
                    ? new Date(item.lastMessageAt).toLocaleString("ru-RU")
                    : new Date(item.createdAt).toLocaleString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
