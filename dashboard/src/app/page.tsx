"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DevModeBanner, ErrorBanner } from "@/components/StatusBanner";
import { QuestionIcon, TagIcon, UsersIcon } from "@/components/icons";
import { isRunningInTelegram, tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

const SECTIONS = [
  { href: "/packages", label: "Пакеты и цены", countKey: "packages" as const },
  { href: "/faq", label: "Частые вопросы", countKey: "faq" as const },
  { href: "/partners", label: "Партнёры", countKey: "partners" as const },
];

const QUICK_ACTIONS = [
  { href: "/packages", label: "Пакеты", Icon: TagIcon, primary: true },
  { href: "/faq", label: "Вопросы", Icon: QuestionIcon },
  { href: "/partners", label: "Партнёры", Icon: UsersIcon },
];

interface Stats {
  openEscalations: number;
  totalConversations: number;
  upcomingAvailable: number;
}

export default function HomePage() {
  const { profile, loading, error } = useCompanyProfile();
  const [inTelegram, setInTelegram] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    isRunningInTelegram().then(setInTelegram);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [escalationsRes, conversationsRes, availabilityRes] = await Promise.all([
          tmaFetch("/api/escalations"),
          tmaFetch("/api/conversations"),
          tmaFetch("/api/availability"),
        ]);
        if (!escalationsRes.ok || !conversationsRes.ok || !availabilityRes.ok) return;

        const escalations: Escalation[] = await escalationsRes.json();
        const conversations: ConversationSummary[] = await conversationsRes.json();
        const availability: AvailabilityEntry[] = await availabilityRes.json();
        const today = new Date().toISOString().slice(0, 10);

        setStats({
          openEscalations: escalations.filter((e) => !e.notifiedOwner).length,
          totalConversations: conversations.length,
          upcomingAvailable: availability.filter((a) => a.isAvailable && a.date >= today).length,
        });
      } catch {
        // Analytics is a nice-to-have on this page — a failure here shouldn't block the rest of it.
      }
    })();
  }, []);

  const packageCount = profile?.packages.length ?? 0;
  const faqCount = profile?.faq.length ?? 0;

  return (
    <div>
      <section className="hero">
        <span className="hero-orb hero-orb-a" aria-hidden="true" />
        <span className="hero-orb hero-orb-b" aria-hidden="true" />
        <span className="hero-orb hero-orb-c" aria-hidden="true" />
        <p className="hero-eyebrow">Добро пожаловать в</p>
        <h1 className="hero-title">Cortège</h1>
        <div className="hero-stats">
          <div>
            <div className="hero-stat-value">{loading ? "—" : packageCount}</div>
            <div className="hero-stat-label">пакетов</div>
          </div>
          <div>
            <div className="hero-stat-value">{loading ? "—" : faqCount}</div>
            <div className="hero-stat-label">вопросов</div>
          </div>
        </div>
      </section>

      {!inTelegram && <DevModeBanner />}
      {error && <ErrorBanner message={error} />}

      {stats && (
        <div className="card">
          <div className="card-title-row">
            <h3>Аналитика</h3>
          </div>
          <div style={{ display: "flex", gap: "1.6rem" }}>
            <Link href="/escalations" style={{ color: "inherit" }}>
              <div className="hero-stat-value">{stats.openEscalations}</div>
              <div className="hero-stat-label">открытых эскалаций</div>
            </Link>
            <Link href="/conversations" style={{ color: "inherit" }}>
              <div className="hero-stat-value">{stats.totalConversations}</div>
              <div className="hero-stat-label">диалогов</div>
            </Link>
            <Link href="/availability" style={{ color: "inherit" }}>
              <div className="hero-stat-value">{stats.upcomingAvailable}</div>
              <div className="hero-stat-label">свободных дат</div>
            </Link>
          </div>
        </div>
      )}

      <div className="icon-actions">
        {QUICK_ACTIONS.map(({ href, label, Icon, primary }) => (
          <Link key={href} href={href} className="icon-action" data-primary={primary}>
            <span className="icon-action-circle">
              <Icon />
            </span>
            <span className="icon-action-label">{label}</span>
          </Link>
        ))}
      </div>

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
