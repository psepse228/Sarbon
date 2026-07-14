# Cortège Dashboard Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the owner's design-review notes per `docs/superpowers/specs/2026-07-14-cortege-dashboard-polish-design.md`: a new desktop header (search + RU/EN toggle), a collapsible "CRM" sidebar group, framed chat surfaces for Test Console and Assistant, real (non-fabricated) KPI sparklines, and Test Console skill-presets (test-mode-only, never touching the real `company_profile.disabled_skills`).

**Architecture:** New `DesktopHeader` component rendered above `.desktop-content`. `Sidebar.tsx`'s flat item list becomes a mix of plain links and one collapsible group (local state + `localStorage`). A new `.chat-frame` CSS wrapper applied at the *page* level around `<ChatThread>` (never inside `ChatThread.tsx` itself — that component is shared with the mobile app, out of scope). A new `disabled_skills_override` parameter threads through `generate_reply` → `POST /internal/test-chat` → the dashboard's `/api/test-chat` route → a new preset UI, entirely session-local (never persisted). Sparklines are a new pure day-bucketing function in `dashboard/src/lib/stats.ts` plus a tiny dependency-free inline-SVG component, following the `dataviz` skill's mark spec (thin 2px line, single hue reusing the KPI's own existing semantic color, no axis/legend — a single-series sparkline needs neither).

**Tech Stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend).

**Read before starting:** `docs/superpowers/specs/2026-07-14-cortege-dashboard-polish-design.md`.

**Note on test coverage:** Matches every prior phase. Backend (`engine.py`, `internal.py`) gets full pytest TDD coverage. The new `selectDailyTrend` pure function in `dashboard/src/lib/stats.ts` gets unit tests (same pattern as `selectRecentActivity`). Presentational React changes (header, sidebar grouping, chat frames, preset UI) get no automated test, consistent with every prior phase — verified via `npm run build` plus a manual pass in the final task.

---

### Task 1: New icons

**Files:**
- Modify: `dashboard/src/components/icons.tsx`

- [ ] **Step 1: Add `SearchIcon`, `GlobeIcon`, `ChevronDownIcon`**

Append to `dashboard/src/components/icons.tsx`, after `StarIcon`:

```tsx

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="6.3" />
      <path d="M14.7 14.7 18.5 18.5" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7.8" />
      <path d="M3.2 11h15.6" />
      <path d="M11 3.2c2.4 2.1 3.8 4.9 3.8 7.8s-1.4 5.7-3.8 7.8c-2.4-2.1-3.8-4.9-3.8-7.8s1.4-5.7 3.8-7.8Z" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} width={16} height={16} viewBox="0 0 22 22" className={className}>
      <path d="M5 8.5 11 14.5 17 8.5" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/icons.tsx
git commit -m "feat(dashboard): add search, globe, and chevron-down icons"
```

---

### Task 2: Desktop header (search + RU/EN toggle)

**Files:**
- Create: `dashboard/src/components/DesktopHeader.tsx`
- Modify: `dashboard/src/app/d/layout.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add the header CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Desktop header (dashboard polish pass) --- */

.desktop-header {
  position: sticky;
  top: 1.1rem;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 1.1rem 0;
  padding: 0.7rem 1rem;
  border-radius: 18px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 24px 60px -32px rgba(0, 0, 0, 0.75);
}

.desktop-header-search {
  flex: 1;
  max-width: 420px;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-hairline-soft);
  color: var(--color-text-faint);
}

.desktop-header-search input {
  border: none;
  background: transparent;
  padding: 0;
  width: 100%;
  font-size: 0.88rem;
}

.desktop-header-search input:focus {
  outline: none;
  box-shadow: none;
}

.desktop-header-search-kbd {
  display: flex;
  gap: 0.2rem;
  flex-shrink: 0;
}

.desktop-header-search-kbd kbd {
  font-family: ui-monospace, monospace;
  font-size: 0.68rem;
  color: var(--color-text-faint);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--color-hairline-soft);
  border-radius: 5px;
  padding: 0.1rem 0.4rem;
}

.desktop-header-lang {
  display: inline-flex;
  padding: 0.2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: 999px;
  gap: 0.1rem;
  flex-shrink: 0;
}

.desktop-header-lang button {
  border: none;
  background: transparent;
  color: var(--color-text-soft);
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.desktop-header-lang button[data-active="true"] {
  background: var(--color-accent-tint);
  color: var(--color-accent);
}

.desktop-content {
  padding-top: 1.2rem;
}
```

