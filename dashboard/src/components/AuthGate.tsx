"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { tmaFetch } from "@/lib/telegram/client";

type Status = "loading" | "ok" | "unauthenticated" | "suspended";

/** Gates the dashboard behind auth so it degrades gracefully when opened
 * outside Telegram (PWA / plain browser) without a session cookie yet —
 * instead of every page individually 401ing, show one "log in" prompt.
 *
 * Also blocks a suspended tenant here (v1 billing, no payment processor yet
 * -- see /api/auth/me) rather than adding a check to every API route. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    tmaFetch("/api/auth/me")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setStatus("unauthenticated");
          return;
        }
        const body: { subscriptionStatus?: string } = await res.json().catch(() => ({}));
        setStatus(body.subscriptionStatus === "suspended" ? "suspended" : "ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (pathname === "/login") return <>{children}</>;

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "5rem", gap: "1rem" }}>
        <h1>Вход в Cortège</h1>
        <p className="muted" style={{ textAlign: "center", maxWidth: 280 }}>
          Войдите через Google, чтобы продолжить.
        </p>
        <Link href="/login" className="btn btn-primary">
          Войти через Google
        </Link>
      </div>
    );
  }

  if (status === "suspended") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "5rem", gap: "1rem" }}>
        <h1>Подписка приостановлена</h1>
        <p className="muted" style={{ textAlign: "center", maxWidth: 280 }}>
          Свяжитесь с нами, чтобы возобновить доступ к Cortège.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
