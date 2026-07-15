"use client";

import { useEffect, useState } from "react";

import { CalendarGrid } from "@/components/CalendarGrid";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { ErrorBanner } from "@/components/StatusBanner";
import { PoliciesEditor } from "@/components/PoliciesEditor";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";

export default function CompanyProfilePage() {
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  function loadEntries() {
    setLoadingEntries(true);
    tmaFetch("/api/availability")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить даты (${res.status})`);
        return (await res.json()) as AvailabilityEntry[];
      })
      .then(setEntries)
      .catch((err) => setEntriesError(err instanceof Error ? err.message : "Не удалось загрузить даты"))
      .finally(() => setLoadingEntries(false));
  }

  useEffect(() => {
    loadEntries();
  }, []);

  return (
    <div>
      <h1>Профиль компании</h1>
      <p className="muted">Данные о заведении, политики и календарь доступности.</p>

      <CompanyInfoEditor />
      <PoliciesEditor />

      <div className="card">
        {loadingEntries && <p className="muted">Загрузка…</p>}
        {entriesError && <ErrorBanner message={entriesError} />}
        {!loadingEntries && !entriesError && <CalendarGrid entries={entries} onChanged={loadEntries} />}
      </div>
    </div>
  );
}
