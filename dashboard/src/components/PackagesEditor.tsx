"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Package } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

function newPackage(): Package {
  return {
    id: crypto.randomUUID(),
    name: "",
    price: 0,
    currency: "RUB",
    included: [],
    excluded: [],
    guestsMin: null,
    guestsMax: null,
    prepaymentTerms: "",
    cancellationTerms: "",
  };
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function PackagesEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [items, setItems] = useState<Package[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setItems(profile.packages);
  }, [profile]);

  function update(id: string, patch: Partial<Package>) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function add() {
    setItems((prev) => [...prev, newPackage()]);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/packages", {
        method: "PUT",
        body: JSON.stringify(items),
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
      <h1>Пакеты и цены</h1>
      <p className="muted">Пакеты, которые бот предлагает клиентам, с ценами и условиями.</p>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      {items.map((pkg) => (
        <div key={pkg.id} className="card">
          <div className="card-title-row">
            <input
              placeholder="Название пакета (например, Стандарт)"
              value={pkg.name}
              onChange={(e) => update(pkg.id, { name: e.target.value })}
              style={{ flex: 1, fontWeight: 700 }}
            />
            <button className="btn btn-danger" onClick={() => remove(pkg.id)}>
              Удалить
            </button>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Цена</label>
              <input
                type="number"
                min={0}
                value={pkg.price}
                onChange={(e) => update(pkg.id, { price: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Валюта</label>
              <input value={pkg.currency} onChange={(e) => update(pkg.id, { currency: e.target.value })} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Мин. гостей</label>
              <input
                type="number"
                min={0}
                value={pkg.guestsMin ?? ""}
                onChange={(e) => update(pkg.id, { guestsMin: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Макс. гостей</label>
              <input
                type="number"
                min={0}
                value={pkg.guestsMax ?? ""}
                onChange={(e) => update(pkg.id, { guestsMax: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="field">
            <label>Что входит (по одному пункту на строку)</label>
            <textarea
              rows={3}
              value={pkg.included.join("\n")}
              onChange={(e) => update(pkg.id, { included: linesToList(e.target.value) })}
            />
          </div>

          <div className="field">
            <label>Что НЕ входит (по одному пункту на строку)</label>
            <textarea
              rows={3}
              value={pkg.excluded.join("\n")}
              onChange={(e) => update(pkg.id, { excluded: linesToList(e.target.value) })}
            />
          </div>

          <div className="field">
            <label>Условия предоплаты</label>
            <textarea
              rows={2}
              value={pkg.prepaymentTerms}
              onChange={(e) => update(pkg.id, { prepaymentTerms: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Условия отмены/переноса</label>
            <textarea
              rows={2}
              value={pkg.cancellationTerms}
              onChange={(e) => update(pkg.id, { cancellationTerms: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button className="btn btn-ghost" onClick={add}>
        + Добавить пакет
      </button>

      <div style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}
