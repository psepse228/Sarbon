"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { BellIcon, ChatIcon, ChevronRightIcon, QuestionIcon } from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";
import type { ConversationSummary, Escalation } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

interface Stats {
  openEscalations: number;
  totalConversations: number;
}

export default function HomePage() {
  const { profile, loading, error } = useCompanyProfile();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [escalationsRes, conversationsRes] = await Promise.all([
          tmaFetch("/api/escalations"),
          tmaFetch("/api/conversations"),
        ]);
        if (!escalationsRes.ok || !conversationsRes.ok) return;

        const escalations: Escalation[] = await escalationsRes.json();
        const conversations: ConversationSummary[] = await conversationsRes.json();

        setStats({
          openEscalations: escalations.filter((e) => !e.notifiedOwner).length,
          totalConversations: conversations.length,
        });
      } catch {
        // This card is a nice-to-have on this page — a failure here shouldn't block the rest of it.
      }
    })();
  }, []);

  const packageCount = profile?.packages.length ?? 0;
  const faqCount = profile?.faq.length ?? 0;

  return (
    <div>
      <section className="hero">
        <p className="hero-eyebrow">Welcome to</p>
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
        <span className="hero-powered-by">powered by Solura</span>
      </section>

      {error && <ErrorBanner message={error} />}

      <div className="card">
        <div className="card-title-row">
          <h3>Работа с клиентами</h3>
        </div>
        <div className="hub-card" style={{ background: "transparent", border: "none", padding: 0 }}>
          <Link href="/conversations" className="hub-row">
            <span className="hub-row-icon">
              <ChatIcon />
            </span>
            <span className="hub-row-label">Диалоги с клиентами</span>
            <span className="pill">{stats ? stats.totalConversations : "—"}</span>
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
          <Link href="/faq" className="hub-row">
            <span className="hub-row-icon">
              <QuestionIcon />
            </span>
            <span className="hub-row-label">Частые вопросы</span>
            <span className="pill">{loading ? "—" : faqCount}</span>
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
          <Link href="/escalations" className="hub-row">
            <span className="hub-row-icon">
              <BellIcon />
            </span>
            <span className="hub-row-label">Эскалации</span>
            <span className="pill">{stats ? stats.openEscalations : "—"}</span>
            <ChevronRightIcon className="hub-row-chevron" />
          </Link>
        </div>
      </div>
    </div>
  );
}
