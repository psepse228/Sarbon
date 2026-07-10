"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Escalation } from "@/lib/types";

export default function EscalationsPage() {
  const [items, setItems] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await tmaFetch("/api/escalations");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setItems(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить эскалации");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleResolved(id: string, notifiedOwner: boolean) {
    const previous = items;
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, notifiedOwner } : e)));
    try {
      const res = await tmaFetch("/api/escalations", {
        method: "PATCH",
        body: JSON.stringify({ id, notifiedOwner }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(previous);
    }
  }

  return (
    <div>
      <h1>Эскалации</h1>
      <p className="muted">Вопросы клиентов, которые бот не смог закрыть сам.</p>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}
      {!loading && !error && items.length === 0 && (
        <p className="muted">Пока пусто — бот справляется сам.</p>
      )}

      {items.map((item) => (
        <div key={item.id} className="card">
          <div className="card-title-row">
            <span className="pill">{item.channel === "telegram" ? "Telegram" : item.channel}</span>
            <span className="pill">{new Date(item.createdAt).toLocaleString("ru-RU")}</span>
          </div>
          <p style={{ margin: "0 0 1.1rem" }}>{item.reason}</p>
          <button
            className={item.notifiedOwner ? "btn btn-secondary" : "btn btn-primary"}
            onClick={() => toggleResolved(item.id, !item.notifiedOwner)}
          >
            {item.notifiedOwner ? "Отмечено решённым ✓" : "Отметить решённым"}
          </button>
        </div>
      ))}
    </div>
  );
}
