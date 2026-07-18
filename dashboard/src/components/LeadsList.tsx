"use client";

import { useEffect, useState } from "react";

import { DragHandleIcon, NoteIcon } from "@/components/icons";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import { ErrorBanner } from "@/components/StatusBanner";
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";
import type { Lead } from "@/lib/types";

const COLUMNS: { status: Lead["status"]; labelKey: string; accent: string }[] = [
  { status: "new", labelKey: "leads.columnNew", accent: "info" },
  { status: "contacted", labelKey: "leads.columnContacted", accent: "warning" },
  { status: "booked", labelKey: "leads.columnBooked", accent: "accent" },
  { status: "lost", labelKey: "leads.columnLost", accent: "danger" },
];

const NEXT_STATUS: Partial<Record<Lead["status"], Lead["status"]>> = {
  new: "contacted",
  contacted: "booked",
};

const PREV_STATUS: Partial<Record<Lead["status"], Lead["status"]>> = {
  contacted: "new",
  booked: "contacted",
};

function initialFor(name: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

export function LeadsList() {
  const t = useT();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Lead["status"] | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

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
    if (status === lead.status) return;
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

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  if (loading) return <p className="muted">{t("leads.loading")}</p>;

  return (
    <div>
      <h1>{t("leads.title")}</h1>
      <p className="muted">{t("leads.subtitle")}</p>
      <p className="muted leads-drag-hint">{t("leads.dragHint")}</p>

      {error && <ErrorBanner message={error} />}

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnLeads = leads.filter((lead) => lead.status === column.status);
          const prev = PREV_STATUS[column.status];
          const next = NEXT_STATUS[column.status];
          const isDropTarget = dragOverStatus === column.status;

          return (
            <div
              key={column.status}
              className="kanban-column"
              data-accent={column.accent}
              data-drop-active={isDropTarget}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverStatus !== column.status) setDragOverStatus(column.status);
              }}
              onDragLeave={() => setDragOverStatus((prev) => (prev === column.status ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                const lead = leads.find((l) => l.id === dragLeadId);
                if (lead) changeStatus(lead, column.status);
                setDragLeadId(null);
              }}
            >
              <div className="kanban-column-title">
                {t(column.labelKey)} ({columnLeads.length})
              </div>
              {columnLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="card kanban-card"
                  draggable
                  data-dragging={dragLeadId === lead.id}
                  onDragStart={(e) => {
                    setDragLeadId(lead.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragLeadId(null);
                    setDragOverStatus(null);
                  }}
                >
                  <div className="kanban-card-top">
                    <span className="kanban-card-avatar" data-accent={column.accent}>
                      {initialFor(lead.name)}
                    </span>
                    <div className="kanban-card-heading">
                      <div className="kanban-card-name">{lead.name ?? t("leads.noName")}</div>
                      <div className="kanban-card-meta">
                        {lead.phone ?? "—"} · {lead.preferredDate ?? t("leads.noDate")} · {lead.guestCount ?? "—"} {t("leads.guests")}
                      </div>
                    </div>
                    <DragHandleIcon className="kanban-card-drag-handle" />
                  </div>

                  <div className="kanban-card-actions">
                    <a href={`/d/conversations?conversationId=${lead.conversationId}`} className="btn btn-secondary btn-compact">
                      {t("leads.conversation")}
                    </a>
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact btn-icon-only"
                      onClick={() => setOpenLeadId(lead.id)}
                      title={t("leads.openProfile")}
                      aria-label={t("leads.openProfile")}
                    >
                      <NoteIcon />
                      {lead.notes && <span className="kanban-card-notes-dot" />}
                    </button>
                    {prev && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, prev)}
                      >
                        ← {t(COLUMNS.find((c) => c.status === prev)!.labelKey)}
                      </button>
                    )}
                    {next && (
                      <button
                        type="button"
                        className="btn btn-primary btn-compact"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, next)}
                      >
                        {t(COLUMNS.find((c) => c.status === next)!.labelKey)} →
                      </button>
                    )}
                    {column.status === "lost" && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, "contacted")}
                      >
                        {t("leads.restore")}
                      </button>
                    )}
                    {column.status !== "lost" && (
                      <button
                        type="button"
                        className="btn btn-danger btn-compact"
                        disabled={busyId === lead.id}
                        onClick={() => changeStatus(lead, "lost")}
                      >
                        {t("leads.lost")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {columnLeads.length === 0 && <p className="muted kanban-empty">{t("leads.empty")}</p>}
            </div>
          );
        })}
      </div>

      {openLead && (
        <LeadDetailModal
          lead={openLead}
          onClose={() => setOpenLeadId(null)}
          onNotesSaved={(notes) => setLeads((prev) => prev.map((l) => (l.id === openLead.id ? { ...l, notes } : l)))}
        />
      )}
    </div>
  );
}
