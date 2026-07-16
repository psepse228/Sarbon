"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";
import type { Lead } from "@/lib/types";

const COLUMNS: { status: Lead["status"]; labelKey: string }[] = [
  { status: "new", labelKey: "leads.columnNew" },
  { status: "contacted", labelKey: "leads.columnContacted" },
  { status: "booked", labelKey: "leads.columnBooked" },
  { status: "lost", labelKey: "leads.columnLost" },
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
  const t = useT();
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

  if (loading) return <p className="muted">{t("leads.loading")}</p>;

  return (
    <div>
      <h1>{t("leads.title")}</h1>
      <p className="muted">{t("leads.subtitle")}</p>

      {error && <ErrorBanner message={error} />}

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnLeads = leads.filter((lead) => lead.status === column.status);
          const prev = PREV_STATUS[column.status];
          const next = NEXT_STATUS[column.status];

          return (
            <div key={column.status} className="kanban-column">
              <div className="kanban-column-title">
                {t(column.labelKey)} ({columnLeads.length})
              </div>
              {columnLeads.map((lead) => (
                <div key={lead.id} className="card">
                  <div className="kanban-card-name">{lead.name ?? t("leads.noName")}</div>
                  <div className="kanban-card-meta">
                    {lead.phone ?? "—"} · {lead.preferredDate ?? t("leads.noDate")} · {lead.guestCount ?? "—"} {t("leads.guests")}
                  </div>
                  <div className="kanban-card-actions">
                    <a href={`/d/conversations?conversationId=${lead.conversationId}`} className="btn btn-secondary">
                      {t("leads.conversation")}
                    </a>
                    {prev && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, prev)}
                      >
                        ← {t(COLUMNS.find((c) => c.status === prev)!.labelKey)}
                      </button>
                    )}
                    {next && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, next)}
                      >
                        {t(COLUMNS.find((c) => c.status === next)!.labelKey)} →
                      </button>
                    )}
                    {column.status === "lost" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, "contacted")}
                      >
                        {t("leads.restore")}
                      </button>
                    )}
                    {column.status !== "lost" && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, "lost")}
                      >
                        {t("leads.lost")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {columnLeads.length === 0 && <p className="muted">{t("leads.empty")}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