- [ ] **Step 2: Write `DesktopHeader.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { GlobeIcon, SearchIcon } from "@/components/icons";

const LOCALE_KEY = "cortege-dashboard-locale";

export function DesktopHeader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
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
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function setLocaleAndPersist(next: "ru" | "en") {
    setLocale(next);
    window.localStorage.setItem(LOCALE_KEY, next);
  }

  return (
    <div className="desktop-header">
      <label className="desktop-header-search">
        <SearchIcon />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по разделам, лидам, диалогам…"
          aria-label="Поиск"
        />
        <span className="desktop-header-search-kbd">
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </span>
      </label>

      <div className="desktop-header-lang" role="group" aria-label="Язык панели">
        <GlobeIcon />
        <button type="button" data-active={locale === "ru"} onClick={() => setLocaleAndPersist("ru")}>
          RU
        </button>
        <button type="button" data-active={locale === "en"} onClick={() => setLocaleAndPersist("en")}>
          EN
        </button>
      </div>
    </div>
  );
}
```

Note: `query` is intentionally read but not yet wired to any filtering — this is the visual/focus-shortcut-only scope from the spec. `dashboard/GlobeIcon` renders inline before the two buttons inside `.desktop-header-lang` (not a separate element outside it) — flex layout handles the spacing via the parent's `gap`.

- [ ] **Step 3: Render it in the desktop layout**

`dashboard/src/app/d/layout.tsx` currently reads:

```tsx
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <GemSmokeBackground />
      <Sidebar />
      <main className="desktop-content">{children}</main>
    </div>
  );
}
```

Replace with:

```tsx
import { DesktopHeader } from "@/components/DesktopHeader";
import { GemSmokeBackground } from "@/components/GemSmokeBackground";
import { Sidebar } from "@/components/Sidebar";

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="desktop-shell">
      <GemSmokeBackground />
      <Sidebar />
      <div className="desktop-main">
        <DesktopHeader />
        <main className="desktop-content">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `.desktop-main` so the header sits above the content in its own column**

Append to `dashboard/src/app/globals.css`:

```css

.desktop-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.desktop-main .desktop-content {
  flex: 1;
}
```

- [ ] **Step 5: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/DesktopHeader.tsx dashboard/src/app/d/layout.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add desktop header with search and RU/EN toggle"
```

---

### Task 3: Collapsible "CRM" sidebar group

**Files:**
- Modify: `dashboard/src/components/Sidebar.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add the group CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Sidebar collapsible group (dashboard polish pass) --- */

.desktop-sidebar-group-toggle {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.65rem 0.7rem;
  border: none;
  background: transparent;
  border-radius: 12px;
  color: var(--color-text-soft);
  font-size: 0.9rem;
  font-weight: 600;
  font-family: var(--font-body);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.desktop-sidebar-group-toggle:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text);
}

.desktop-sidebar-group-chevron {
  margin-left: auto;
  display: flex;
  transition: transform 0.15s ease;
}

.desktop-sidebar-group-chevron[data-expanded="true"] {
  transform: rotate(180deg);
}

.desktop-sidebar-group-children {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-left: 1.1rem;
  margin: 0.1rem 0 0.3rem;
  border-left: 1px solid var(--color-hairline-soft);
}

.desktop-sidebar-group-children .desktop-sidebar-item {
  font-size: 0.86rem;
  padding: 0.55rem 0.7rem;
}
```

- [ ] **Step 2: Rewrite `Sidebar.tsx`**

Replace the whole file:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ChatIcon,
  ChevronDownIcon,
  FlaskIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  SendIcon,
  SparkleIcon,
  StarIcon,
  UsersIcon,
} from "@/components/icons";

