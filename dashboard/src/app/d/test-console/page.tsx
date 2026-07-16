"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { SkillsEditor } from "@/components/SkillsEditor";
import { ErrorBanner } from "@/components/StatusBanner";
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";

type SkillKey = "packages" | "availability" | "faq" | "partners";

const SKILLS: { key: SkillKey; labelKey: string }[] = [
  { key: "packages", labelKey: "testConsole.skillPackages" },
  { key: "availability", labelKey: "testConsole.skillAvailability" },
  { key: "faq", labelKey: "testConsole.skillFaq" },
  { key: "partners", labelKey: "testConsole.skillPartners" },
];

const PRESETS: { nameKey: string; disabled: SkillKey[] }[] = [
  { nameKey: "testConsole.presetFull", disabled: [] },
  { nameKey: "testConsole.presetPricesOnly", disabled: ["availability", "faq", "partners"] },
  { nameKey: "testConsole.presetNoBooking", disabled: ["availability"] },
];

const ASSISTANT_SUGGESTIONS = ["Как идут дела за сегодня?", "У нас акция — скидка 10% на будни, скажи об этом клиентам"];

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

function AssistantPane() {
  const t = useT();
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
    <div className="test-console-pane">
      <div className="test-console-pane-head">
        <h3>{t("testConsole.assistantHead")}</h3>
        <p className="muted">{t("testConsole.assistantSubhead")}</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={ASSISTANT_SUGGESTIONS} />
      </div>
    </div>
  );
}

function TestPane() {
  const t = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState(0);
  const [disabledSkills, setDisabledSkills] = useState<SkillKey[]>(PRESETS[0]!.disabled);

  function selectPreset(index: number) {
    setActivePreset(index);
    setDisabledSkills(PRESETS[index]!.disabled);
  }

  function toggleSkill(key: SkillKey) {
    setDisabledSkills((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

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
        body: JSON.stringify({
          history: nextMessages.map(({ role, content }) => ({ role, content })),
          disabledSkills,
        }),
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
    <div className="test-console-pane">
      <div className="test-console-pane-head">
        <h3>{t("testConsole.testHead")}</h3>
        <p className="muted">{t("testConsole.testSubhead")}</p>
      </div>

      <div className="preset-row">
        {PRESETS.map((preset, index) => (
          <button
            key={preset.nameKey}
            type="button"
            className="preset-chip"
            data-active={activePreset === index}
            onClick={() => selectPreset(index)}
          >
            {t(preset.nameKey)}
          </button>
        ))}
      </div>

      <div className="preset-editor">
        {SKILLS.map((skill) => (
          <label key={skill.key} className="toggle-switch-row">
            <span>{t(skill.labelKey)}</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={!disabledSkills.includes(skill.key)} onChange={() => toggleSkill(skill.key)} />
              <span className="toggle-switch-track" />
              <span className="toggle-switch-knob" />
            </label>
          </label>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} />
      </div>
    </div>
  );
}

export default function TestConsolePage() {
  const t = useT();
  return (
    <div>
      <h1>{t("testConsole.title")}</h1>
      <p className="muted">{t("testConsole.subtitle")}</p>

      <div className="test-console-split">
        <AssistantPane />
        <TestPane />
      </div>

      <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid var(--color-hairline)" }}>
        <SkillsEditor />
      </div>
    </div>
  );
}
