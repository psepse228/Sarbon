"use client";

import { useEffect, useState } from "react";

import { CalendarGrid } from "@/components/CalendarGrid";
import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export default function CalendarPage() {
  const t = useT();
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useCompanyProfile();
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [calendarIdInput, setCalendarIdInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSaved, setConnectSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<number | null>(null);

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
    tmaFetch("/api/calendar/service-account")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось получить email сервисного аккаунта (${res.status})`);
        return (await res.json()) as { email: string };
      })
      .then((body) => setServiceAccountEmail(body.email))
      .catch((err) => setEmailError(err instanceof Error ? err.message : "Не удалось получить email"));
  }, []);

  useEffect(() => {
    if (profile) setCalendarIdInput(profile.googleCalendarId ?? "");
  }, [profile]);

  async function connect() {
    setConnecting(true);
    setConnectError(null);
    setConnectSaved(false);
    try {
      const res = await tmaFetch("/api/calendar/connect", {
        method: "PUT",
        body: JSON.stringify({ calendarId: calendarIdInput || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setConnectSaved(true);
      await refetchProfile();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setConnecting(false);
    }
  }

  async function sync() {
    if (!profile?.googleCalendarId) return;
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await tmaFetch("/api/calendar/sync", {
        method: "POST",
        body: JSON.stringify({ calendarId: profile.googleCalendarId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось синхронизировать (${res.status})`);
      }
      const body: { syncedCount: number } = await res.json();
      setSyncResult(body.syncedCount);
      loadEntries();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Не удалось синхронизировать");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <h1>{t("calendar.title")}</h1>
      <p className="muted">{t("calendar.subtitle")}</p>

      <div className="card">
        <div className="card-title-row">
          <h3>{t("calendar.googleCalendar")}</h3>
        </div>
        {emailError && <ErrorBanner message={emailError} />}
        {serviceAccountEmail && (
          <p className="muted">
            {t("calendar.shareAccess")} <strong>{serviceAccountEmail}</strong>
          </p>
        )}
        <div className="field">
          <label>{t("calendar.calendarIdLabel")}</label>
          <input value={calendarIdInput} onChange={(e) => setCalendarIdInput(e.target.value)} placeholder="you@gmail.com" />
        </div>
        {connectError && <ErrorBanner message={connectError} />}
        {connectSaved && <SuccessBanner message={t("calendar.saved")} />}
        <button className="btn btn-secondary" onClick={connect} disabled={connecting}>
          {connecting ? t("calendar.saving") : t("calendar.save")}
        </button>
        {profile?.googleCalendarId && (
          <div style={{ marginTop: "0.9rem" }}>
            {syncError && <ErrorBanner message={syncError} />}
            {syncResult !== null && (
              <SuccessBanner message={t("calendar.syncedCount").replace("{count}", String(syncResult))} />
            )}
            <button className="btn btn-primary" onClick={sync} disabled={syncing}>
              {syncing ? t("calendar.syncing") : t("calendar.syncNow")}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        {(loadingEntries || profileLoading) && <p className="muted">{t("calendar.loading")}</p>}
        {entriesError && <ErrorBanner message={entriesError} />}
        {profileError && <ErrorBanner message={profileError} />}
        {!loadingEntries && !entriesError && <CalendarGrid entries={entries} onChanged={loadEntries} />}
      </div>
    </div>
  );
}
