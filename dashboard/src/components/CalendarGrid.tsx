"use client";

import { useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { parseLocalDate } from "@/lib/stats";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_FORMAT = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface CalendarGridProps {
  entries: AvailabilityEntry[];
  onChanged: () => void;
}

export function CalendarGrid({ entries, onChanged }: CalendarGridProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [eventDetails, setEventDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const entryByDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Monday-first

  const cells: { day: number | null; key: string | null }[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, key: null });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, key: toDateKey(year, month, day) });

  function selectDay(key: string) {
    setSelectedDate(key);
    setSaved(false);
    const existing = entryByDate.get(key);
    setIsAvailable(existing?.isAvailable ?? false);
    setEventDetails(existing?.eventDetails ?? "");
  }

  async function save() {
    if (!selectedDate) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/availability", {
        method: "PUT",
        body: JSON.stringify({ date: selectedDate, isAvailable, eventDetails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="calendar-grid-header">
        <span className="calendar-grid-month">{MONTH_FORMAT.format(cursor)}</span>
        <div className="calendar-grid-nav">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Следующий месяц"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {DOW_LABELS.map((label) => (
          <div key={label} className="calendar-grid-dow">
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (cell.day === null || cell.key === null) {
            return <div key={`blank-${index}`} className="calendar-grid-day" data-empty="true" />;
          }
          const entry = entryByDate.get(cell.key);
          const status = entry ? (entry.isAvailable ? "available" : "booked") : undefined;
          return (
            <div
              key={cell.key}
              className="calendar-grid-day"
              data-status={status}
              data-selected={selectedDate === cell.key}
              onClick={() => selectDay(cell.key as string)}
            >
              {cell.day}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <div className="calendar-day-editor">
          <div className="card-title-row">
            <strong>{parseLocalDate(selectedDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</strong>
          </div>
          {error && <ErrorBanner message={error} />}
          {saved && <SuccessBanner message="Сохранено" />}
          <label className="toggle-switch-row">
            <span>Свободно</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
              <span className="toggle-switch-track" />
              <span className="toggle-switch-knob" />
            </label>
          </label>
          <div className="field">
            <label>Заметка</label>
            <input value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Например, забронировано" />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      )}
    </div>
  );
}
