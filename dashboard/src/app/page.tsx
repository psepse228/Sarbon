"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DevModeBanner, ErrorBanner } from "@/components/StatusBanner";
import { isRunningInTelegram } from "@/lib/telegram/client";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

const SECTIONS = [
  { href: "/packages", label: "Пакеты и цены", countKey: "packages" as const },
  { href: "/faq", label: "Частые вопросы", countKey: "faq" as const },
  { href: "/partners", label: "Партнёры", countKey: "partners" as const },
];

export default function HomePage() {
  const { profile, loading, error } = useCompanyProfile();
  const [inTelegram, setInTelegram] = useState(true);

  useEffect(() => {
    isRunningInTelegram().then(setInTelegram);
  }, []);

  return (
    <div>
      <h1>Панель владельца</h1>
      <p className="muted">
        Управление данными, которыми пользуется бот при ответах клиентам: пакеты,
        вопросы, партнёры и политики ресторана.
      </p>

      {!inTelegram && <DevModeBanner />}
      {error && <ErrorBanner message={error} />}

      <div className="card">
        <div className="card-title-row">
          <h3>Статус профиля</h3>
        </div>
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : profile ? (
          <>
            <p className="muted">
              Последнее обновление:{" "}
              {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString("ru-RU") : "ещё не сохранялось"}
            </p>
            {SECTIONS.map((section) => (
              <div key={section.href} className="card-title-row">
                <Link href={section.href}>{section.label}</Link>
                <span className="pill">{profile[section.countKey].length}</span>
              </div>
            ))}
            <div className="card-title-row">
              <Link href="/policies">Политики</Link>
              <span className="pill">{profile.policies ? "заполнено" : "пусто"}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
