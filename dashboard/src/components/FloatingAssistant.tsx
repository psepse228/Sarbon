"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { CloseIcon, SparkleIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";

const SUGGESTIONS = ["Как идут дела за сегодня?", "У нас акция — скидка 10% на будни, скажи об этом клиентам"];

/**
 * A persistent floating chat widget, available on every desktop page —
 * additive to the full /d/assistant page (which stays, for anyone who wants
 * the larger surface). Same /api/assistant/chat call as the full page, so
 * behavior on the real bot is identical; only the presentation differs.
 * Collapsed on every fresh page load by design — a chat window staying open
 * across navigation would be visually noisy.
 */
export function FloatingAssistant() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed, time: now() }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await tmaFetch("/api/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ history: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось получить ответ (${res.status})`);
      }
      const { reply } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: reply, time: now() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="floating-assistant-trigger"
        onClick={() => setOpen(true)}
        aria-label={t("assistant.floatingTitle")}
      >
        <SparkleIcon />
      </button>
    );
  }

  return (
    <div className="floating-assistant-window">
      <div className="floating-assistant-header">
        <strong>{t("assistant.floatingTitle")}</strong>
        <button
          type="button"
          className="floating-assistant-close"
          onClick={() => setOpen(false)}
          aria-label={t("assistant.close")}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="floating-assistant-body chat-frame">
        {error && <ErrorBanner message={error} />}
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
      </div>
    </div>
  );
}
