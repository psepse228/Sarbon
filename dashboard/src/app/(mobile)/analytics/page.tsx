"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { BellIcon, ChatIcon, ChevronRightIcon, QuestionIcon } from "@/components/icons";
import { computeDashboardStats, type DashboardStats } from "@/lib/stats";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export default function AnalyticsPage() {
  const { profile } = useCompanyProfile();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [escalationsRes, conversationsRes, availabilityRes] = await Promise.all([
          tmaFetch("/api/escalations"),
          tmaFetch("/api/conversations"),
          tmaFetch("/api/availability"),
        ]);
        if (!escalationsRes.ok || !conversationsRes.ok || !availabilityRes.ok) {
          throw new Error("Не удалось загрузить аналитику");
        }

        const escalations: Escalation[] = await escalationsRes.json();
        const conversations: ConversationSummary[] = await conversationsRes.json();
        const availability: AvailabilityEntry[] = await availabilityRes.json();

        setStats(computeDashboardStats(conversations, escalations, availability));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить аналитику");
      }
    })();
  }, []);

  const resolutionRate =
    stats && stats.totalConversations > 0
      ? Math.round((stats.conversationsWithoutEscalation / stats.totalConversations) * 100)
      : null;
  const faqCount = profile?.faq.length ?? 0;

  return (
    <div>
      <h1>Аналитика</h1>
      <p className="muted">Как бот и вы справляетесь с клиентами.</p>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <>
          <div className="card">
            <div className="meter-row">
              <span className="meter-label">Бот справляется сам</span>
              <span className="meter-value">{resolutionRate ?? "—"}%</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${resolutionRate ?? 0}%` }} />
            </div>
            <p className="meter-caption">
              {stats.conversationsWithoutEscalation} из {stats.totalConversations} диалогов закрыты без эскалации на человека
            </p>
          </div>

          <div className="card">
            <div className="card-title-row">
              <h3>Эскалации</h3>
            </div>
            <div className="kpi-row">
              <div className="kpi-tile">
                <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
                <div className="kpi-label">открыто</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-value kpi-value-good">{stats.resolvedEscalations}</div>
                <div className="kpi-label">решено</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-value">{stats.upcomingAvailable}</div>
                <div className="kpi-label">свободных дат</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="hub-card" style={{ background: "transparent", border: "none", padding: 0 }}>
          <Link href="/conversations" className="hub-row">
            <span className="hub-row-icon">
              <ChatIcon />
            </span>
            <span className="hub-row-label">Диалоги с клиентами</span>
            {stats && <span className="pill">{stats.totalConversations}</span>}
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
          <Link href="/faq" className="hub-row">
            <span className="hub-row-icon">
              <QuestionIcon />
            </span>
            <span className="hub-row-label">Частые вопросы</span>
            <span className="pill">{faqCount}</span>
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
          <Link href="/escalations" className="hub-row">
            <span className="hub-row-icon">
              <BellIcon />
            </span>
            <span className="hub-row-label">Эскалации</span>
            {stats && <span className="pill">{stats.openEscalations}</span>}
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
        </div>
      </div>
    </div>
  );
}
