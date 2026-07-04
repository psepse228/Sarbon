"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BOT_USERNAME = "solura_cortegebot";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.onTelegramAuth = async (user: Record<string, unknown>) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/telegram-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Не удалось войти (${res.status})`);
        }
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось войти");
      }
    };

    const container = document.getElementById("telegram-login-container");
    if (!container) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    // Deliberately NOT setting data-request-access="write" — we only need
    // to identify the owner, not send them messages as this bot. Requesting
    // write access makes Telegram try to deliver a confirmation *from the
    // bot*, which silently fails if the user has never started a chat with
    // it (bots can't message users who haven't messaged them first).
    container.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "5rem", gap: "0.75rem" }}>
      <h1>Вход в Cortège</h1>
      <p className="muted" style={{ textAlign: "center", maxWidth: 280 }}>
        Войдите через Telegram, чтобы открыть панель владельца.
      </p>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div id="telegram-login-container" style={{ marginTop: "1.5rem" }} />
    </div>
  );
}
