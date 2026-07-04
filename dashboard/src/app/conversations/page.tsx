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

export default function ConversationsPage() {
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

      {items.map((item) => (
        <Link key={item.id} href={`/conversations/${item.id}`} className="card" style={{ display: "block" }}>
          <div className="card-title-row">
            <strong>Клиент {item.clientId}</strong>
            <span className="pill">{STATUS_LABEL[item.status] ?? item.status}</span>
          </div>
          <p className="muted">
            {item.lastMessageAt
              ? new Date(item.lastMessageAt).toLocaleString("ru-RU")
              : new Date(item.createdAt).toLocaleString("ru-RU")}
          </p>
        </Link>
      ))}
    </div>
  );
}
