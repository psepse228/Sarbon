# Cortège Catalog, Calendar & Skills Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the owner's second design-review pass per `docs/superpowers/specs/2026-07-14-cortege-catalog-calendar-design.md`: toggle-switch checkboxes, a new "Каталог" section (packages/partners with photo URLs), "Навыки" relocated into Test Console as "Навыки ИИ", and a new "Календарь" section with a visual month grid plus a real (Service-Account, read-only, manual-trigger) Google Calendar sync.

**Architecture:** A shared `.toggle-switch` CSS component replaces native checkboxes everywhere a skill is turned on/off. `Package`/`Partner` gain an `imageUrl` field — no migration needed, both are already `jsonb` columns. A new `google_calendar_id` column on `company_profile` plus a new backend module (`calendar_sync.py`) using a shared Google service account (`GOOGLE_SERVICE_ACCOUNT_JSON` env var) power two new `/internal/*` endpoints, mirroring the exact shared-secret pattern `/internal/test-chat` and `/internal/broadcast` already use. Two new desktop pages (`/d/catalog`, `/d/calendar`) join the Sidebar; Настройки shrinks to О заведении/Вопросы/Пробелы/Политики.

**Tech Stack:** Next.js 14 App Router / TypeScript / vitest (dashboard), FastAPI / pytest (backend), Supabase, Google Calendar API.

**Read before starting:** `docs/superpowers/specs/2026-07-14-cortege-catalog-calendar-design.md`.

**Note on test coverage:** Matches every prior phase. Backend calendar-sync logic gets full pytest coverage (mocking the Google API client, never calling the real API in tests). Dashboard `lib/*.ts` Supabase-touching CRUD wrappers get no new unit test, consistent with `companyProfile.ts`/`availability.ts` today. Presentational React changes (Catalog cards, Calendar grid, toggle switches, Sidebar/Настройки/Test Console restructuring) get no automated test, consistent with every prior phase — verified via `npm run build` plus a manual pass in the final task.

**Important — this plan touches a production secret the human must provide.** Task 5 requires a real Google Cloud service account JSON key, set as `GOOGLE_SERVICE_ACCOUNT_JSON` in `backend/.env` (and the deployed backend's environment) before the calendar sync can actually be exercised end-to-end. The code and tests in this plan work without it (tests mock the Google client entirely), but manual verification in Task 10 will only get as far as showing the "not configured" state without it — flag this to the user rather than blocking on it.

---

### Task 1: Toggle switch component

**Files:**
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add the toggle-switch CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Toggle switch (replaces native checkboxes for on/off skills) --- */

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 26px;
  flex-shrink: 0;
  cursor: pointer;
}

.toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}

.toggle-switch-track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--color-hairline);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.toggle-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-text-soft);
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.toggle-switch input:checked ~ .toggle-switch-track {
  background: var(--color-accent-tint);
  border-color: rgba(52, 211, 153, 0.4);
}

.toggle-switch input:checked ~ .toggle-switch-knob {
  transform: translateX(18px);
  background: var(--color-accent);
}

.toggle-switch input:focus-visible ~ .toggle-switch-track {
  box-shadow: 0 0 0 3px var(--color-accent-tint);
}

.toggle-switch input:disabled ~ .toggle-switch-track {
  opacity: 0.5;
  cursor: not-allowed;
}
```

The markup pattern for every caller is:
```tsx
<label className="toggle-switch">
  <input type="checkbox" checked={...} disabled={...} onChange={...} />
  <span className="toggle-switch-track" />
  <span className="toggle-switch-knob" />
</label>
```

- [ ] **Step 2: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds (this step adds no new consumers yet — Tasks 3 and 6 use the class).

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/globals.css
git commit -m "feat(dashboard): add a toggle-switch component to replace native checkboxes"
```

---

### Task 2: `imageUrl` on Package and Partner

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/lib/companyProfile.ts`

- [ ] **Step 1: Add the field to both types**

In `dashboard/src/lib/types.ts`, find:

```ts
export interface Package {
  id: string;
  name: string;
  price: number;
  currency: string;
  includes: string[];
  excludes: string[];
  min_guests: number | null;
  max_guests: number | null;
  prepayment: string;
  cancellation_policy: string;
}
```

Replace with:

```ts
export interface Package {
  id: string;
  name: string;
  price: number;
  currency: string;
  includes: string[];
  excludes: string[];
  min_guests: number | null;
  max_guests: number | null;
  prepayment: string;
  cancellation_policy: string;
  imageUrl: string | null;
}
```

Then find:

```ts
export interface Partner {
  id: string;
  category: string;
  name: string;
  contact: string;
}
```

Replace with:

```ts
export interface Partner {
  id: string;
  category: string;
  name: string;
  contact: string;
  imageUrl: string | null;
}
```

- [ ] **Step 2: Backfill `imageUrl` when reading rows seeded before this field existed**

In `dashboard/src/lib/companyProfile.ts`, find:

```ts
type RawPackage = Omit<Package, "id"> & { id?: string };
type RawFaqEntry = Omit<FaqEntry, "id"> & { id?: string };
type RawPartner = Omit<Partner, "id" | "contact"> & { id?: string; contact: string | null };
```

Replace with:

```ts
type RawPackage = Omit<Package, "id" | "imageUrl"> & { id?: string; imageUrl?: string | null };
type RawFaqEntry = Omit<FaqEntry, "id"> & { id?: string };
type RawPartner = Omit<Partner, "id" | "contact" | "imageUrl"> & {
  id?: string;
  contact: string | null;
  imageUrl?: string | null;
};
```

Then find:

```ts
    packages: (data.packages ?? []).map((p) => ({ ...p, id: p.id ?? randomUUID() })),
    faq: (data.faq ?? []).map((f) => ({ ...f, id: f.id ?? randomUUID() })),
    partners: (data.partners ?? []).map((p) => ({ ...p, id: p.id ?? randomUUID(), contact: p.contact ?? "" })),
```

Replace with:

```ts
    packages: (data.packages ?? []).map((p) => ({ ...p, id: p.id ?? randomUUID(), imageUrl: p.imageUrl ?? null })),
    faq: (data.faq ?? []).map((f) => ({ ...f, id: f.id ?? randomUUID() })),
    partners: (data.partners ?? []).map((p) => ({
      ...p,
      id: p.id ?? randomUUID(),
      contact: p.contact ?? "",
      imageUrl: p.imageUrl ?? null,
    })),
