"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export function PoliciesEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setText(profile.policies);
  }, [profile]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/policies", {
        method: "PUT",
        body: JSON.stringify({ policies: text }),
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
    <div>
      <h1>Политики</h1>
      <p className="muted">
        Общие условия: предоплата, отмена/перенос, штрафы, подрядчики, парковка, ограничения по времени.
      </p>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="card">
        <textarea className="policies" value={text} onChange={(e) => setText(e.target.value)} />
      </div>

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? "Сохранение…" : "Сохранить изменения"}
      </button>
    </div>
  );
}
