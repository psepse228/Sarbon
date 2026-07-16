# Cortège Connectors, Inbox, Test Console Split & Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `docs/superpowers/specs/2026-07-16-cortege-connectors-inbox-testconsole.md`.

**Read before starting:** the spec above.

**Note on test coverage:** presentational/UI batch, consistent with every prior design pass this project — no new automated tests, verified via `npm run build` plus a manual pass in the final task. The one piece of real logic (`GET /api/connectors/status` reading an env var) is trivial enough that a test would just restate the implementation — skip it, matching this repo's existing convention of not testing single-env-var-read one-liners.

---

### Task 1: Readability — blur, glass opacity, base text weight

**Files:**
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Bump the shared glass blur/saturate**

Find every occurrence of (5 occurrences, `replace_all`):
```css
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
```
Replace all with:
```css
  backdrop-filter: blur(40px) saturate(165%);
  -webkit-backdrop-filter: blur(40px) saturate(165%);
```

- [ ] **Step 2: Slightly more opaque glass**

Find:
```css
  --glass: rgba(255, 255, 255, 0.055);
```
Replace with:
```css
  --glass: rgba(255, 255, 255, 0.075);
```

- [ ] **Step 3: Base text weight**

Find the first `body {` rule:
```css
body {
  padding: 0;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  max-width: 100vw;
}
```
Replace with:
```css
body {
  padding: 0;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-body);
  font-weight: 450;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  max-width: 100vw;
}
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds (CSS-only change).

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/globals.css
git commit -m "fix(dashboard): increase glass blur and base text weight for readability"
```

---

### Task 2: Header search — quick navigation

**Files:**
- Create: `dashboard/src/lib/desktopRoutes.ts`
- Modify: `dashboard/src/components/DesktopHeader.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Extract the route list**

Create `dashboard/src/lib/desktopRoutes.ts`:

```ts
/** Every desktop destination, for the header's quick-nav search. Sidebar.tsx
 * doesn't import this (its own route lists carry the sidebar-specific
 * grouping/icons) — this is a flat list for filtering, not for rendering
 * the sidebar itself. */
export const DESKTOP_ROUTES = [
  { href: "/d", label: "Обзор" },
  { href: "/d/conversations", label: "Диалоги" },
  { href: "/d/leads", label: "Лиды" },
  { href: "/d/broadcasts", label: "Рассылки" },
  { href: "/d/reviews", label: "Отзывы" },
  { href: "/d/catalog", label: "Каталог" },
  { href: "/d/calendar", label: "Календарь" },
  { href: "/d/connectors", label: "Коннекторы" },
  { href: "/d/configuration", label: "Настройки" },
  { href: "/d/test-console", label: "Тест-консоль" },
  { href: "/d/assistant", label: "Ассистент" },
] as const;
```

- [ ] **Step 2: Wire quick-nav into `DesktopHeader`**

Replace the whole file `dashboard/src/components/DesktopHeader.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AccountMenu } from "@/components/AccountMenu";
import { GlobeIcon, SearchIcon } from "@/components/icons";
import { DESKTOP_ROUTES } from "@/lib/desktopRoutes";

const LOCALE_KEY = "cortege-dashboard-locale";

