"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

function ToolCallTrace({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="tool-call-trace">
      {toolCalls.map((call, index) => {
        const escalated = call.name === "escalate_to_human";
        const gapFlagged = call.name === "flag_knowledge_gap";
        const leadCaptured = call.name === "capture_lead";
        const argsText = Object.entries(call.arguments)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(", ");
        let label: string;
        if (escalated) {
          label = `Бот бы передал администратору: ${String((call.result as { reason?: string })?.reason ?? "")}`;
        } else if (gapFlagged) {
          label = `Бот бы зафиксировал пробел в знаниях: ${String((call.result as { question?: string })?.question ?? "")}`;
        } else if (leadCaptured) {
          const lead = call.result as { name?: string; phone?: string };
          const parts = [lead?.name, lead?.phone].filter(Boolean);
          label = `Бот бы сохранил лид: ${parts.join(", ")}`;
        } else {
          label = `${call.name}(${argsText}) → ${JSON.stringify(call.result)}`;
        }
        return (
          <div
            key={index}
            className="tool-call-chip"
            data-escalated={escalated}
            data-gap-flagged={gapFlagged}
            data-lead-captured={leadCaptured}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

export default function TestConsolePage() {
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
      const res = await tmaFetch("/api/test-chat", {
        method: "POST",
        body: JSON.stringify({ history: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось получить ответ (${res.status})`);
      }
      const { reply, toolCalls } = (await res.json()) as { reply: string; toolCalls: ToolCall[] };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, time: now(), extra: <ToolCallTrace toolCalls={toolCalls} /> },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Тест-консоль</h1>
      <p className="muted">
        Спросите так, как спросил бы клиент — это настоящий бот, ответы не сохраняются в диалоги и не уходят
        клиентам. Под каждым ответом видно, что бот на самом деле проверил.
      </p>

      {error && <ErrorBanner message={error} />}

      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} />
      </div>
    </div>
  );
}
