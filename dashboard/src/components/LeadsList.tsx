"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Lead } from "@/lib/types";

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "Новый",
  contacted: "Связались",
  booked: "Забронировано",
  lost: "Потерян",
};

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmaFetch("/api/leads")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить лиды (${res.status})`);
        return (await res.json()) as Lead[];
      })
      .then((data) => {
        if (!cancelled) setLeads(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить лиды");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeStatus(lead: Lead, status: Lead["status"]) {
    setBusyId(lead.id);
    setError(null);
    try {
      const res = await tmaFetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось обновить статус (${res.status})`);
      }
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Лиды</h1>
      <p className="muted">
        Клиенты, которые проявили намерение забронировать. Обновляйте статус по мере работы с заявкой.
      </p>

      {error && <ErrorBanner message={error} />}

      {leads.length === 0 && <p className="muted">Пока нет лидов.</p>}

      {leads.map((lead) => (
        <div key={lead.id} className="card">
          <div className="card-title-row">
            <strong>{lead.name ?? "Без имени"}</strong>
            <a href={`/d/conversations/${lead.conversationId}`}>Открыть диалог</a>
          </div>
          <p className="muted">
            {lead.phone ?? "—"} · {lead.preferredDate ?? "дата не указана"} · {lead.guestCount ?? "—"} гостей ·{" "}
            {lead.budget ?? "—"}
          </p>
          <div className="field">
            <label>Статус</label>
            <select
              value={lead.status}
              onChange={(e) => changeStatus(lead, e.target.value as Lead["status"])}
              disabled={busyId === lead.id}
            >
              {(Object.keys(STATUS_LABELS) as Lead["status"][]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
