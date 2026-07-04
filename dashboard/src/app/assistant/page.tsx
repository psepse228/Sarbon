"use client";

import { useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { SendIcon } from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  time: string;
}

function now() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

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

      <div className="chat-page">
        {messages.length === 0 && (
          <div className="chat-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chat-suggestion" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="chat-log">
          {messages.map((message, index) => (
            <div key={index} className="chat-row" data-role={message.role}>
              <div className="chat-bubble" data-role={message.role}>
                <span className="chat-bubble-text">{message.content}</span>
                <span className="chat-bubble-time">{message.time}</span>
              </div>
            </div>
          ))}
          {sending && (
            <div className="chat-row" data-role="assistant">
              <div className="chat-bubble chat-bubble-typing" data-role="assistant">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            </div>
          )}
        </div>

        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Напишите сообщение…"
            rows={1}
          />
          <button className="chat-send-btn" onClick={() => send(input)} disabled={sending || !input.trim()} aria-label="Отправить">
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
