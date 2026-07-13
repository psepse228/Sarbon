"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Broadcast, BroadcastAudience } from "@/lib/types";

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: "Все диалоги",
  leads_new: "Лиды: новые",
  leads_contacted: "Лиды: в работе",
  leads_booked: "Лиды: забронировано",
};

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  function loadBroadcasts() {
    tmaFetch("/api/broadcasts")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить рассылки (${res.status})`);
        return (await res.json()) as Broadcast[];
      })
      .then(setBroadcasts)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить рассылки"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBroadcasts();
  }, []);

  async function send() {
    setSending(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await tmaFetch("/api/broadcasts", {
        method: "POST",
        body: JSON.stringify({ audience, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось отправить рассылку (${res.status})`);
      }
      const body: { recipientCount: number } = await res.json();
      setLastResult(body.recipientCount);
      setMessage("");
      loadBroadcasts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить рассылку");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Рассылки</h1>
      <p className="muted">Отправьте сообщение сразу нескольким гостям или лидам.</p>

      {error && <ErrorBanner message={error} />}

      <div className="card">
        <div className="field">
          <label>Кому</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as BroadcastAudience)}>
            {(Object.keys(AUDIENCE_LABELS) as BroadcastAudience[]).map((key) => (
              <option key={key} value={key}>
                {AUDIENCE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Сообщение</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Например: У нас акция — скидка 10% на будни в этом месяце"
          />
        </div>
        <button type="button" className="btn btn-primary" disabled={sending || message.trim().length === 0} onClick={send}>
          {sending ? "Отправка…" : "Отправить"}
        </button>
        {lastResult !== null && <p className="muted">Отправлено получателям: {lastResult}</p>}
      </div>

      <h3>История рассылок</h3>
      {broadcasts.length === 0 && <p className="muted">Пока нет рассылок.</p>}
      {broadcasts.map((b) => (
        <div key={b.id} className="card">
          <p>{b.message}</p>
          <p className="muted">
            {AUDIENCE_LABELS[b.audience]} · {b.recipientCount} получателей ·{" "}
            {new Date(b.createdAt).toLocaleString("ru-RU")}
          </p>
        </div>
      ))}
    </div>
  );
}