const TOP_ITEMS_BEFORE_GROUP = [{ href: "/d", label: "Обзор", Icon: HomeIcon }] as const;

const CRM_GROUP_ITEMS = [
  { href: "/d/conversations", label: "Диалоги", Icon: ChatIcon },
  { href: "/d/leads", label: "Лиды", Icon: UsersIcon },
  { href: "/d/broadcasts", label: "Рассылки", Icon: SendIcon },
  { href: "/d/reviews", label: "Отзывы", Icon: StarIcon },
] as const;

const TOP_ITEMS_AFTER_GROUP = [
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;

const CRM_EXPANDED_KEY = "cortege-sidebar-crm-expanded";

export function Sidebar() {
  const pathname = usePathname();
  const isOnCrmRoute = CRM_GROUP_ITEMS.some((item) => pathname.startsWith(item.href));
  const [expanded, setExpanded] = useState(isOnCrmRoute);

  useEffect(() => {
    const stored = window.localStorage.getItem(CRM_EXPANDED_KEY);
    if (stored !== null) {
      setExpanded(stored === "true");
    } else if (isOnCrmRoute) {
      setExpanded(true);
    }
    // Only run on mount — the route-based default above only applies before
    // a stored preference exists; toggling by hand always wins after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    window.localStorage.setItem(CRM_EXPANDED_KEY, String(next));
  }

  function renderLink({ href, label, Icon }: { href: string; label: string; Icon: typeof HomeIcon }) {
    const active = href === "/d" ? pathname === "/d" : pathname.startsWith(href);
    return (
      <Link key={href} href={href} className="desktop-sidebar-item" data-active={active}>
        <Icon />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <nav className="desktop-sidebar">
      <div className="desktop-sidebar-brand">Cortège</div>
      <div className="desktop-sidebar-nav">
        {TOP_ITEMS_BEFORE_GROUP.map(renderLink)}

        <button type="button" className="desktop-sidebar-group-toggle" onClick={toggleExpanded} aria-expanded={expanded}>
          <GridIcon />
          <span>CRM</span>
          <span className="desktop-sidebar-group-chevron" data-expanded={expanded}>
            <ChevronDownIcon />
          </span>
        </button>
        {expanded && <div className="desktop-sidebar-group-children">{CRM_GROUP_ITEMS.map(renderLink)}</div>}

        {TOP_ITEMS_AFTER_GROUP.map(renderLink)}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/Sidebar.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): group Диалоги/Лиды/Рассылки/Отзывы under a collapsible CRM sidebar section"
```

---

### Task 4: Framed chat surfaces (Test Console + Assistant)

**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/src/app/d/test-console/page.tsx`
- Modify: `dashboard/src/app/d/assistant/page.tsx`

- [ ] **Step 1: Add the `.chat-frame` CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Framed chat surface for desktop Test Console / Assistant
   (dashboard polish pass) — ChatThread.tsx itself is untouched, this wraps
   it at the page level so the shared mobile /assistant chat is unaffected. */

.chat-frame {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 560px;
  border-radius: 22px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 24px 60px -32px rgba(0, 0, 0, 0.75);
  margin-top: 1rem;
}

.chat-frame::before {
  content: "";
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-sheen), transparent);
  opacity: 0.5;
  z-index: 1;
}

.chat-frame .chat-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 1.2rem 1.2rem 0;
  background: transparent;
  overflow-y: auto;
}

.chat-frame .chat-log {
  flex: 1;
}

.chat-frame .chat-input-row {
  position: sticky;
  bottom: 1.2rem;
  margin: 0 1.2rem 1.2rem;
}
```

- [ ] **Step 2: Wrap the Test Console chat**

In `dashboard/src/app/d/test-console/page.tsx`, find:

```tsx
      {error && <ErrorBanner message={error} />}

      <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} />
    </div>
  );
}
```

Replace with:

```tsx
      {error && <ErrorBanner message={error} />}

      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wrap the Assistant chat and rename the page heading**

In `dashboard/src/app/d/assistant/page.tsx`, find:

```tsx
  return (
    <div>
      <h1>Ассистент</h1>
      <p className="muted">Спросите, как идут дела, или дайте указание, которое учтёт бот для клиентов.</p>

      {error && <ErrorBanner message={error} />}

      <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
    </div>
  );
}
```

