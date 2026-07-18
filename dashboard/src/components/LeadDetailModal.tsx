"use client";

import { useState } from "react";

import { CloseIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";
import type { Lead } from "@/lib/types";

const STATUS_LABEL_KEY: Record<Lead["status"], string> = {
  new: "leads.columnNew",
  contacted: "leads.columnContacted",
  booked: "leads.columnBooked",
  lost: "leads.columnLost",
};

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

export function LeadDetailModal({
  lead,
  onClose,
  onNotesSaved,
}: {
  lead: Lead;
  onClose: () => void;
  onNotesSaved: (notes: string) => void;
}) {
  const t = useT();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const dirty = notes !== (lead.notes ?? "");

  async function saveNotes() {
    setSaving(true);
    setSaveState("idle");
    try {
      const res = await tmaFetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error();
      onNotesSaved(notes);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("leads.profileTitle")}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t("leads.close")}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-lead-name">
          {lead.name ?? t("leads.noName")}
          <span className={`lead-status-badge`} data-status={lead.status}>
            {t(STATUS_LABEL_KEY[lead.status])}
          </span>
        </div>

        <div className="modal-field-grid">
          <div className="modal-field">
            <span>{t("leads.fieldPhone")}</span>
            <strong>{lead.phone ?? "—"}</strong>
          </div>
          <div className="modal-field">
            <span>{t("leads.fieldDate")}</span>
            <strong>{lead.preferredDate ?? t("leads.noDate")}</strong>
          </div>
          <div className="modal-field">
            <span>{t("leads.fieldGuests")}</span>
            <strong>{lead.guestCount ?? "—"}</strong>
          </div>
          <div className="modal-field">
            <span>{t("leads.fieldBudget")}</span>
            <strong>{lead.budget ?? "—"}</strong>
          </div>
          <div className="modal-field modal-field-wide">
            <span>{t("leads.fieldCreated")}</span>
            <strong>{formatCreatedAt(lead.createdAt)}</strong>
          </div>
        </div>

        <a href={`/d/conversations?conversationId=${lead.conversationId}`} className="btn btn-secondary modal-conversation-link">
          {t("leads.conversation")}
        </a>

        <div className="modal-notes">
          <label htmlFor="lead-notes">{t("leads.notesLabel")}</label>
          <textarea
            id="lead-notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaveState("idle");
            }}
            placeholder={t("leads.notesPlaceholder")}
            rows={5}
          />
          <div className="modal-notes-footer">
            {saveState === "saved" && <span className="modal-notes-status modal-notes-status-ok">{t("leads.notesSaved")}</span>}
            {saveState === "error" && <span className="modal-notes-status modal-notes-status-error">{t("leads.notesSaveError")}</span>}
            <button type="button" className="btn btn-primary" onClick={saveNotes} disabled={!dirty || saving}>
              {t("leads.notesSave")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
