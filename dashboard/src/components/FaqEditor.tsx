"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { FaqEntry } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

function newEntry(): FaqEntry {
  return { id: crypto.randomUUID(), question: "", answer: "" };
}

export function FaqEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [items, setItems] = useState<FaqEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setItems(profile.faq);
  }, [profile]);

  function update(id: string, patch: Partial<FaqEntry>) {
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((e) => e.id !== id));
  }

  function add() {
    setItems((prev) => [...prev, newEntry()]);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/faq", { method: "PUT", body: JSON.stringify(items) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <h1>Частые вопросы</h1>
      <p className="muted">Вопросы и ответы, которые бот использует, отвечая клиентам.</p>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      {items.map((entry) => (
        <div key={entry.id} className="card">
          <div className="card-title-row">
            <strong>Вопрос</strong>
            <button className="btn btn-danger" onClick={() => remove(entry.id)}>
              Удалить
            </button>
          </div>
          <div className="field">
            <textarea
              rows={2}
              value={entry.question}
              onChange={(e) => update(entry.id, { question: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Ответ</label>
            <textarea
              rows={3}
              value={entry.answer}
              onChange={(e) => update(entry.id, { answer: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button className="btn btn-ghost" onClick={add}>
        + Добавить вопрос
      </button>

      <div style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}