export function DesktopHeader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<"ru" | "en">("ru");

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === "ru" || stored === "en") setLocale(stored);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setQuery("");
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return DESKTOP_ROUTES.filter((route) => route.label.toLowerCase().includes(trimmed));
  }, [query]);

  function goTo(href: string) {
    router.push(href);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (matches.length > 0) goTo(matches[0]!.href);
  }

  function setLocaleAndPersist(next: "ru" | "en") {
    setLocale(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }

  return (
    <div className="desktop-header">
      <div className="desktop-header-search-wrap" ref={rootRef}>
        <form onSubmit={onSubmit}>
          <label className="desktop-header-search">
            <SearchIcon />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Поиск по разделам…"
              aria-label="Поиск по разделам"
            />
            <span className="desktop-header-search-kbd">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </span>
          </label>
        </form>
        {open && matches.length > 0 && (
          <div className="desktop-header-search-results">
            {matches.map((route) => (
              <button
                key={route.href}
                type="button"
                className="desktop-header-search-result"
                onMouseDown={() => goTo(route.href)}
              >
                {route.label}
              </button>
            ))}
          </div>
        )}
        {open && query.trim() && matches.length === 0 && (
          <div className="desktop-header-search-results">
            <div className="desktop-header-search-empty">Ничего не найдено</div>
          </div>
        )}
      </div>

      <div className="desktop-header-lang" role="group" aria-label="Язык панели">
        <GlobeIcon />
        <button type="button" data-active={locale === "ru"} onClick={() => setLocaleAndPersist("ru")}>
          RU
        </button>
        <button type="button" data-active={locale === "en"} onClick={() => setLocaleAndPersist("en")}>
          EN
        </button>
      </div>

      <AccountMenu />
    </div>
  );
}
```

- [ ] **Step 3: Add the dropdown CSS**

In `dashboard/src/app/globals.css`, find:
```css
.desktop-header-search {
  flex: 1;
```
Replace with:
```css
.desktop-header-search-wrap {
  position: relative;
  flex: 1;
  max-width: 420px;
}

.desktop-header-search-results {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  z-index: 40;
  padding: 0.4rem;
  border-radius: 14px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(40px) saturate(165%);
  -webkit-backdrop-filter: blur(40px) saturate(165%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 24px 60px -32px rgba(0, 0, 0, 0.75);
}

.desktop-header-search-result {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.7rem;
  border-radius: 9px;
  font-size: 0.86rem;
  color: var(--color-text-soft);
}

.desktop-header-search-result:hover {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.desktop-header-search-empty {
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  color: var(--color-text-faint);
}

.desktop-header-search {
  flex: 1;
```

Note: `.desktop-header-search` no longer needs `max-width: 420px` itself since the wrapper now owns it — find within that same rule block:
```css
.desktop-header-search {
  flex: 1;
  max-width: 420px;
  display: flex;
```
Replace with:
```css
.desktop-header-search {
  flex: 1;
  display: flex;
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/desktopRoutes.ts dashboard/src/components/DesktopHeader.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): make header search a working quick-nav between sections"
```

---

### Task 3: New "Коннекторы" section

**Files:**
- Modify: `dashboard/src/components/icons.tsx`
- Create: `dashboard/src/app/api/connectors/status/route.ts`
- Create: `dashboard/src/app/d/connectors/page.tsx`
- Modify: `dashboard/src/components/Sidebar.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add channel icons**

Append to `dashboard/src/components/icons.tsx`:

```tsx

export function TelegramIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 11.4 18 4.6l-2.5 13.8-5-3.7-2.4 2.3-.4-3.6 9-7.3-10.7 6.3-2.5-.7Z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 17.2 3.7 18.5l1.2-3.5A7.4 7.4 0 1 1 8.7 17l-2.7.2Z" />
      <path d="M8 9.3c0 3 2.4 5.4 5.4 5.4" />
      <path d="M8 9.3c-.2-.7.3-1.6.9-1.6.5 0 .7.5.9 1 .1.4-.2.9-.4 1.2" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.6" y="3.6" width="14.8" height="14.8" rx="4.2" />
      <circle cx="11" cy="11" r="3.4" />
      <circle cx="15.1" cy="7.1" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MessengerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6.8h14a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H10l-4.5 3v-3H4a1 1 0 0 1-1-1V7.8a1 1 0 0 1 1-1Z" />
      <path d="M7.5 12 10 9.5l2 1.7 2.4-2.4" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5.5" width="15" height="11" rx="2" />
      <path d="M4.2 6.3 11 11.5l6.8-5.2" />
    </svg>
  );
}
```

- [ ] **Step 2: Add the connector status endpoint**

`dashboard/src/app/api/connectors/status/route.ts`:

```ts
import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

/** Whether the dashboard's own env has TELEGRAM_BOT_TOKEN configured — the
 * same variable the guest-facing bot itself needs to run at all, so "set"
 * here is a real signal the Telegram channel is live, not a guess. */
export async function GET(request: Request) {
  try {
    authenticateOwner(request);
    return NextResponse.json({ telegramConnected: Boolean(process.env.TELEGRAM_BOT_TOKEN) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 3: Create the Коннекторы page**

`dashboard/src/app/d/connectors/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import {
  InstagramIcon,
  MailIcon,
  MessengerIcon,
  TelegramIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { ChatIcon } from "@/components/icons";
import { tmaFetch } from "@/lib/telegram/client";

interface ConnectorCardProps {
  Icon: typeof TelegramIcon;
  name: string;
  description: string;
  status: "connected" | "not-configured" | "coming-soon";
}

const STATUS_LABEL: Record<ConnectorCardProps["status"], string> = {
  connected: "Подключено",
  "not-configured": "Не настроено",
  "coming-soon": "Скоро",
};

function ConnectorCard({ Icon, name, description, status }: ConnectorCardProps) {
  return (
    <div className="card connector-card">
      <div className="connector-card-icon">
        <Icon />
      </div>
      <div className="connector-card-body">
        <div className="card-title-row">
          <strong>{name}</strong>
          <span className="connector-status" data-status={status}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="muted">{description}</p>
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);

  useEffect(() => {
    tmaFetch("/api/connectors/status")
      .then(async (res) => (res.ok ? ((await res.json()) as { telegramConnected: boolean }) : null))
      .then((body) => setTelegramConnected(body?.telegramConnected ?? false))
      .catch(() => setTelegramConnected(false));
  }, []);

  return (
    <div>
      <h1>Коннекторы</h1>
      <p className="muted">Каналы, через которые бот получает и отправляет сообщения клиентам.</p>

      <div className="connector-grid">
        <ConnectorCard
          Icon={TelegramIcon}
          name="Telegram"
          description="Основной канал бота — клиенты пишут напрямую в Telegram."
          status={telegramConnected === null ? "not-configured" : telegramConnected ? "connected" : "not-configured"}
        />
        <ConnectorCard
          Icon={InstagramIcon}
          name="Instagram"
          description="Direct-сообщения из Instagram — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={WhatsAppIcon}
          name="WhatsApp"
          description="WhatsApp Business API — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={MessengerIcon}
          name="Facebook Messenger"
          description="Сообщения со страницы Facebook — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={ChatIcon}
          name="Веб-чат"
          description="Виджет чата на сайте заведения — в разработке."
          status="coming-soon"
        />
        <ConnectorCard
          Icon={MailIcon}
          name="Email"
          description="Обращения по электронной почте — в разработке."
          status="coming-soon"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the sidebar entry**

In `dashboard/src/components/Sidebar.tsx`, find:
```tsx
import {
  CalendarIcon,
  ChatIcon,
  ChevronDownIcon,
  FlaskIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  SendIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from "@/components/icons";
```
Replace with:
```tsx
import {
  CalendarIcon,
  ChatIcon,
  ChevronDownIcon,
  FlaskIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  PlugIcon,
  SendIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from "@/components/icons";
```

Then find:
```tsx
const TOP_ITEMS_AFTER_GROUP = [
  { href: "/d/catalog", label: "Каталог", Icon: TagIcon },
  { href: "/d/calendar", label: "Календарь", Icon: CalendarIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;
```
Replace with:
```tsx
const TOP_ITEMS_AFTER_GROUP = [
  { href: "/d/catalog", label: "Каталог", Icon: TagIcon },
  { href: "/d/calendar", label: "Календарь", Icon: CalendarIcon },
  { href: "/d/connectors", label: "Коннекторы", Icon: PlugIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;
```

This introduces a new `PlugIcon` — add it alongside the other icons appended in Step 1:
```tsx

export function PlugIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8.5 3.6v4.2M13.5 3.6v4.2" />
      <path d="M6.3 7.8h9.4v3.4a4.7 4.7 0 0 1-9.4 0V7.8Z" />
      <path d="M11 15.4v3" />
    </svg>
  );
}
```

- [ ] **Step 5: Add the Coннекторы CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Connectors (Коннекторы section) --- */

.connector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.connector-card {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.connector-card-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--color-accent-tint);
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.connector-card-body { flex: 1; min-width: 0; }

.connector-status {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  white-space: nowrap;
}

.connector-status[data-status="connected"] {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.connector-status[data-status="not-configured"] {
  background: var(--color-warning-tint);
  color: var(--color-warning);
}

.connector-status[data-status="coming-soon"] {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-faint);
}
```

Confirm `--color-warning-tint` exists in `globals.css` (used elsewhere for the tool-call-trace escalation chip) before relying on it — if the exact token name differs, use the same token that chip already uses.

- [ ] **Step 6: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds, `/d/connectors` appears as a new route.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/icons.tsx dashboard/src/app/api/connectors dashboard/src/app/d/connectors dashboard/src/components/Sidebar.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add Коннекторы section (Telegram real, others coming soon)"
```

---

### Task 4: "Диалоги" — Instagram-Direct-style two-pane inbox

**Files:**
- Modify: `dashboard/src/app/d/conversations/page.tsx`
- Delete: `dashboard/src/app/d/conversations/[id]/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Rewrite the Диалоги page**

Replace the whole file `dashboard/src/app/d/conversations/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { useConversationMessages } from "@/lib/useConversationMessages";
import { useConversations } from "@/lib/useConversations";
import type { ConversationSummary } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  escalated: "Эскалирован",
  closed: "Закрыт",
};

const ROLE_LABEL: Record<string, string> = {
  client: "Клиент",
  bot: "Бот",
  human: "Администратор",
};

function initialFor(clientId: string): string {
  return clientId.slice(-2, -1).toUpperCase() || clientId.slice(0, 1).toUpperCase() || "?";
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "сейчас";
  if (diffMin < 60) return `${diffMin} мин`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ч`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} дн`;
}

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const timestamp = conversation.lastMessageAt ?? conversation.createdAt;
  return (
    <button type="button" className="inbox-row" data-active={active} onClick={onSelect}>
      <span className="inbox-row-avatar">{initialFor(conversation.clientId)}</span>
      <span className="inbox-row-body">
        <span className="inbox-row-name">Клиент {conversation.clientId}</span>
        <span className="inbox-row-preview">{STATUS_LABEL[conversation.status] ?? conversation.status}</span>
      </span>
      <span className="inbox-row-time">{relativeTime(timestamp)}</span>
    </button>
  );
}

export default function DesktopConversationsPage() {
  const { items, loading, error } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0]!.id);
  }, [items, selectedId]);

  const { messages, loading: messagesLoading, error: messagesError } = useConversationMessages(selectedId ?? "");
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div>
      <h1>Диалоги</h1>
      <p className="muted">Переписка бота с клиентами — для контроля качества ответов.</p>

      {error && <ErrorBanner message={error} />}
      {loading && <p className="muted">Загрузка…</p>}
      {!loading && !error && items.length === 0 && <p className="muted">Диалогов пока нет.</p>}

      {items.length > 0 && (
        <div className="inbox-shell">
          <div className="inbox-list">
            {items.map((item) => (
              <ConversationRow
                key={item.id}
                conversation={item}
                active={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
          </div>
          <div className="inbox-thread">
            {!selected && <p className="muted inbox-thread-empty">Выберите диалог слева</p>}
            {selected && (
              <>
                <div className="inbox-thread-header">
                  <span className="inbox-row-avatar">{initialFor(selected.clientId)}</span>
                  <strong>Клиент {selected.clientId}</strong>
                </div>
                <div className="inbox-thread-messages">
                  {messagesError && <ErrorBanner message={messagesError} />}
                  {messagesLoading && <p className="muted">Загрузка…</p>}
                  {!messagesLoading &&
                    !messagesError &&
                    messages.map((message) => (
                      <div key={message.id} className="chat-row" data-role={message.role === "client" ? "assistant" : "user"}>
                        <div
                          className="chat-bubble"
                          data-role={message.role === "client" ? "assistant" : "user"}
                          data-sender={message.role}
                        >
                          <span className="chat-bubble-text">{message.content}</span>
                          <span className="chat-bubble-time">
                            {ROLE_LABEL[message.role] ?? message.role} · {new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: client messages are rendered with `data-role="assistant"` (left-aligned, neutral bubble) and bot/human messages with `data-role="user"` (right-aligned) purely to reuse `.chat-row`/`.chat-bubble`'s existing left/right + color CSS — this is a visual-only mapping (client ≈ "the other side", bot/human ≈ "our side"), not a semantic reuse of those role names. `data-sender` carries the real role for the one place it's needed: distinguishing a human admin's reply from the bot's own, in Step 3's CSS.

- [ ] **Step 2: Delete the old detail page**

```bash
git rm "dashboard/src/app/d/conversations/[id]/page.tsx"
```

- [ ] **Step 3: Add the inbox CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Диалоги: Instagram-Direct-style two-pane inbox --- */

.inbox-shell {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  height: calc(100vh - 14rem);
  min-height: 420px;
  max-height: 760px;
}

@media (max-width: 900px) {
  .inbox-shell { grid-template-columns: 1fr; height: auto; }
}

.inbox-list {
  overflow-y: auto;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.inbox-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 0.6rem;
  border-radius: 12px;
  text-align: left;
  color: var(--color-text-soft);
  transition: background-color 0.15s ease;
}

.inbox-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.inbox-row[data-active="true"] {
  background: var(--color-accent-tint);
  color: var(--color-text);
}

.inbox-row-avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent-tint);
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.86rem;
}

.inbox-row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.inbox-row-name {
  font-weight: 700;
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-row-preview {
  font-size: 0.78rem;
  color: var(--color-text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-row-time {
  flex-shrink: 0;
  font-size: 0.72rem;
  color: var(--color-text-faint);
}

.inbox-thread {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 18px;
}

.inbox-thread-empty {
  margin: auto;
}

.inbox-thread-header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--glass-border-soft);
  flex-shrink: 0;
}

.inbox-thread-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-bubble[data-sender="human"] {
  background: transparent;
  border: 1px solid rgba(217, 184, 114, 0.4);
  color: var(--color-text);
}
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds, `/d/conversations/[id]` no longer exists as a route.

- [ ] **Step 5: Commit**

```bash
git add "dashboard/src/app/d/conversations/page.tsx" dashboard/src/app/globals.css
git rm "dashboard/src/app/d/conversations/[id]/page.tsx"
git commit -m "feat(dashboard): redesign Диалоги as a two-pane Instagram-Direct-style inbox"
```

---

### Task 5: Test Console — split into "Настройка" / "Проверка" panes

**Files:**
- Modify: `dashboard/src/app/d/test-console/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Rewrite the Test Console page**

Replace the whole file `dashboard/src/app/d/test-console/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { SkillsEditor } from "@/components/SkillsEditor";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";

type SkillKey = "packages" | "availability" | "faq" | "partners";

const SKILLS: { key: SkillKey; label: string }[] = [
  { key: "packages", label: "Пакеты и цены" },
  { key: "availability", label: "Доступность дат" },
  { key: "faq", label: "Частые вопросы" },
  { key: "partners", label: "Партнёры" },
];

const PRESETS: { name: string; disabled: SkillKey[] }[] = [
  { name: "Полный", disabled: [] },
  { name: "Только цены", disabled: ["availability", "faq", "partners"] },
  { name: "Без бронирования", disabled: ["availability"] },
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
        <h3>Настройка</h3>
        <p className="muted">Дайте указание боту — это реально меняет его поведение для всех клиентов.</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={ASSISTANT_SUGGESTIONS} />
      </div>
    </div>
  );
}

function TestPane() {
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
        <h3>Проверка</h3>
        <p className="muted">Спросите так, как спросил бы клиент — ответы не сохраняются в диалоги и не уходят клиентам.</p>
      </div>

      <div className="preset-row">
        {PRESETS.map((preset, index) => (
          <button
            key={preset.name}
            type="button"
            className="preset-chip"
            data-active={activePreset === index}
            onClick={() => selectPreset(index)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="preset-editor">
        {SKILLS.map((skill) => (
          <label key={skill.key} className="toggle-switch-row">
            <span>{skill.label}</span>
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
  return (
    <div>
      <h1>Тест-консоль</h1>
      <p className="muted">
        Слева — настройте поведение бота, справа — проверьте, как он отвечает клиенту. Обе стороны работают
        с настоящим ботом.
      </p>

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
```

- [ ] **Step 2: Add the split-layout CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Test Console: side-by-side Настройка / Проверка split --- */

.test-console-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
  align-items: start;
}

@media (max-width: 900px) {
  .test-console-split { grid-template-columns: 1fr; }
}

.test-console-pane-head {
  margin-bottom: 0.8rem;
}

.test-console-pane-head h3 {
  margin-bottom: 0.3rem;
}
```

- [ ] **Step 3: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "dashboard/src/app/d/test-console/page.tsx" dashboard/src/app/globals.css
git commit -m "feat(dashboard): split Test Console into Настройка / Проверка side-by-side panes"
```

---

### Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build and test suite**

Run: `cd dashboard && npm run build && npm test -- --run`
Expected: build succeeds, all existing tests still pass (this batch touches no tested logic).

- [ ] **Step 2: Confirm no dangling references**

Run: `cd dashboard && grep -rln "conversations/\[id\]\|desktop-header-search {" src`
Expected: only the CSS rule itself matches the second pattern (its own definition), nothing references the deleted detail route.

- [ ] **Step 3: Manual/browser verification**

Run `cd dashboard && npm run dev`. Check, to whatever extent possible without real Supabase credentials in this environment:
1. Glass panels look noticeably more blurred/separated from the background than before; body text reads slightly bolder.
2. Header search: typing "кален" shows "Календарь" in a dropdown; clicking navigates there; Ctrl+K focuses it; Esc clears it.
3. `/d/connectors`: 6 cards render, Telegram shows a real connected/not-configured badge (depends on whether `TELEGRAM_BOT_TOKEN` is set in this environment), the other 5 show "Скоро".
4. `/d/conversations`: two-pane layout, list on the left with avatar circles, thread on the right; selecting a row loads that conversation's messages without a page navigation.
5. `/d/test-console`: two chat frames side by side, "Настройка" (assistant-style) on the left, "Проверка" (test-chat with presets/skills) on the right; both still call their respective real endpoints.

- [ ] **Step 4: Report**

Summarize what was verified vs. what could only be confirmed via build/code inspection.