```

No other change is needed in this file — `packages`/`partners` are saved wholesale via `savePackages`/`savePartners`, which already pass the full typed array through as-is.

- [ ] **Step 3: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds. (`PackagesEditor.tsx`'s `newPackage()` and `PartnersEditor.tsx`'s `newPartner()` will now fail to type-check without `imageUrl` — that's expected and fixed in Task 3, which rewrites both files anyway.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/companyProfile.ts
git commit -m "feat(dashboard): add imageUrl to Package and Partner"
```

---

### Task 3: New "Каталог" section

**Files:**
- Create: `dashboard/src/app/d/catalog/page.tsx`
- Modify: `dashboard/src/components/PackagesEditor.tsx`
- Modify: `dashboard/src/components/PartnersEditor.tsx`
- Modify: `dashboard/src/app/d/configuration/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add catalog-card CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Catalog cards (Каталог section) --- */

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.catalog-card-image {
  width: 100%;
  height: 140px;
  border-radius: 14px;
  object-fit: cover;
  margin-bottom: 0.9rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-hairline-soft);
}

.catalog-card-image-placeholder {
  width: 100%;
  height: 140px;
  border-radius: 14px;
  margin-bottom: 0.9rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed var(--color-hairline-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-faint);
  font-size: 0.78rem;
}
```

- [ ] **Step 2: Rewrite `PackagesEditor.tsx`**

Replace the whole file:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Package } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

