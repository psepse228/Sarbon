"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { KnowledgeGap } from "@/lib/types";

export function KnowledgeGapsEditor() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmaFetch("/api/knowledge-gaps")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить пробелы (${res.status})`);
        return (await res.json()) as KnowledgeGap[];
      })
      .then((data) => {
        if (!cancelled) setGaps(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить пробелы");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function answer(gap: KnowledgeGap) {
    const answerText = (drafts[gap.id] ?? "").trim();
    if (!answerText) return;
    setBusyId(gap.id);
    setError(null);
    try {
      const res = await tmaFetch(`/api/knowledge-gaps/${gap.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer: answerText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить ответ (${res.status})`);
      }
      setGaps((prev) => prev.filter((g) => g.id !== gap.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить ответ");
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(gap: KnowledgeGap) {
    setBusyId(gap.id);
    setError(null);
    try {
      const res = await tmaFetch(`/api/knowledge-gaps/${gap.id}/dismiss`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось отклонить (${res.status})`);
      }
      setGaps((prev) => prev.filter((g) => g.id !== gap.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отклонить");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Пробелы в знаниях</h1>
      <p className="muted">
        Вопросы клиентов, на которые у бота не нашлось данных. Ответьте — вопрос попадёт в «Вопросы» и бот
        будет использовать его дальше — или отклоните, если он неактуален.
      </p>

      {error && <ErrorBanner message={error} />}

      {gaps.length === 0 && <p className="muted">Открытых пробелов нет.</p>}

      {gaps.map((gap) => (
        <div key={gap.id} className="card">
          <div className="card-title-row">
            <strong>{gap.question}</strong>
            <a href={`/d/conversations/${gap.conversationId}`}>Открыть диалог</a>
          </div>
          <div className="field">
            <label>Ответ</label>
            <textarea
              rows={3}
              value={drafts[gap.id] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [gap.id]: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn btn-primary" onClick={() => answer(gap)} disabled={busyId === gap.id}>
              Ответить
            </button>
            <button className="btn btn-ghost" onClick={() => dismiss(gap)} disabled={busyId === gap.id}>
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
