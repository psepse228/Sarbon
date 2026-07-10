"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { computeDashboardStats, type DashboardStats } from "@/lib/stats";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

export default function DesktopOverviewPage() {
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

  return (
    <div>
      <h1>Обзор</h1>
      <p className="muted">Как бот и вы справляетесь с клиентами.</p>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <div className="desktop-kpi-row">
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
            <div className="kpi-label">открытых эскалаций</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.totalConversations}</div>
            <div className="kpi-label">диалогов всего</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-good">{resolutionRate ?? "—"}%</div>
            <div className="kpi-label">бот справляется сам</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.upcomingAvailable}</div>
            <div className="kpi-label">свободных дат</div>
          </div>
        </div>
      )}
    </div>
  );
}
