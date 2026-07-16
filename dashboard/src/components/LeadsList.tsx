"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Lead } from "@/lib/types";

const COLUMNS: { status: Lead["status"]; label: string }[] = [
  { status: "new", label: "Новые" },
  { status: "contacted", label: "В работе" },
  { status: "booked", label: "Забронировано" },
  { status: "lost", label: "Потеряно" },
];

const NEXT_STATUS: Partial<Record<Lead["status"], Lead["status"]>> = {
  new: "contacted",
  contacted: "booked",
};

const PREV_STATUS: Partial<Record<Lead["status"], Lead["status"]>> = {
  contacted: "new",
  booked: "contacted",
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
        Клиенты, которые проявили намерение забронировать. Двигайте карточку по мере работы с заявкой.
      </p>

      {error && <ErrorBanner message={error} />}

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnLeads = leads.filter((lead) => lead.status === column.status);
          const prev = PREV_STATUS[column.status];
          const next = NEXT_STATUS[column.status];

          return (
            <div key={column.status} className="kanban-column">
              <div className="kanban-column-title">
                {column.label} ({columnLeads.length})
              </div>
              {columnLeads.map((lead) => (
                <div key={lead.id} className="card">
                  <div className="kanban-card-name">{lead.name ?? "Без имени"}</div>
                  <div className="kanban-card-meta">
                    {lead.phone ?? "—"} · {lead.preferredDate ?? "дата не указана"} · {lead.guestCount ?? "—"} гостей
                  </div>
                  <div className="kanban-card-actions">
                    <a href={`/d/conversations?conversationId=${lead.conversationId}`} className="btn btn-secondary">
                      Диалог
                    </a>
                    {prev && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, prev)}
                      >
                        ← {COLUMNS.find((c) => c.status === prev)?.label}
                      </button>
                    )}
                    {next && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, next)}
                      >
                        {COLUMNS.find((c) => c.status === next)?.label} →
                      </button>
                    )}
                    {column.status === "lost" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, "contacted")}
                      >
                        Восстановить
                      </button>
                    )}
                    {column.status !== "lost" && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, "lost")}
                      >
                        Потерян
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {columnLeads.length === 0 && <p className="muted">Пусто</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