Replace with:

```tsx
  return (
    <div>
      <h1>Ваш Личный Ассистент</h1>
      <p className="muted">Спросите, как идут дела, или дайте указание, которое учтёт бот для клиентов.</p>

      {error && <ErrorBanner message={error} />}

      <div className="chat-frame">
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} suggestions={SUGGESTIONS} />
      </div>
    </div>
  );
}
```

(The Sidebar's nav label stays "Ассистент" — only this page's own `<h1>` changes, per the spec.)

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/globals.css dashboard/src/app/d/test-console/page.tsx dashboard/src/app/d/assistant/page.tsx
git commit -m "feat(dashboard): frame the Test Console and Assistant chats, rename Assistant heading"
```

---

### Task 5: Backend `disabled_skills` test-mode override

**Files:**
- Modify: `backend/app/ai/engine.py`
- Modify: `backend/app/routers/internal.py`
- Test: `backend/tests/test_ai_engine.py`
- Test: `backend/tests/test_internal_test_chat.py`

- [ ] **Step 1: Write the failing engine test**

Add to `backend/tests/test_ai_engine.py`, near `test_generate_reply_excludes_tools_for_disabled_skills`:

```python
async def test_generate_reply_uses_disabled_skills_override_in_test_mode(monkeypatch):
    async def fail_if_called(tenant_id):
        raise AssertionError("get_disabled_skills should not be called when an override is provided")

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fail_if_called)

    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply(
        "tenant-1",
        "test-conv",
        [{"role": "user", "content": "Привет"}],
        test_mode=True,
        disabled_skills_override=["faq", "partners"],
    )

    tools_used = client.chat.completions.calls[0]["tools"]
    names = {t["function"]["name"] for t in tools_used}
    assert "get_faq" not in names
    assert "get_partners" not in names
    assert names == {
        "get_package_price",
        "list_packages",
        "check_date_availability",
        "escalate_to_human",
        "flag_knowledge_gap",
        "capture_lead",
        "capture_review",
    }


async def test_generate_reply_ignores_override_when_none(monkeypatch):
    real_disabled_skills_called = []

    async def fake_get_disabled_skills(tenant_id):
        real_disabled_skills_called.append(tenant_id)
        return []

    monkeypatch.setattr(engine.handlers, "get_disabled_skills", fake_get_disabled_skills)

    client = _FakeOpenAIClient([_final_response("Добрый день!")])
    monkeypatch.setattr(engine, "get_openai_client", lambda: client)

    await engine.generate_reply("tenant-1", "conv-1", [{"role": "user", "content": "Привет"}])

    assert real_disabled_skills_called == ["tenant-1"]
```

Note: this file already has an autouse `_no_disabled_skills` fixture that stubs `handlers.get_disabled_skills` for every test in the file — the first new test above deliberately overrides that stub with one that fails the test if called at all, to prove the override path skips the real fetch entirely.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_ai_engine.py -k "override" -v`
Expected: FAIL — `generate_reply()` doesn't accept a `disabled_skills_override` keyword yet (`TypeError`).

- [ ] **Step 3: Add the parameter**

In `backend/app/ai/engine.py`, find:

```python
async def generate_reply(
    tenant_id: str,
    conversation_id: str,
    history: list[dict[str, str]],
    test_mode: bool = False,
) -> GeneratedReply:
    client = get_openai_client()
    active_notice = await handlers.get_active_notice(tenant_id)
    company_info = await handlers.get_company_info(tenant_id)
    disabled_skills = await handlers.get_disabled_skills(tenant_id)
```

Replace with:

```python
async def generate_reply(
    tenant_id: str,
    conversation_id: str,
    history: list[dict[str, str]],
    test_mode: bool = False,
    disabled_skills_override: list[str] | None = None,
) -> GeneratedReply:
    client = get_openai_client()
    active_notice = await handlers.get_active_notice(tenant_id)
    company_info = await handlers.get_company_info(tenant_id)
    disabled_skills = (
        disabled_skills_override if disabled_skills_override is not None else await handlers.get_disabled_skills(tenant_id)
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_ai_engine.py -v`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Write the failing endpoint test**

