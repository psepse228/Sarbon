"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export function CompanyInfoEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [socials, setSocials] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setCompanyName(profile.companyName ?? "");
    setAddress(profile.address ?? "");
    setPhone(profile.phone ?? "");
    setSocials(profile.socials ?? "");
  }, [profile]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/company-info", {
        method: "PUT",
        body: JSON.stringify({ companyName, address, phone, socials }),
      });
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
    <div className="card">
      <div className="card-title-row">
        <h3>О компании</h3>
      </div>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="field">
        <label>Название</label>
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Например, Cortège" />
      </div>
      <div className="field">
        <label>Адрес</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Город, улица, дом" />
      </div>
      <div className="field">
        <label>Телефон</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000-00-00" />
      </div>
      <div className="field">
        <label>Соцсети / сайт (по одному на строку)</label>
        <textarea
          rows={3}
          value={socials}
          onChange={(e) => setSocials(e.target.value)}
          placeholder={"Instagram: @venue\nСайт: venue.ru"}
        />
      </div>

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </div>
  );
}
