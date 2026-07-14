"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { tmaFetch } from "@/lib/telegram/client";

type Status = "loading" | "ok" | "unauthenticated";

/** Gates the dashboard behind auth so it degrades gracefully when opened
 * outside Telegram (PWA / plain browser) without a session cookie yet —
 * instead of every page individually 401ing, show one "log in" prompt. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    tmaFetch("/api/auth/me")
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "ok" : "unauthenticated");
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

  return <>{children}</>;
}