Add to `backend/tests/test_internal_test_chat.py`, near the existing valid-secret test:

```python
def test_test_chat_passes_through_disabled_skills_override(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    fake_generate_reply = AsyncMock(return_value=GeneratedReply("Ответ", []))
    monkeypatch.setattr(internal_router, "generate_reply", fake_generate_reply)

    response = client.post(
        "/internal/test-chat",
        json={
            "tenant_id": "tenant-1",
            "history": [{"role": "user", "content": "Привет"}],
            "disabled_skills": ["availability"],
        },
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    fake_generate_reply.assert_awaited_once_with(
        "tenant-1",
        "test-tenant-1",
        [{"role": "user", "content": "Привет"}],
        test_mode=True,
        disabled_skills_override=["availability"],
    )


def test_test_chat_defaults_disabled_skills_override_to_none(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    fake_generate_reply = AsyncMock(return_value=GeneratedReply("Ответ", []))
    monkeypatch.setattr(internal_router, "generate_reply", fake_generate_reply)

    response = client.post(
        "/internal/test-chat",
        json={"tenant_id": "tenant-1", "history": [{"role": "user", "content": "Привет"}]},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    fake_generate_reply.assert_awaited_once_with(
        "tenant-1",
        "test-tenant-1",
        [{"role": "user", "content": "Привет"}],
        test_mode=True,
        disabled_skills_override=None,
    )
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_internal_test_chat.py -v`
Expected: FAIL — `TestChatRequest` has no `disabled_skills` field yet, and the existing call to `generate_reply` doesn't pass `disabled_skills_override`.

- [ ] **Step 7: Add the field and pass it through**

In `backend/app/routers/internal.py`, find:

```python
class TestChatRequest(BaseModel):
    tenant_id: str
    history: list[TestChatTurn]
```

Replace with:

```python
class TestChatRequest(BaseModel):
    tenant_id: str
    history: list[TestChatTurn]
    disabled_skills: list[str] | None = None
```

Then find:

```python
    history = [{"role": turn.role, "content": turn.content} for turn in body.history]
    result = await generate_reply(
        body.tenant_id, f"test-{body.tenant_id}", history, test_mode=True
    )
```

Replace with:

```python
    history = [{"role": turn.role, "content": turn.content} for turn in body.history]
    result = await generate_reply(
        body.tenant_id,
        f"test-{body.tenant_id}",
        history,
        test_mode=True,
        disabled_skills_override=body.disabled_skills,
    )
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: PASS, all tests green.

- [ ] **Step 9: Commit**

```bash
git add backend/app/ai/engine.py backend/app/routers/internal.py backend/tests/test_ai_engine.py backend/tests/test_internal_test_chat.py
git commit -m "feat(backend): add test-mode-only disabled_skills override to /internal/test-chat"
```

---

### Task 6: Test Console presets + intro copy

**Files:**
- Modify: `dashboard/src/app/api/test-chat/route.ts`
- Modify: `dashboard/src/app/d/test-console/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Pass the preset through the dashboard's own test-chat route**

`dashboard/src/app/api/test-chat/route.ts` currently reads (relevant excerpt):

```ts
const bodySchema = z.object({
  history: z.array(turnSchema).min(1),
});
```

Replace with:

```ts
const bodySchema = z.object({
  history: z.array(turnSchema).min(1),
  disabledSkills: z.array(z.string()).optional(),
});
```

Then find:

```ts
    const { history } = bodySchema.parse(body);
```

Replace with:

```ts
    const { history, disabledSkills } = bodySchema.parse(body);
```

Then find:

```ts
      body: JSON.stringify({
        tenant_id: tenantId,
        history: history.map(({ role, content }) => ({ role, content })),
      }),
```

Replace with:

```ts
      body: JSON.stringify({
        tenant_id: tenantId,
        history: history.map(({ role, content }) => ({ role, content })),
        disabled_skills: disabledSkills ?? null,
      }),
```

