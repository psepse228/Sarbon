"use client";

import { ErrorBanner } from "@/components/StatusBanner";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export default function HomePage() {
  const { profile, loading, error } = useCompanyProfile();

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
    </div>
  );
}