function newPackage(): Package {
  return {
    id: crypto.randomUUID(),
    name: "",
    price: 0,
    currency: "RUB",
    includes: [],
    excludes: [],
    min_guests: null,
    max_guests: null,
    prepayment: "",
    cancellation_policy: "",
    imageUrl: null,
  };
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function PackagesEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [items, setItems] = useState<Package[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setItems(profile.packages);
  }, [profile]);

  function update(id: string, patch: Partial<Package>) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function add() {
    setItems((prev) => [...prev, newPackage()]);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/packages", {
        method: "PUT",
        body: JSON.stringify(items),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <div className="card-title-row">
        <h3>Пакеты</h3>
      </div>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="catalog-grid">
        {items.map((pkg) => (
          <div key={pkg.id} className="card">
            {pkg.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pkg.imageUrl} alt={pkg.name || "Пакет"} className="catalog-card-image" />
            ) : (
              <div className="catalog-card-image-placeholder">Нет фото</div>
            )}
            <div className="card-title-row">
              <input
                placeholder="Название пакета"
                value={pkg.name}
                onChange={(e) => update(pkg.id, { name: e.target.value })}
                style={{ flex: 1 }}
              />
              <button className="btn btn-danger" onClick={() => remove(pkg.id)}>
                Удалить
              </button>
            </div>
            <div className="field">
              <label>Ссылка на фото</label>
              <input
                placeholder="https://…"
                value={pkg.imageUrl ?? ""}
                onChange={(e) => update(pkg.id, { imageUrl: e.target.value || null })}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Цена</label>
                <input
                  type="number"
                  value={pkg.price}
                  onChange={(e) => update(pkg.id, { price: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Валюта</label>
                <input value={pkg.currency} onChange={(e) => update(pkg.id, { currency: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Входит в пакет (по одному пункту на строку)</label>
              <textarea
                rows={3}
                value={pkg.includes.join("\n")}
                onChange={(e) => update(pkg.id, { includes: linesToList(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Не входит в пакет (по одному пункту на строку)</label>
              <textarea
                rows={3}
                value={pkg.excludes.join("\n")}
                onChange={(e) => update(pkg.id, { excludes: linesToList(e.target.value) })}
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Мин. гостей</label>
                <input
                  type="number"
                  value={pkg.min_guests ?? ""}
                  onChange={(e) => update(pkg.id, { min_guests: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="field">
                <label>Макс. гостей</label>
                <input
                  type="number"
                  value={pkg.max_guests ?? ""}
                  onChange={(e) => update(pkg.id, { max_guests: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="field">
              <label>Условия предоплаты</label>
              <input value={pkg.prepayment} onChange={(e) => update(pkg.id, { prepayment: e.target.value })} />
            </div>
            <div className="field">
              <label>Условия отмены</label>
              <input
                value={pkg.cancellation_policy}
                onChange={(e) => update(pkg.id, { cancellation_policy: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" onClick={add} style={{ marginTop: "1rem" }}>
        + Добавить пакет
      </button>

      <div style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}
```

(This changes the page's own `<h1>Пакеты</h1>` to a `<h3>` inside `.card-title-row` since it's now a section within the combined Каталог page, not its own top-level page — Step 4 provides the page-level `<h1>Каталог</h1>`. The list layout becomes `.catalog-grid` and each item shows its photo or a placeholder.)

- [ ] **Step 3: Rewrite `PartnersEditor.tsx`**

Replace the whole file:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { Partner } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

function newPartner(): Partner {
  return { id: crypto.randomUUID(), category: "", name: "", contact: "", imageUrl: null };
}

export function PartnersEditor() {
  const { profile, loading, error } = useCompanyProfile();
  const [items, setItems] = useState<Partner[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setItems(profile.partners);
  }, [profile]);

  function update(id: string, patch: Partial<Partner>) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  function add() {
    setItems((prev) => [...prev, newPartner()]);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/partners", { method: "PUT", body: JSON.stringify(items) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <div className="card-title-row">
        <h3>Партнёры</h3>
      </div>
      <p className="muted">Кортеж, флористы, фотографы и другие рекомендуемые партнёры.</p>

      {saveError && <ErrorBanner message={saveError} />}
      {saved && <SuccessBanner message="Сохранено" />}

      <div className="catalog-grid">
        {items.map((partner) => (
          <div key={partner.id} className="card">
            {partner.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partner.imageUrl} alt={partner.name || "Партнёр"} className="catalog-card-image" />
            ) : (
              <div className="catalog-card-image-placeholder">Нет фото</div>
            )}
            <div className="card-title-row">
              <input
                placeholder="Категория (например, Флористы)"
                value={partner.category}
                onChange={(e) => update(partner.id, { category: e.target.value })}
                style={{ flex: 1 }}
              />
              <button className="btn btn-danger" onClick={() => remove(partner.id)}>
                Удалить
              </button>
            </div>
            <div className="field">
              <label>Ссылка на фото</label>
              <input
                placeholder="https://…"
                value={partner.imageUrl ?? ""}
                onChange={(e) => update(partner.id, { imageUrl: e.target.value || null })}
              />
            </div>
            <div className="field">
              <label>Название</label>
              <input value={partner.name} onChange={(e) => update(partner.id, { name: e.target.value })} />
            </div>
            <div className="field">
              <label>Контакт</label>
              <input value={partner.contact} onChange={(e) => update(partner.id, { contact: e.target.value })} />
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" onClick={add} style={{ marginTop: "1rem" }}>
        + Добавить партнёра
      </button>

      <div style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the Каталог page**

`dashboard/src/app/d/catalog/page.tsx`:

```tsx
import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";

export default function CatalogPage() {
  return (
    <div>
      <h1>Каталог</h1>
      <p className="muted">Пакеты и партнёры, которые бот показывает клиентам.</p>

      <PackagesEditor />

      <div style={{ marginTop: "2.5rem" }}>
        <PartnersEditor />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Remove the two tabs from Настройки**

`dashboard/src/app/d/configuration/page.tsx` currently reads:

```tsx
"use client";

import { useState } from "react";

import { AvailabilityManager } from "@/components/AvailabilityManager";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { FaqEditor } from "@/components/FaqEditor";
import { KnowledgeGapsEditor } from "@/components/KnowledgeGapsEditor";
import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";
import { SkillsEditor } from "@/components/SkillsEditor";

type ConfigTab =
  | "info"
  | "packages"
  | "faq"
  | "gaps"
  | "partners"
  | "skills"
  | "policies"
  | "availability";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "info", label: "О заведении" },
  { key: "packages", label: "Пакеты" },
  { key: "faq", label: "Вопросы" },
  { key: "gaps", label: "Пробелы" },
  { key: "partners", label: "Партнёры" },
  { key: "skills", label: "Навыки" },
  { key: "policies", label: "Политики" },
  { key: "availability", label: "Календарь" },
];

export default function DesktopConfigurationPage() {
  const [tab, setTab] = useState<ConfigTab>("info");

  return (
    <div>
      <h1>Настройки</h1>
      <p className="muted">Данные, которые бот использует, отвечая клиентам.</p>

      <div className="segmented" style={{ marginBottom: "1.4rem", flexWrap: "wrap" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} data-active={tab === key} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <CompanyInfoEditor />}
      {tab === "packages" && <PackagesEditor />}
      {tab === "faq" && <FaqEditor />}
      {tab === "gaps" && <KnowledgeGapsEditor />}
      {tab === "partners" && <PartnersEditor />}
      {tab === "skills" && <SkillsEditor />}
      {tab === "policies" && <PoliciesEditor />}
      {tab === "availability" && <AvailabilityManager />}
    </div>
  );
}
```

Replace the whole file with (this task removes `packages`/`partners`; Task 6 removes `skills` and Task 9 removes `availability` — but write the final target state now to avoid three separate touches of the same file, since all three removals are already fully specified across this plan):

```tsx
"use client";

import { useState } from "react";

import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { FaqEditor } from "@/components/FaqEditor";
import { KnowledgeGapsEditor } from "@/components/KnowledgeGapsEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";

type ConfigTab = "info" | "faq" | "gaps" | "policies";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "info", label: "О заведении" },
  { key: "faq", label: "Вопросы" },
  { key: "gaps", label: "Пробелы" },
  { key: "policies", label: "Политики" },
];

export default function DesktopConfigurationPage() {
  const [tab, setTab] = useState<ConfigTab>("info");

  return (
    <div>
      <h1>Настройки</h1>
      <p className="muted">Данные, которые бот использует, отвечая клиентам.</p>

      <div className="segmented" style={{ marginBottom: "1.4rem", flexWrap: "wrap" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} data-active={tab === key} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
      </div>

      {tab === "info" && <CompanyInfoEditor />}
      {tab === "faq" && <FaqEditor />}
      {tab === "gaps" && <KnowledgeGapsEditor />}
      {tab === "policies" && <PoliciesEditor />}
    </div>
  );
}
```

- [ ] **Step 6: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds. `/d/catalog` appears as a new route.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/app/d/catalog/page.tsx dashboard/src/components/PackagesEditor.tsx dashboard/src/components/PartnersEditor.tsx dashboard/src/app/d/configuration/page.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add Каталог section with package/partner photo support"
```

---

### Task 4: Move "Навыки" into Test Console as "Навыки ИИ"

**Files:**
- Modify: `dashboard/src/components/SkillsEditor.tsx`
- Modify: `dashboard/src/app/d/test-console/page.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Restyle `SkillsEditor.tsx` with the toggle switch and rename its heading**

Replace the whole file:

```tsx
"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

type SkillKey = "packages" | "availability" | "faq" | "partners";

const SKILLS: { key: SkillKey; label: string; description: string }[] = [
  { key: "packages", label: "Пакеты и цены", description: "Бот подсказывает пакеты и цены" },
  { key: "availability", label: "Доступность дат", description: "Бот проверяет свободные даты" },
  { key: "faq", label: "Частые вопросы", description: "Бот отвечает на частые вопросы" },
  { key: "partners", label: "Партнёры", description: "Бот рекомендует партнёров" },
];

export function SkillsEditor() {
  const { profile, loading, error, refetch } = useCompanyProfile();
  const [disabled, setDisabled] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setDisabled(profile.disabledSkills);
  }, [profile]);

  // All 4 toggles are disabled while any save is in flight (rather than
  // just the one being toggled) — this is a full-replace PUT against one
  // shared column, so two overlapping toggles would each compute `next` from
  // the same stale `disabled` snapshot and the loser's change would be
  // silently dropped. Serializing toggles closes that race.
  async function toggle(key: SkillKey) {
    const next = disabled.includes(key) ? disabled.filter((k) => k !== key) : [...disabled, key];
    setSaving(true);
    setSaveError(null);
    try {
      const res = await tmaFetch("/api/skills", { method: "PUT", body: JSON.stringify(next) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setDisabled(next);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Не удалось сохранить");
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <div className="card-title-row">
        <h3>Навыки ИИ</h3>
      </div>
      <p className="muted">
        Эти настройки применяются к реальному боту для всех клиентов — в отличие от пресетов выше, которые
        действуют только в этом тесте.
      </p>

      {saveError && <ErrorBanner message={saveError} />}

      {SKILLS.map((skill) => (
        <div key={skill.key} className="card">
          <div className="card-title-row">
            <strong>{skill.label}</strong>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!disabled.includes(skill.key)}
                disabled={saving}
                onChange={() => toggle(skill.key)}
              />
              <span className="toggle-switch-track" />
              <span className="toggle-switch-knob" />
            </label>
          </div>
          <p className="muted">{skill.description}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Render it on the Test Console page, below the existing test-only preset section**

`dashboard/src/app/d/test-console/page.tsx` currently has, near the end of its JSX (after the `.preset-editor` block added in the prior polish pass):

```tsx
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
        <ChatThread messages={messages} input={input} onInputChange={setInput} onSend={send} sending={sending} />
      </div>
    </div>
  );
}
```

Replace with (adds the real `SkillsEditor` after the chat frame, with a visual divider, and switches the ephemeral preset checkboxes to the new toggle-switch markup for consistency with Task 1):

```tsx
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

      <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid var(--color-hairline)" }}>
        <SkillsEditor />
      </div>
    </div>
  );
}
```

Then add the import at the top of the same file — find:

```tsx
import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
```

Replace with:

```tsx
import { ChatThread, now, type ChatMessage } from "@/components/ChatThread";
import { SkillsEditor } from "@/components/SkillsEditor";
import { ErrorBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
```

- [ ] **Step 3: Add `.toggle-switch-row` CSS (the ephemeral preset checkboxes now need a label+switch row layout, matching `SkillsEditor`'s `.card-title-row` pattern but inside the more compact `.preset-editor`)**

Append to `dashboard/src/app/globals.css`:

```css

.toggle-switch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--color-text-soft);
  cursor: default;
}
```

- [ ] **Step 4: Remove the "Навыки" tab from Настройки**

Already done in Task 3, Step 5 (that step's replacement file has no `skills` tab) — nothing further to change here. If Task 3 has not yet run when this task executes, confirm `dashboard/src/app/d/configuration/page.tsx` has no `SkillsEditor` import/tab before proceeding; if it still does, remove the `"skills"` entry from `ConfigTab`/`TABS` and the `{tab === "skills" && <SkillsEditor />}` line and its import, matching the same pattern.

- [ ] **Step 5: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/SkillsEditor.tsx dashboard/src/app/d/test-console/page.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): move Навыки into Test Console as Навыки ИИ with toggle switches"
```

---

### Task 5: Backend Google Calendar sync module

**Files:**
- Create: `supabase/migrations/0009_add_google_calendar_id.sql`
- Modify: `backend/requirements.txt`
- Modify: `backend/app/config.py`
- Create: `backend/app/calendar_sync.py`
- Test: `backend/tests/test_calendar_sync.py`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0009_add_google_calendar_id.sql`:

```sql
-- 0009_add_google_calendar_id.sql
-- The venue's own Google Calendar ID (their calendar's email address),
-- shared with Solura's single Google service account (read-only access) so
-- backend/app/calendar_sync.py can sync busy days into availability_cache.
-- No per-tenant service account — one shared account, each owner grants it
-- view access to their own calendar.

alter table company_profile add column if not exists google_calendar_id text;
```

Apply this against the real Supabase instance via the SQL editor, same manual process as every prior migration.

- [ ] **Step 2: Add the Google API dependencies**

In `backend/requirements.txt`, add two new lines (anywhere in the file, e.g. after the existing `httpx` line):

```
google-api-python-client>=2.140,<3.0
google-auth>=2.34,<3.0
```

Install them: `cd backend && ./.venv/Scripts/python.exe -m pip install -r requirements.txt`

- [ ] **Step 3: Add the settings field**

In `backend/app/config.py`, find:

```python
    admin_telegram_chat_id: str | None = None
    internal_api_secret: str | None = None
    environment: str = "development"
```

Replace with:

```python
    admin_telegram_chat_id: str | None = None
    internal_api_secret: str | None = None
    google_service_account_json: str | None = None
    environment: str = "development"
```

- [ ] **Step 4: Write the failing tests**

Create `backend/tests/test_calendar_sync.py`:

```python
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app import calendar_sync

SERVICE_ACCOUNT_JSON = json.dumps({"client_email": "cortege-calendar@my-project.iam.gserviceaccount.com"})


def test_get_service_account_email_reads_client_email(monkeypatch):
    monkeypatch.setattr(
        calendar_sync,
        "get_settings",
        lambda: SimpleNamespace(google_service_account_json=SERVICE_ACCOUNT_JSON),
    )

    email = calendar_sync.get_service_account_email()

    assert email == "cortege-calendar@my-project.iam.gserviceaccount.com"


def test_get_service_account_email_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr(calendar_sync, "get_settings", lambda: SimpleNamespace(google_service_account_json=None))

    with pytest.raises(RuntimeError, match="GOOGLE_SERVICE_ACCOUNT_JSON"):
        calendar_sync.get_service_account_email()


async def test_sync_calendar_marks_days_with_events_as_unavailable(monkeypatch):
    monkeypatch.setattr(
        calendar_sync,
        "get_settings",
        lambda: SimpleNamespace(google_service_account_json=SERVICE_ACCOUNT_JSON),
    )

    fake_events = {
        "items": [
            {"summary": "Свадьба Ивановых", "start": {"date": "2026-08-15"}},
            {"summary": "Юбилей", "start": {"date": "2026-08-20"}},
        ]
    }
    fake_events_resource = MagicMock()
    fake_events_resource.list.return_value.execute.return_value = fake_events
    fake_service = MagicMock()
    fake_service.events.return_value = fake_events_resource

    monkeypatch.setattr(calendar_sync, "_build_calendar_service", lambda: fake_service)

    upserted = []

    async def fake_upsert(tenant_id, date, is_available, event_details):
        upserted.append((tenant_id, date, is_available, event_details))

    monkeypatch.setattr(calendar_sync, "upsert_availability", fake_upsert)

    synced_count = await calendar_sync.sync_calendar("tenant-1", "owner@example.com")

    assert synced_count == 2
    assert upserted == [
        ("tenant-1", "2026-08-15", False, "Свадьба Ивановых"),
        ("tenant-1", "2026-08-20", False, "Юбилей"),
    ]
    fake_events_resource.list.assert_called_once()
    call_kwargs = fake_events_resource.list.call_args.kwargs
    assert call_kwargs["calendarId"] == "owner@example.com"


async def test_sync_calendar_combines_multiple_events_on_the_same_day(monkeypatch):
    monkeypatch.setattr(
        calendar_sync,
        "get_settings",
        lambda: SimpleNamespace(google_service_account_json=SERVICE_ACCOUNT_JSON),
    )

    fake_events = {
        "items": [
            {"summary": "Утренняя репетиция", "start": {"date": "2026-08-15"}},
            {"summary": "Свадьба Ивановых", "start": {"date": "2026-08-15"}},
        ]
    }
    fake_events_resource = MagicMock()
    fake_events_resource.list.return_value.execute.return_value = fake_events
    fake_service = MagicMock()
    fake_service.events.return_value = fake_events_resource
    monkeypatch.setattr(calendar_sync, "_build_calendar_service", lambda: fake_service)

    upserted = []

    async def fake_upsert(tenant_id, date, is_available, event_details):
        upserted.append((tenant_id, date, is_available, event_details))

    monkeypatch.setattr(calendar_sync, "upsert_availability", fake_upsert)

    synced_count = await calendar_sync.sync_calendar("tenant-1", "owner@example.com")

    assert synced_count == 1
    assert upserted == [("tenant-1", "2026-08-15", False, "Утренняя репетиция, Свадьба Ивановых")]
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_calendar_sync.py -v`
Expected: FAIL — `app.calendar_sync` doesn't exist yet.

- [ ] **Step 6: Implement `calendar_sync.py`**

Create `backend/app/calendar_sync.py`:

```python
import json
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build

from app.config import get_settings
from app.db import get_supabase_client

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
SYNC_WINDOW_DAYS = 90


def _load_service_account_info() -> dict[str, Any]:
    settings = get_settings()
    if not settings.google_service_account_json:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured on the server")
    return json.loads(settings.google_service_account_json)


def get_service_account_email() -> str:
    """The email the owner shares their Google Calendar with (read access is
    enough) — surfaced in the dashboard's Календарь connection panel."""
    info = _load_service_account_info()
    return info["client_email"]


def _build_calendar_service():
    info = _load_service_account_info()
    credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("calendar", "v3", credentials=credentials, cacheDiscovery=False)


async def upsert_availability(tenant_id: str, date_str: str, is_available: bool, event_details: str) -> None:
    """Mirrors dashboard/src/lib/availability.ts's upsertAvailability — same
    check-then-insert-or-update shape, since availability_cache has no
    unique constraint on (tenant_id, date) to upsert(onConflict) against."""
    client = get_supabase_client()
    existing = (
        client.table("availability_cache")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("date", date_str)
        .limit(1)
        .execute()
    ).data

    if existing:
        client.table("availability_cache").update(
            {"is_available": is_available, "event_details": event_details}
        ).eq("id", existing[0]["id"]).execute()
        return

    client.table("availability_cache").insert(
        {"tenant_id": tenant_id, "date": date_str, "is_available": is_available, "event_details": event_details}
    ).execute()


async def sync_calendar(tenant_id: str, calendar_id: str) -> int:
    """Reads events on `calendar_id` for the next SYNC_WINDOW_DAYS days and
    marks each day that has at least one event as unavailable in
    availability_cache, with event_details set to that day's event
    summary/summaries joined by ", ". Only ever asserts busy days from real
    calendar events — a day with no event is left untouched, never marked
    available from the absence of one. Returns the count of distinct days
    synced."""
    service = _build_calendar_service()

    today = date.today()
    time_min = today.isoformat() + "T00:00:00Z"
    time_max = (today + timedelta(days=SYNC_WINDOW_DAYS)).isoformat() + "T00:00:00Z"

    response = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    events_by_day: dict[str, list[str]] = defaultdict(list)
    for event in response.get("items", []):
        start = event.get("start", {})
        day_str = start.get("date") or (start.get("dateTime") or "")[:10]
        if not day_str:
            continue
        summary = event.get("summary") or "Занято"
        events_by_day[day_str].append(summary)

    for day_str, summaries in events_by_day.items():
        await upsert_availability(tenant_id, day_str, False, ", ".join(summaries))

    return len(events_by_day)
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_calendar_sync.py -v`
Expected: PASS, 4/4.

- [ ] **Step 8: Run the full backend suite**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all tests pass (no other file references `calendar_sync` yet — that's Task 6).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0009_add_google_calendar_id.sql backend/requirements.txt backend/app/config.py backend/app/calendar_sync.py backend/tests/test_calendar_sync.py
git commit -m "feat(backend): add Google Calendar sync module (service account, read-only)"
```

---

### Task 6: Backend `/internal` calendar endpoints

**Files:**
- Modify: `backend/app/routers/internal.py`
- Test: `backend/tests/test_internal_calendar.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_internal_calendar.py`:

```python
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import app.routers.internal as internal_router
from app.main import app

client = TestClient(app)


def _fake_settings(secret: str = "test-secret") -> SimpleNamespace:
    return SimpleNamespace(internal_api_secret=secret)


def test_get_service_account_email_returns_email(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())
    monkeypatch.setattr(internal_router, "get_service_account_email", lambda: "cortege-calendar@my-project.iam.gserviceaccount.com")

    response = client.get("/internal/calendar-service-account-email", headers={"X-Internal-Secret": "test-secret"})

    assert response.status_code == 200
    assert response.json() == {"email": "cortege-calendar@my-project.iam.gserviceaccount.com"}


def test_get_service_account_email_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.get("/internal/calendar-service-account-email", headers={"X-Internal-Secret": "wrong"})

    assert response.status_code == 401


def test_sync_calendar_endpoint_returns_synced_count(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())
    fake_sync = AsyncMock(return_value=3)
    monkeypatch.setattr(internal_router, "sync_calendar", fake_sync)

    response = client.post(
        "/internal/sync-calendar",
        json={"tenant_id": "tenant-1", "calendar_id": "owner@example.com"},
        headers={"X-Internal-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"synced_count": 3}
    fake_sync.assert_awaited_once_with("tenant-1", "owner@example.com")


def test_sync_calendar_endpoint_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(internal_router, "get_settings", lambda: _fake_settings())

    response = client.post(
        "/internal/sync-calendar",
        json={"tenant_id": "tenant-1", "calendar_id": "owner@example.com"},
        headers={"X-Internal-Secret": "wrong"},
    )

    assert response.status_code == 401
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_internal_calendar.py -v`
Expected: FAIL — the two new routes don't exist yet.

- [ ] **Step 3: Add the import and the two routes**

In `backend/app/routers/internal.py`, find:

```python
from app.ai.engine import generate_reply
from app.config import get_settings
from app.notifications import get_notifier_bot
```

Replace with:

```python
from app.ai.engine import generate_reply
from app.calendar_sync import get_service_account_email, sync_calendar
from app.config import get_settings
from app.notifications import get_notifier_bot
```

Then append at the end of the file:

```python


@router.get("/calendar-service-account-email")
async def calendar_service_account_email(
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> dict[str, str]:
    """The email the owner shares their Google Calendar with — see
    dashboard/src/lib/calendar.ts for the only caller."""
    settings = get_settings()
    if not settings.internal_api_secret or not hmac.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    return {"email": get_service_account_email()}


class SyncCalendarRequest(BaseModel):
    tenant_id: str
    calendar_id: str


class SyncCalendarResponse(BaseModel):
    synced_count: int


@router.post("/sync-calendar", response_model=SyncCalendarResponse)
async def sync_calendar_endpoint(
    body: SyncCalendarRequest,
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> SyncCalendarResponse:
    """Manual, owner-triggered sync — no automatic/scheduled runs (no job
    scheduler exists in this repo). See dashboard/src/lib/calendar.ts."""
    settings = get_settings()
    if not settings.internal_api_secret or not hmac.compare_digest(
        x_internal_secret, settings.internal_api_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    synced_count = await sync_calendar(body.tenant_id, body.calendar_id)
    return SyncCalendarResponse(synced_count=synced_count)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_internal_calendar.py -v`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/internal.py backend/tests/test_internal_calendar.py
git commit -m "feat(backend): add /internal/calendar-service-account-email and /internal/sync-calendar"
```

---

### Task 7: Dashboard calendar lib + `googleCalendarId` on company_profile

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/lib/companyProfile.ts`
- Create: `dashboard/src/lib/calendar.ts`
- Create: `dashboard/src/app/api/calendar/service-account/route.ts`
- Create: `dashboard/src/app/api/calendar/sync/route.ts`
- Create: `dashboard/src/app/api/calendar/connect/route.ts`

- [ ] **Step 1: Add `googleCalendarId` to `CompanyProfile`**

In `dashboard/src/lib/types.ts`, find:

```ts
export interface CompanyProfile {
  tenantId: string;
  packages: Package[];
  faq: FaqEntry[];
  partners: Partner[];
  policies: string;
  activeNotice: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  socials: string | null;
  disabledSkills: string[];
  updatedAt: string | null;
}
```

Replace with:

```ts
export interface CompanyProfile {
  tenantId: string;
  packages: Package[];
  faq: FaqEntry[];
  partners: Partner[];
  policies: string;
  activeNotice: string | null;
  companyName: string | null;
  address: string | null;
  phone: string | null;
  socials: string | null;
  disabledSkills: string[];
  googleCalendarId: string | null;
  updatedAt: string | null;
}
```

- [ ] **Step 2: Wire the column through `companyProfile.ts`**

In `dashboard/src/lib/companyProfile.ts`, find:

```ts
const COLUMNS = "packages,faq,partners,policies,active_notice,company_name,address,phone,socials,disabled_skills,updated_at";
```

Replace with:

```ts
const COLUMNS =
  "packages,faq,partners,policies,active_notice,company_name,address,phone,socials,disabled_skills,google_calendar_id,updated_at";
```

Then find:

```ts
  disabled_skills: string[] | null;
  updated_at: string | null;
}
```

Replace with:

```ts
  disabled_skills: string[] | null;
  google_calendar_id: string | null;
  updated_at: string | null;
}
```

Then find the empty-profile default return:

```ts
      disabledSkills: [],
      updatedAt: null,
    };
```

Replace with:

```ts
      disabledSkills: [],
      googleCalendarId: null,
      updatedAt: null,
    };
```

Then find the mapped-row return:

```ts
    disabledSkills: data.disabled_skills ?? [],
    updatedAt: data.updated_at,
  };
}
```

Replace with:

```ts
    disabledSkills: data.disabled_skills ?? [],
    googleCalendarId: data.google_calendar_id,
    updatedAt: data.updated_at,
  };
}
```

Then find:

```ts
type CompanyProfileColumn =
  | "packages"
  | "faq"
  | "partners"
  | "policies"
  | "active_notice"
  | "company_name"
  | "address"
  | "phone"
  | "socials"
  | "disabled_skills";
```

Replace with:

```ts
type CompanyProfileColumn =
  | "packages"
  | "faq"
  | "partners"
  | "policies"
  | "active_notice"
  | "company_name"
  | "address"
  | "phone"
  | "socials"
  | "disabled_skills"
  | "google_calendar_id";
```

Then find:

```ts
function upsertColumn(
  tenantId: string,
  column: "packages" | "faq" | "partners" | "policies" | "active_notice" | "disabled_skills",
  value: unknown,
): Promise<void> {
  return upsertColumns(tenantId, { [column]: value });
}
```

Replace with:

```ts
function upsertColumn(
  tenantId: string,
  column: "packages" | "faq" | "partners" | "policies" | "active_notice" | "disabled_skills" | "google_calendar_id",
  value: unknown,
): Promise<void> {
  return upsertColumns(tenantId, { [column]: value });
}
```

Then append at the end of the file:

```ts

/** The venue's own Google Calendar ID (their calendar's email address) —
 * see backend/app/calendar_sync.py for how it's used. */
export function saveGoogleCalendarId(tenantId: string, googleCalendarId: string | null): Promise<void> {
  return upsertColumn(tenantId, "google_calendar_id", googleCalendarId);
}
```

- [ ] **Step 3: Add `dashboard/src/lib/calendar.ts`**

```ts
import "server-only";

async function callInternal<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  const secret = process.env.INTERNAL_API_SECRET;
  if (!backendUrl || !secret) {
    throw new Error("BACKEND_URL/INTERNAL_API_SECRET is not configured on the server");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Internal-Secret": secret, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Backend calendar call failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function fetchServiceAccountEmail(): Promise<string> {
  const { email } = await callInternal<{ email: string }>("/internal/calendar-service-account-email");
  return email;
}

export async function syncGoogleCalendar(tenantId: string, calendarId: string): Promise<number> {
  const { synced_count: syncedCount } = await callInternal<{ synced_count: number }>("/internal/sync-calendar", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId, calendar_id: calendarId }),
  });
  return syncedCount;
}
```

- [ ] **Step 4: Add the three new API routes**

`dashboard/src/app/api/calendar/service-account/route.ts`:

```ts
import { NextResponse } from "next/server";

import { fetchServiceAccountEmail } from "@/lib/calendar";
import { toErrorResponse } from "@/lib/apiError";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    authenticateOwner(request);
    return NextResponse.json({ email: await fetchServiceAccountEmail() });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

`dashboard/src/app/api/calendar/sync/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { syncGoogleCalendar } from "@/lib/calendar";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ calendarId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { calendarId } = bodySchema.parse(await request.json());
    const syncedCount = await syncGoogleCalendar(tenantId, calendarId);
    return NextResponse.json({ syncedCount });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

`dashboard/src/app/api/calendar/connect/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/apiError";
import { saveGoogleCalendarId } from "@/lib/companyProfile";
import { authenticateOwner } from "@/lib/telegram/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ calendarId: z.string().min(1).nullable() });

export async function PUT(request: Request) {
  try {
    const { tenantId } = authenticateOwner(request);
    const { calendarId } = bodySchema.parse(await request.json());
    await saveGoogleCalendarId(tenantId, calendarId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 5: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/companyProfile.ts dashboard/src/lib/calendar.ts dashboard/src/app/api/calendar
git commit -m "feat(dashboard): add calendar lib, googleCalendarId column, and calendar API routes"
```

---

### Task 8: Calendar month-grid component

**Files:**
- Create: `dashboard/src/components/CalendarGrid.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Add the grid CSS**

Append to `dashboard/src/app/globals.css`:

```css

/* --- Calendar month grid (Календарь section) --- */

.calendar-grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.calendar-grid-month {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.1rem;
  text-transform: capitalize;
}

.calendar-grid-nav {
  display: flex;
  gap: 0.4rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
}

.calendar-grid-dow {
  text-align: center;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-faint);
  padding-bottom: 0.4rem;
}

.calendar-grid-day {
  aspect-ratio: 1;
  border-radius: 12px;
  border: 1px solid var(--color-hairline-soft);
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-soft);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.calendar-grid-day:hover {
  background: rgba(255, 255, 255, 0.06);
}

.calendar-grid-day[data-empty="true"] {
  visibility: hidden;
  cursor: default;
}

.calendar-grid-day[data-status="available"] {
  background: var(--color-accent-tint);
  border-color: rgba(52, 211, 153, 0.3);
  color: var(--color-accent);
}

.calendar-grid-day[data-status="booked"] {
  background: rgba(255, 255, 255, 0.02);
  border-color: var(--color-hairline-soft);
  color: var(--color-text-faint);
  opacity: 0.6;
}

.calendar-grid-day[data-selected="true"] {
  box-shadow: 0 0 0 2px var(--color-accent);
}

.calendar-day-editor {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-hairline-soft);
}
```

- [ ] **Step 2: Write `CalendarGrid.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { parseLocalDate } from "@/lib/stats";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_FORMAT = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface CalendarGridProps {
  entries: AvailabilityEntry[];
  onChanged: () => void;
}

export function CalendarGrid({ entries, onChanged }: CalendarGridProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [eventDetails, setEventDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const entryByDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Monday-first

  const cells: { day: number | null; key: string | null }[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ day: null, key: null });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, key: toDateKey(year, month, day) });

  function selectDay(key: string) {
    setSelectedDate(key);
    setSaved(false);
    const existing = entryByDate.get(key);
    setIsAvailable(existing?.isAvailable ?? false);
    setEventDetails(existing?.eventDetails ?? "");
  }

  async function save() {
    if (!selectedDate) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await tmaFetch("/api/availability", {
        method: "PUT",
        body: JSON.stringify({ date: selectedDate, isAvailable, eventDetails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="calendar-grid-header">
        <span className="calendar-grid-month">{MONTH_FORMAT.format(cursor)}</span>
        <div className="calendar-grid-nav">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Следующий месяц"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {DOW_LABELS.map((label) => (
          <div key={label} className="calendar-grid-dow">
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (cell.day === null || cell.key === null) {
            return <div key={`blank-${index}`} className="calendar-grid-day" data-empty="true" />;
          }
          const entry = entryByDate.get(cell.key);
          const status = entry ? (entry.isAvailable ? "available" : "booked") : undefined;
          return (
            <div
              key={cell.key}
              className="calendar-grid-day"
              data-status={status}
              data-selected={selectedDate === cell.key}
              onClick={() => selectDay(cell.key as string)}
            >
              {cell.day}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <div className="calendar-day-editor">
          <div className="card-title-row">
            <strong>{parseLocalDate(selectedDate).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</strong>
          </div>
          {error && <ErrorBanner message={error} />}
          {saved && <SuccessBanner message="Сохранено" />}
          <label className="toggle-switch-row">
            <span>Свободно</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
              <span className="toggle-switch-track" />
              <span className="toggle-switch-knob" />
            </label>
          </label>
          <div className="field">
            <label>Заметка</label>
            <input value={eventDetails} onChange={(e) => setEventDetails(e.target.value)} placeholder="Например, забронировано" />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds. (Not yet rendered anywhere — Task 9 wires it into the new Календарь page.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/CalendarGrid.tsx dashboard/src/app/globals.css
git commit -m "feat(dashboard): add a visual month-grid calendar component"
```

---

### Task 9: New "Календарь" page + remove Availability from Настройки

**Files:**
- Create: `dashboard/src/app/d/calendar/page.tsx`
- Delete: `dashboard/src/components/AvailabilityManager.tsx`
- Modify: `dashboard/src/app/d/configuration/page.tsx`

- [ ] **Step 1: Confirm `dashboard/src/app/d/configuration/page.tsx` has no `availability` tab**

This was already handled by Task 3, Step 5's final replacement content (no `"availability"` entry in `TABS`, no `AvailabilityManager` import). If Task 3 has not yet run when this task executes, remove the `"availability"` tab entry, its render line, and the `AvailabilityManager` import from `dashboard/src/app/d/configuration/page.tsx` the same way.

- [ ] **Step 2: Delete the old list-based manager**

`AvailabilityManager.tsx`'s functionality is fully superseded by `CalendarGrid.tsx` (Task 8) — same `/api/availability` GET/PUT calls, grid UI instead of a list. Delete the file:

```bash
git rm dashboard/src/components/AvailabilityManager.tsx
```

- [ ] **Step 3: Create the Календарь page**

`dashboard/src/app/d/calendar/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { CalendarGrid } from "@/components/CalendarGrid";
import { ErrorBanner, SuccessBanner } from "@/components/StatusBanner";
import { tmaFetch } from "@/lib/telegram/client";
import type { AvailabilityEntry } from "@/lib/types";
import { useCompanyProfile } from "@/lib/useCompanyProfile";

export default function CalendarPage() {
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useCompanyProfile();
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [calendarIdInput, setCalendarIdInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSaved, setConnectSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<number | null>(null);

  function loadEntries() {
    setLoadingEntries(true);
    tmaFetch("/api/availability")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить даты (${res.status})`);
        return (await res.json()) as AvailabilityEntry[];
      })
      .then(setEntries)
      .catch((err) => setEntriesError(err instanceof Error ? err.message : "Не удалось загрузить даты"))
      .finally(() => setLoadingEntries(false));
  }

  useEffect(() => {
    loadEntries();
    tmaFetch("/api/calendar/service-account")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось получить email сервисного аккаунта (${res.status})`);
        return (await res.json()) as { email: string };
      })
      .then((body) => setServiceAccountEmail(body.email))
      .catch((err) => setEmailError(err instanceof Error ? err.message : "Не удалось получить email"));
  }, []);

  useEffect(() => {
    if (profile) setCalendarIdInput(profile.googleCalendarId ?? "");
  }, [profile]);

  async function connect() {
    setConnecting(true);
    setConnectError(null);
    setConnectSaved(false);
    try {
      const res = await tmaFetch("/api/calendar/connect", {
        method: "PUT",
        body: JSON.stringify({ calendarId: calendarIdInput || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось сохранить (${res.status})`);
      }
      setConnectSaved(true);
      await refetchProfile();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setConnecting(false);
    }
  }

  async function sync() {
    if (!profile?.googleCalendarId) return;
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const res = await tmaFetch("/api/calendar/sync", {
        method: "POST",
        body: JSON.stringify({ calendarId: profile.googleCalendarId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Не удалось синхронизировать (${res.status})`);
      }
      const body: { syncedCount: number } = await res.json();
      setSyncResult(body.syncedCount);
      loadEntries();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Не удалось синхронизировать");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <h1>Календарь</h1>
      <p className="muted">Свободные и занятые даты, которые бот использует, отвечая клиентам.</p>

      <div className="card">
        <div className="card-title-row">
          <h3>Google Calendar</h3>
        </div>
        {emailError && <ErrorBanner message={emailError} />}
        {serviceAccountEmail && (
          <p className="muted">
            Откройте настройки доступа своего календаря в Google Calendar и предоставьте доступ на просмотр этому
            адресу: <strong>{serviceAccountEmail}</strong>
          </p>
        )}
        <div className="field">
          <label>ID вашего календаря (обычно ваш email)</label>
          <input value={calendarIdInput} onChange={(e) => setCalendarIdInput(e.target.value)} placeholder="you@gmail.com" />
        </div>
        {connectError && <ErrorBanner message={connectError} />}
        {connectSaved && <SuccessBanner message="Сохранено" />}
        <button className="btn btn-secondary" onClick={connect} disabled={connecting}>
          {connecting ? "Сохранение…" : "Сохранить"}
        </button>
        {profile?.googleCalendarId && (
          <div style={{ marginTop: "0.9rem" }}>
            {syncError && <ErrorBanner message={syncError} />}
            {syncResult !== null && <SuccessBanner message={`Синхронизировано дат: ${syncResult}`} />}
            <button className="btn btn-primary" onClick={sync} disabled={syncing}>
              {syncing ? "Синхронизация…" : "Синхронизировать сейчас"}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        {(loadingEntries || profileLoading) && <p className="muted">Загрузка…</p>}
        {entriesError && <ErrorBanner message={entriesError} />}
        {profileError && <ErrorBanner message={profileError} />}
        {!loadingEntries && !entriesError && <CalendarGrid entries={entries} onChanged={loadEntries} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `cd dashboard && npm run build`
Expected: build succeeds. `/d/calendar` appears as a new route; `AvailabilityManager.tsx` no longer exists and nothing imports it.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/d/calendar/page.tsx dashboard/src/app/d/configuration/page.tsx
git rm dashboard/src/components/AvailabilityManager.tsx
git commit -m "feat(dashboard): add Календарь section with visual grid and Google Calendar connect/sync"
```

---

### Task 10: Sidebar wiring + final verification

**Files:**
- Modify: `dashboard/src/components/Sidebar.tsx`

- [ ] **Step 1: Add the two new nav items**

`dashboard/src/components/Sidebar.tsx` currently has:

```tsx
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
  SendIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
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
  { href: "/d/catalog", label: "Каталог", Icon: TagIcon },
  { href: "/d/calendar", label: "Календарь", Icon: CalendarIcon },
  { href: "/d/configuration", label: "Настройки", Icon: GearIcon },
  { href: "/d/test-console", label: "Тест-консоль", Icon: FlaskIcon },
  { href: "/d/assistant", label: "Ассистент", Icon: SparkleIcon },
] as const;
```

- [ ] **Step 2: Verify the full build and test suite**

Run: `cd dashboard && npm run build && npm test`
Expected: build succeeds (10 desktop nav destinations now: `/d`, 4 CRM children, `/d/catalog`, `/d/calendar`, `/d/configuration`, `/d/test-console`, `/d/assistant`), all tests pass.

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest -q`
Expected: all tests pass.

- [ ] **Step 3: Manual/browser verification**

Run `cd dashboard && npm run dev`. Use a real browser/screenshot tool if one is available in your environment (prior sessions in this project found a cached Playwright chromium-headless-shell usable directly); otherwise fall back to build+HTTP-level checks and say so explicitly. This worktree likely has no `.env.local` — if so, note that only the login-gate render is checkable live, everything else via code inspection, same limitation as recent prior passes.

Check, to whatever extent possible:
1. Sidebar shows Каталог and Календарь between the CRM group and Настройки.
2. `/d/catalog` — packages and partners render as photo cards (placeholder box when no `imageUrl`), grouped under one page.
3. `/d/configuration` — only 4 tabs remain (О заведении, Вопросы, Пробелы, Политики).
4. `/d/test-console` — the ephemeral preset checkboxes and the new "Навыки ИИ" section both use the pill toggle switch, not native checkboxes, and are visually distinguishable from each other (the "Навыки ИИ" section has its own heading/caption below the chat frame).
5. `/d/calendar` — a month grid renders with Google Calendar connection fields above it; without a real `GOOGLE_SERVICE_ACCOUNT_JSON` configured, the service-account email fetch will show an error state — that's expected in an unconfigured environment, not a bug to fix here.

- [ ] **Step 4: Report**

Summarize what was verified vs. what could only be confirmed via build/tests/code inspection. Flag explicitly, for the human: **`GOOGLE_SERVICE_ACCOUNT_JSON` still needs to be set in the real backend environment (and a real service account created in Google Cloud Console) before the Календарь section's Google sync can be used for real** — this plan ships the code and its tests (all mocked), not that manual GCP setup step.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/Sidebar.tsx
git commit -m "feat(dashboard): add Каталог and Календарь to desktop navigation"
```
