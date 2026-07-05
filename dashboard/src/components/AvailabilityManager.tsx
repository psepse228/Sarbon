"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AvailabilityManager() {
  const [items, setItems] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [date, setDate] = useState(todayIso());
  const [isAvailable, setIsAvailable] = useState(false);
  const [eventDetails, setEventDetails] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await tmaFetch("/api/availability");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setItems(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить даты");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addOrUpdate() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await tmaFetch("/api/availability", {
        method: "PUT",
        body: JSON.stringify({ date, isAvailable, eventDetails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setEventDetails("");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      const res = await tmaFetch(`/api/availability?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setItems(previous);
    }
  }

  return (
    <div>
      <h1>Доступность дат</h1>
      <p className="muted">Отметьте, какие даты заняты, а какие свободны для бронирования.</p>

      {error && <ErrorBanner message={error} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="card">
        <div className="field">
          <label>Дата (ГГГГ-ММ-ДД)</label>
          <input
            type="text"
            inputMode="numeric"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="2026-08-15"
          />
        </div>
        <div className="field">
          <label>Статус</label>
          <div className="segmented">
            <button data-active={!isAvailable} onClick={() => setIsAvailable(false)} type="button">
              Занято
            </button>
            <button data-active={isAvailable} onClick={() => setIsAvailable(true)} type="button">
              Свободно
            </button>
          </div>
        </div>
        <div className="field">
          <label>Детали (необязательно)</label>
          <input
            value={eventDetails}
            onChange={(e) => setEventDetails(e.target.value)}
            placeholder="Например: свадьба на 120 гостей"
          />
        </div>
        <button className="btn btn-primary" onClick={addOrUpdate} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить дату"}
        </button>
      </div>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="muted">Дат пока нет.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="card">
            <div className="card-title-row">
              <strong>{new Date(item.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</strong>
              <span className="pill">{item.isAvailable ? "Свободно" : "Занято"}</span>
            </div>
            {item.eventDetails && <p className="muted">{item.eventDetails}</p>}
            <button className="btn btn-danger" onClick={() => remove(item.id)}>
              Удалить
            </button>
          </div>
        ))
      )}
    </div>
  );
}
