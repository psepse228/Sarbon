"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AnalyticsIcon, ChatIcon } from "@/components/icons";
import { Sparkline } from "@/components/Sparkline";
import { ErrorBanner } from "@/components/StatusBanner";
import { useT } from "@/lib/i18n/LocaleProvider";
import {
  computeDashboardStats,
  parseLocalDate,
  selectDailyTrend,
  selectRecentActivity,
  selectUpcomingAvailability,
  type DashboardStats,
  type RecentActivityItem,
} from "@/lib/stats";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry, ConversationSummary, Escalation } from "@/lib/types";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const TIME_FORMAT = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export default function DesktopOverviewPage() {
  const t = useT();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<AvailabilityEntry[]>([]);
  const [conversationsTrend, setConversationsTrend] = useState<number[]>([]);
  const [escalationsTrend, setEscalationsTrend] = useState<number[]>([]);
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
          throw new Error(t("overview.loadError"));
        }

        const escalations: Escalation[] = await escalationsRes.json();
        const conversations: ConversationSummary[] = await conversationsRes.json();
        const availability: AvailabilityEntry[] = await availabilityRes.json();

        setStats(computeDashboardStats(conversations, escalations, availability));
        setActivity(selectRecentActivity(conversations, escalations, 5));
        setUpcoming(selectUpcomingAvailability(availability, 7));
        setConversationsTrend(selectDailyTrend(conversations, 7, (c) => c.createdAt));
        setEscalationsTrend(selectDailyTrend(escalations, 7, (e) => e.createdAt));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("overview.loadError"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolutionRate =
    stats && stats.totalConversations > 0
      ? Math.round((stats.conversationsWithoutEscalation / stats.totalConversations) * 100)
      : null;

  return (
    <div>
      <h1>{t("overview.title")}</h1>
      <p className="muted">{t("overview.subtitle")}</p>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <div className="desktop-kpi-row">
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
            <div className="kpi-label">{t("overview.openEscalations")}</div>
            <div className="kpi-sparkline">
              <Sparkline values={escalationsTrend} color="var(--color-warning)" />
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.totalConversations}</div>
            <div className="kpi-label">{t("overview.totalConversations")}</div>
            <div className="kpi-sparkline">
              <Sparkline values={conversationsTrend} color="var(--color-accent)" />
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-good">{resolutionRate ?? "—"}%</div>
            <div className="kpi-label">{t("overview.botHandlesAlone")}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.upcomingAvailable}</div>
            <div className="kpi-label">{t("overview.freeDates")}</div>
          </div>
        </div>
      )}

      {stats && (
        <div className="desktop-two-pane" style={{ marginTop: "1rem" }}>
          <div className="card">
            <div className="card-title-row">
              <h3><AnalyticsIcon /> {t("overview.autonomy")}</h3>
            </div>
            <div className="meter-row">
              <span className="meter-label">{t("overview.autonomy")}</span>
              <span className="meter-value">{resolutionRate ?? "—"}%</span>
            </div>
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${resolutionRate ?? 0}%` }} />
            </div>
            <p className="meter-caption">
              {t("overview.autonomyCaption")
                .replace("{count}", String(stats.conversationsWithoutEscalation))
                .replace("{total}", String(stats.totalConversations))}
            </p>
          </div>

          <div className="card">
            <div className="card-title-row">
              <h3><ChatIcon /> {t("overview.recentConversations")}</h3>
            </div>
            {activity.length === 0 ? (
              <p className="muted">{t("overview.noConversationsYet")}</p>
            ) : (
              <div className="activity-list">
                {activity.map((item) => (
                  <Link
                    key={item.conversationId}
                    href={`/d/conversations?conversationId=${item.conversationId}`}
                    className="activity-row"
                  >
                    <div className="activity-main">
                      <span className="activity-client">{t("overview.client")} {item.clientId}</span>
                      <span className="activity-channel">{item.channel}</span>
                    </div>
                    <div className="activity-meta">
                      {item.lastMessageAt && (
                        <span className="activity-time">{TIME_FORMAT.format(new Date(item.lastMessageAt))}</span>
                      )}
                      <span className="activity-status-chip" data-status={item.status}>
                        {item.status === "escalated" ? t("overview.escalated") : t("overview.resolved")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card avail-panel">
          <div className="card-title-row">
            <h3>{t("overview.upcomingDates")}</h3>
          </div>
          <div className="avail-strip">
            {upcoming.map((entry) => {
              const day = parseLocalDate(entry.date);
              return (
                <div key={entry.id} className="avail-day" data-free={entry.isAvailable}>
                  <div className="avail-dow">{WEEKDAY_FORMAT.format(day)}</div>
                  <div className="avail-date">{day.getDate()}</div>
                  <div className="avail-label">{entry.isAvailable ? t("overview.free") : t("overview.busy")}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
