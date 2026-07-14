"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Partner } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

function newPartner(): Partner {
  return { id: crypto.randomUUID(), category: "", name: "", contact: "", imageUrl: null };
}

export function PartnersEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [items, setItems] = useState<Partner[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setItems(profile.partners);
  }, [profile]);

  function update(id: string, patch: Partial<Partner>) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function add() {
    setItems((prev) => [...prev, newPartner()]);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/partners", { method: "PUT", body: JSON.stringify(items) });
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
      <div className="card-title-row">
        <h3>Партнёры</h3>
      </div>
      <p className="muted">Кортеж, флористы, фотографы и другие рекомендуемые партнёры.</p>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="catalog-grid">
        {items.map((partner) => (
          <div key={partner.id} className="card">
            {partner.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.imageUrl} alt={partner.name || "Партнёр"} className="catalog-card-image" />
            ) : (
              <div className="catalog-card-image-placeholder">Нет фото</div>
            )}
            <div className="card-title-row">
              <input
                placeholder="Категория (например, Флористы)"
                value={partner.category}
                onChange={(e) => update(partner.id, { category: e.target.value })}
                style={{ flex: 1 }}
              />
              <button className="btn btn-danger" onClick={() => remove(partner.id)}>
                Удалить
              </button>
            </div>
            <div className="field">
              <label>Ссылка на фото</label>
              <input
                placeholder="https://…"
                value={partner.imageUrl ?? ""}
                onChange={(e) => update(partner.id, { imageUrl: e.target.value || null })}
              />
            </div>
            <div className="field">
              <label>Название</label>
              <input value={partner.name} onChange={(e) => update(partner.id, { name: e.target.value })} />
            </div>
            <div className="field">
              <label>Контакт</label>
              <input value={partner.contact} onChange={(e) => update(partner.id, { contact: e.target.value })} />
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" onClick={add} style={{ marginTop: "1rem" }}>
        + Добавить партнёра
      </button>

      <div style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}
