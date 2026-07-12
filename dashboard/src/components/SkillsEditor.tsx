"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

type SkillKey = "packages" | "availability" | "faq" | "partners";

const SKILLS: { key: SkillKey; label: string; description: string }[] = [
  { key: "packages", label: "Пакеты и цены", description: "Бот подсказывает пакеты и цены" },
  { key: "availability", label: "Доступность дат", description: "Бот проверяет свободные даты" },
  { key: "faq", label: "Частые вопросы", description: "Бот отвечает на частые вопросы" },
  { key: "partners", label: "Партнёры", description: "Бот рекомендует партнёров" },
];

export function SkillsEditor() {
  const { profile, loading, error, refetch } = useCompanyProfile();
  const [disabled, setDisabled] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState<SkillKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setDisabled(profile.disabledSkills);
  }, [profile]);

  async function toggle(key: SkillKey) {
    const next = disabled.includes(key) ? disabled.filter((k) => k !== key) : [...disabled, key];
    setBusyKey(key);
    setSaveError(null);
    try {
      const res = await tmaFetch("/api/skills", { method: "PUT", body: JSON.stringify(next) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setDisabled(next);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить");
      await refetch();
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <h1>Навыки</h1>
      <p className="muted">Какие возможности бота включены для клиентов.</p>

      {saveError && <ErrorBanner message={saveError} />}

      {SKILLS.map((skill) => (
        <div key={skill.key} className="card">
          <div className="card-title-row">
            <strong>{skill.label}</strong>
            <input
              type="checkbox"
              checked={!disabled.includes(skill.key)}
              disabled={busyKey === skill.key}
              onChange={() => toggle(skill.key)}
            />
          </div>
          <p className="muted">{skill.description}</p>
        </div>
      ))}
    </div>
  );
}