- [ ] **Step 2: Add the CSS for the preset switcher**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Test Console skill presets (dashboard polish pass) --- */

.preset-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.preset-chip {
  border: 1px solid var(--color-hairline);
  background: var(--color-surface);
  color: var(--color-text-soft);
  border-radius: 999px;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.preset-chip[data-active="true"] {
  background: var(--color-accent-tint);
  border-color: rgba(52, 211, 153, 0.4);
  color: var(--color-accent);
}

.preset-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.2rem;
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-hairline-soft);
}

.preset-editor label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--color-text-soft);
  cursor: pointer;
}
```

- [ ] **Step 3: Add the preset switcher + intro copy to Test Console**

`dashboard/src/app/d/test-console/page.tsx` currently reads:

```tsx
"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
```

Replace with:

```tsx
"use client";

import { useState } from "react";

import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
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
```

Then find:

```tsx
export default function TestConsolePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
```

Replace with:

```tsx
export default function TestConsolePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState(0);
  const [disabledSkills, setDisabledSkills] = useState<SkillKey[]>(PRESETS[0].disabled);

  function selectPreset(index: number) {
    setActivePreset(index);
    setDisabledSkills(PRESETS[index].disabled);
  }

  function toggleSkill(key: SkillKey) {
    setDisabledSkills((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
```

Then find:

```tsx
      const res = await tmaFetch("/api/test-chat", {
        method: "POST",
        body: JSON.stringify({ history: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
```

Replace with:

```tsx
      const res = await tmaFetch("/api/test-chat", {
        method: "POST",
        body: JSON.stringify({
          history: nextMessages.map(({ role, content }) => ({ role, content })),
          disabledSkills,
        }),
      });
```

Then find:

```tsx
      <h1>Тест-консоль</h1>
      <p className="muted">
        Спросите так, как спросил бы клиент — это настоящий бот, ответы не сохраняются в диалоги и не уходят
        клиентам. Под каждым ответом видно, что бот на самом деле проверил.
      </p>

      {error && <ErrorBanner message={error} />}

      <div className="chat-frame">
```

Replace with:

```tsx
      <h1>Тест-консоль</h1>
      <p className="muted">
        Постройте и протестируйте вашего бота. Спросите так, как спросил бы клиент — это настоящий бот, ответы не
        сохраняются в диалоги и не уходят клиентам. Под каждым ответом видно, что бот на самом деле проверил.
      </p>

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
          <label key={skill.key}>
            <input type="checkbox" checked={!disabledSkills.includes(skill.key)} onChange={() => toggleSkill(skill.key)} />
            {skill.label}
          </label>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="chat-frame">
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/api/test-chat/route.ts dashboard/src/app/d/test-console/page.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add editable skill presets and intro copy to Test Console"
```

---

### Task 7: KPI sparklines

**Files:**
- Modify: `dashboard/src/lib/stats.ts`
- Test: `dashboard/tests/stats.test.ts`
- Create: `dashboard/src/components/Sparkline.tsx`
- Modify: `dashboard/src/app/d/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Write the failing test for the day-bucketing function**

Add to `dashboard/tests/stats.test.ts`, after the `parseLocalDate` describe block:

```ts
describe("selectDailyTrend", () => {
  it("buckets timestamps into the last N days, oldest first, filling gaps with zero", () => {
    const items = [
      { createdAt: "2026-07-12T09:00:00Z" },
      { createdAt: "2026-07-12T14:00:00Z" },
      { createdAt: "2026-07-14T10:00:00Z" },
    ];

    const result = selectDailyTrend(items, 3, (item) => item.createdAt, () => new Date("2026-07-14T12:00:00Z"));

    expect(result).toEqual([0, 2, 1]);
  });

  it("returns an all-zero array when there are no items", () => {
    const result = selectDailyTrend([], 4, () => "", () => new Date("2026-07-14T12:00:00Z"));

    expect(result).toEqual([0, 0, 0, 0]);
  });
});
```

Update the top import line in the same file — find:

```ts
import { computeDashboardStats, parseLocalDate, selectRecentActivity, selectUpcomingAvailability } from "@/lib/stats";
```

Replace with:

```ts
import {
  computeDashboardStats,
  parseLocalDate,
  selectDailyTrend,
  selectRecentActivity,
  selectUpcomingAvailability,
} from "@/lib/stats";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npm test -- stats`
Expected: FAIL — `selectDailyTrend` is not exported from `@/lib/stats` yet.

- [ ] **Step 3: Implement `selectDailyTrend`**

Append to `dashboard/src/lib/stats.ts`:

```ts

/** Buckets arbitrary timestamped items into daily counts for the last `days`
 * days (oldest first, today last) — used for KPI sparklines. Real counts
 * only, no fabricated/interpolated data: a day with no items is a genuine
 * zero, not an estimate. `now` is injectable for tests; defaults to the
 * real clock. */
export function selectDailyTrend<T>(
  items: T[],
  days: number,
  getTimestamp: (item: T) => string,
  now: () => Date = () => new Date(),
): number[] {
  const today = now();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    dayKeys.push(day.toISOString().slice(0, 10));
  }

  const counts = new Map(dayKeys.map((key) => [key, 0]));
  for (const item of items) {
    const key = getTimestamp(item).slice(0, 10);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return dayKeys.map((key) => counts.get(key) ?? 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd dashboard && npm test -- stats`
Expected: PASS.

- [ ] **Step 5: Add the `dataviz`-spec sparkline component**

`dashboard/src/components/Sparkline.tsx`:

```tsx
interface SparklineProps {
  values: number[];
  color: string;
}

/** Minimal inline-SVG sparkline — thin 2px line, single hue (the caller's own
 * semantic KPI color, not a new categorical assignment), no axis/legend/grid
 * (a single-series sparkline needs none per the dataviz skill's accessibility
 * rule). Renders nothing meaningful for an all-zero series rather than a
 * flat misleading line at a fake baseline. */
export function Sparkline({ values, color }: SparklineProps) {
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 28;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 6: Add sparkline CSS**

Append to `dashboard/src/app/globals.css`:

```css

.kpi-sparkline {
  margin-top: 0.5rem;
  opacity: 0.85;
}
```

- [ ] **Step 7: Wire sparklines into the two Overview KPI tiles with real day-bucketable data**

`dashboard/src/app/d/page.tsx` currently imports from `@/lib/stats` and fetches `escalations`/`conversations`/`availability` in a `useEffect`. Find the import line:

```tsx
import {
  computeDashboardStats,
  parseLocalDate,
  selectRecentActivity,
  selectUpcomingAvailability,
  type DashboardStats,
  type RecentActivityItem,
} from "@/lib/stats";
```

Replace with:

```tsx
import {
  computeDashboardStats,
  parseLocalDate,
  selectDailyTrend,
  selectRecentActivity,
  selectUpcomingAvailability,
  type DashboardStats,
  type RecentActivityItem,
} from "@/lib/stats";
import { Sparkline } from "@/components/Sparkline";
```

Find the `useState` block:

```tsx
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<AvailabilityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
```

Replace with:

```tsx
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<AvailabilityEntry[]>([]);
  const [conversationsTrend, setConversationsTrend] = useState<number[]>([]);
  const [escalationsTrend, setEscalationsTrend] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
```

Find where the fetched arrays are used to set state (right after `setUpcoming(...)`):

```tsx
        setStats(computeDashboardStats(conversations, escalations, availability));
        setActivity(selectRecentActivity(conversations, escalations, 5));
        setUpcoming(selectUpcomingAvailability(availability, 7));
```

Replace with:

```tsx
        setStats(computeDashboardStats(conversations, escalations, availability));
        setActivity(selectRecentActivity(conversations, escalations, 5));
        setUpcoming(selectUpcomingAvailability(availability, 7));
        setConversationsTrend(selectDailyTrend(conversations, 7, (c) => c.createdAt));
        setEscalationsTrend(selectDailyTrend(escalations, 7, (e) => e.createdAt));
```

Find the two relevant KPI tiles:

```tsx
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
            <div className="kpi-label">открытых эскалаций</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.totalConversations}</div>
            <div className="kpi-label">диалогов всего</div>
          </div>
```

Replace with:

```tsx
          <div className="kpi-tile">
            <div className="kpi-value kpi-value-warn">{stats.openEscalations}</div>
            <div className="kpi-label">открытых эскалаций</div>
            <div className="kpi-sparkline">
              <Sparkline values={escalationsTrend} color="var(--color-warning)" />
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{stats.totalConversations}</div>
            <div className="kpi-label">диалогов всего</div>
            <div className="kpi-sparkline">
              <Sparkline values={conversationsTrend} color="var(--color-accent)" />
            </div>
          </div>
```

The resolution-rate and free-dates tiles are deliberately left without sparklines — neither has a real, non-fabricated day-bucketable history available from data already fetched on this page (see spec's Section C).

- [ ] **Step 8: Add icons to the two Overview panel headers**

Still in `dashboard/src/app/d/page.tsx`, add `AnalyticsIcon` and `ChatIcon` to the icon import line — find:

```tsx
import { ErrorBanner } from "@/components/StatusBanner";
```

Replace with:

```tsx
import { AnalyticsIcon, ChatIcon } from "@/components/icons";
import { ErrorBanner } from "@/components/StatusBanner";
```

Then find:

```tsx
          <div className="card">
            <div className="meter-row">
              <span className="meter-label">Автономность бота</span>
```

Replace with:

```tsx
          <div className="card">
            <div className="card-title-row">
              <h3><AnalyticsIcon /> Автономность бота</h3>
            </div>
            <div className="meter-row">
              <span className="meter-label">Автономность бота</span>
```

Then find:

```tsx
            <div className="card-title-row">
              <h3>Последние диалоги</h3>
            </div>
```

Replace with:

```tsx
            <div className="card-title-row">
              <h3><ChatIcon /> Последние диалоги</h3>
            </div>
```

Icons on the Reviews/Broadcasts panel headers and any other remaining un-iconed labels are deliberately deferred past this task — the owner's screenshot specifically called out KPI-row and tab-style icons, which Steps 1-7 and Task 1-3 already cover; treat any further icon requests as a quick fast-follow once the owner reviews this pass live, rather than guessing at every remaining label now.

- [ ] **Step 9: Verify the build and tests**

Run: `cd dashboard && npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add dashboard/src/lib/stats.ts dashboard/tests/stats.test.ts dashboard/src/components/Sparkline.tsx dashboard/src/app/d/page.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add real (non-fabricated) sparklines and panel icons to Overview"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build and test suite**

Run: `cd dashboard && npm run build && npm test`
Expected: build succeeds (10 desktop nav destinations reachable — `/d`, 4 CRM children, `/d/configuration`, `/d/test-console`, `/d/assistant`), all tests pass.

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all tests pass.

- [ ] **Step 2: Manual/browser verification**

Run `cd dashboard && npm run dev`. If a browser/screenshot tool is available in your environment, use it and actually look at the rendered pages; if not, say so explicitly and fall back to build+HTTP-level checks — do not claim a visual check that didn't happen. Check:

1. `/d` — header renders above the sidebar's top edge alignment, search input focuses on `Ctrl+K`, RU/EN toggle switches active state and persists across a reload. Escalations and Conversations KPI tiles show a small trend line; resolution-rate and free-dates tiles do not (by design).
2. Sidebar — "CRM" group is collapsed by default on `/d`, expands on click, stays expanded (and defaults open) when navigating directly to `/d/leads` or any other CRM child.
3. `/d/test-console` — chat sits inside a visible bordered/glass frame, not floating on the ambient background. Preset chips switch the checkbox states; sending a message with a non-default preset produces a visibly different bot capability set (e.g. "Только цены" — ask about parking/FAQ and confirm the bot no longer has `get_faq` available, matching the tool-call trace).
4. `/d/assistant` — heading reads "Ваш Личный Ассистент", chat is framed the same way as Test Console.
5. Mobile `/assistant` route — confirm it looks exactly as before (no frame, unaffected) — this is the scoping check for Task 4.

- [ ] **Step 3: Report**

Summarize what was verified vs. what could only be confirmed via build/tests, per Step 2's honesty requirement.
