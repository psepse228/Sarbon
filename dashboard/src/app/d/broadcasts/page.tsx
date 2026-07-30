"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { useLocale, useT } from "@/lib/i18n/LocaleProvider";
import { pluralize } from "@/lib/i18n/pluralize";
import { tmaFetch } from "@/lib/telegram/client";
import type { Broadcast, BroadcastAudience } from "@/lib/types";

// "получателей" was always used as a flat suffix regardless of count --
// grammatically wrong for most numbers in Russian (e.g. "3 получателей",
// "91 получателей" should read "получателя"/"получатель"). RECIPIENT_FORMS
// covers both locales; pluralize() picks the right one per count.
const RECIPIENT_FORMS: Record<"ru" | "en", [string, string, string]> = {
  ru: ["получатель", "получателя", "получателей"],
  en: ["recipient", "recipients", "recipients"],
};

export default function BroadcastsPage() {
  const t = useT();
  const { locale } = useLocale();
  const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
    all: t("broadcasts.audienceAll"),
    leads_new: t("broadcasts.audienceLeadsNew"),
    leads_contacted: t("broadcasts.audienceLeadsContacted"),
    leads_booked: t("broadcasts.audienceLeadsBooked"),
  };
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<BroadcastAudience>("all");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  function loadBroadcasts() {
    tmaFetch("/api/broadcasts")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить рассылки (${res.status})`);
        return (await res.json()) as Broadcast[];
      })
      .then(setBroadcasts)
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить рассылки"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBroadcasts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    setSending(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await tmaFetch("/api/broadcasts", {
        method: "POST",
        body: JSON.stringify({ audience, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось отправить рассылку (${res.status})`);
      }
      const body: { recipientCount: number } = await res.json();
      setLastResult(body.recipientCount);
      setMessage("");
      loadBroadcasts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить рассылку");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="muted">{t("broadcasts.loading")}</p>;

  return (
    <div>
      <h1>{t("broadcasts.title")}</h1>
      <p className="muted">{t("broadcasts.subtitle")}</p>

      {error && <ErrorBanner message={error} />}

      <div className="card">
        <div className="field">
          <label>{t("broadcasts.audienceLabel")}</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as BroadcastAudience)}>
            {(Object.keys(AUDIENCE_LABELS) as BroadcastAudience[]).map((key) => (
              <option key={key} value={key}>
                {AUDIENCE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("broadcasts.messageLabel")}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={t("broadcasts.messagePlaceholder")}
          />
        </div>
        <button type="button" className="btn btn-primary" disabled={sending || message.trim().length === 0} onClick={send}>
          {sending ? t("broadcasts.sending") : t("broadcasts.send")}
        </button>
        {lastResult !== null && (
          <p className="muted">{t("broadcasts.sentTo").replace("{count}", String(lastResult))}</p>
        )}
      </div>

      <h3>{t("broadcasts.history")}</h3>
      {broadcasts.length === 0 && <p className="muted">{t("broadcasts.noneYet")}</p>}
      {broadcasts.map((b) => (
        <div key={b.id} className="card">
          <p>{b.message}</p>
          <p className="muted">
            {AUDIENCE_LABELS[b.audience]} · {b.recipientCount} {pluralize(b.recipientCount, locale, RECIPIENT_FORMS[locale])} ·{" "}
            {new Date(b.createdAt).toLocaleString("ru-RU")}
          </p>
        </div>
      ))}
    </div>
  );
}
