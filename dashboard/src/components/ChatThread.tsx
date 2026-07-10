"use client";

import type { ReactNode } from "react";

import { SendIcon } from "@/components/icons";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  time: string;
  extra?: ReactNode;
}

interface ChatThreadProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  sending: boolean;
  suggestions?: string[];
}

export function now(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Shared chat rendering for /assistant (mobile + desktop) and the desktop
 * Test Console (added in a later task) — message bubbles, typing indicator,
 * suggestion chips, input row. Each caller owns its own send-logic and API
 * call; this component only renders. `extra` on a message lets a caller
 * attach additional content under a bubble without this component needing
 * to know what that content is. */
export function ChatThread({ messages, input, onInputChange, onSend, sending, suggestions = [] }: ChatThreadProps) {
  return (
    <div className="chat-page">
      {messages.length === 0 && suggestions.length > 0 && (
        <div className="chat-suggestions">
          {suggestions.map((s) => (
            <button key={s} className="chat-suggestion" onClick={() => onSend(s)}>
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
            {message.extra}
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
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
            }
          }}
          placeholder="Напишите сообщение…"
          rows={1}
        />
        <button className="chat-send-btn" onClick={() => onSend(input)} disabled={sending || !input.trim()} aria-label="Отправить">
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
