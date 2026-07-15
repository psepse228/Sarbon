"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";

const SUGGESTIONS = ["Как идут дела за сегодня?", "У нас акция — скидка 10% на будни, скажи об этом клиентам"];

export default function AssistantPage() {
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

  return (
    <div>
      <h1>Ассистент</h1>
      <p className="muted">Спросите, как идут дела, или дайте указание, которое учтёт бот для клиентов.</p>

      {error && <ErrorBanner message={error} />}

      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
      </div>
    </div>
  );
}
