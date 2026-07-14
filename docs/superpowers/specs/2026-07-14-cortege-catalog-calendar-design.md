# Cortège Catalog, Calendar & Skills Relocation — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Owner's second design-review pass. Redesign the native checkboxes into proper toggle switches, split "Пакеты"/"Партнёры" out of Настройки into a new dedicated "Каталог" section with photo support, move "Навыки" into Test Console (renamed "Навыки ИИ"), and split Availability out of Настройки into a new dedicated "Календарь" section with a visual month grid plus a real Google Calendar sync (Service Account approach, confirmed with the owner).

## A. Toggle switches replace native checkboxes

The owner circled the plain browser checkboxes in both the Test Console preset editor and Настройки → Навыки as looking out of place against the glass aesthetic. New shared `.toggle-switch` component/CSS: a pill-shaped switch (track + sliding knob), mint-filled when on, matching the existing `.segmented`/`.btn-primary` accent language. Applied everywhere a skill/capability is turned on or off — the Test Console preset editor (already shipped) and the relocated Skills editor (Section C).

## B. New "Каталог" (Catalog) section

**Problem:** Пакеты and Партнёры currently live as two tabs inside Настройки, plain form-per-item lists with no visual product-card feel, and no photo support at all.

**Fix:** New top-level Sidebar destination `/d/catalog`, "Каталог". Contains the existing `PackagesEditor` and `PartnersEditor` logic, but redesigned as a card grid (reusing `.card`/glass styling) instead of stacked forms, and both `Package` and `Partner` gain an optional photo:

```ts
// dashboard/src/lib/types.ts
export interface Package {
  // ...existing fields unchanged...
  imageUrl: string | null;
}
export interface Partner {
  // ...existing fields unchanged...
  imageUrl: string | null;
}
```

**Photo input for this pass: a URL field with a live thumbnail preview, not a file-upload widget.** This repo has no Supabase Storage bucket configured yet, and standing one up (bucket creation, public/signed-URL policy) is a separate infrastructure decision — a URL field ships real photo support today with zero new infra; direct upload is a reasonable fast-follow once the owner wants it. No backend/migration change needed — `packages`/`partners` are already `jsonb` columns on `company_profile`, so `imageUrl` is just a new key in the same JSON blobs `PackagesEditor`/`PartnersEditor` already read/write.

Настройки loses the "Пакеты" and "Партнёры" tabs; its remaining tabs are О заведении, Вопросы, Пробелы, Политики.

## C. Skills move into Test Console, renamed "Навыки ИИ"

The existing `SkillsEditor` (persisted — writes `company_profile.disabled_skills`, the same column the real guest bot reads) moves from Настройки onto the Test Console page, under a heading "Навыки ИИ". **This is a distinct, clearly-separated section from the ephemeral test-only preset switcher already on that page** (shipped in the prior polish pass) — the preset switcher is session-local and never persists; "Навыки ИИ" is the real, saved configuration. Visually separate them (a divider + distinct heading + a short caption on "Навыки ИИ" clarifying "эти настройки применяются к реальному боту для всех клиентов", vs. the preset switcher's existing "только для этого теста" framing) so the owner never confuses the two.

Настройки loses its "Навыки" tab entirely.

## D. New "Календарь" (Calendar) section

**Problem:** Availability is currently a tab inside Настройки with a flat add/list form, and there is no Google Calendar integration at all — every date is entered by hand.

**Fix:** New top-level Sidebar destination `/d/calendar`, "Календарь". Two parts:

### D.1 Visual month grid (replaces the list-based `AvailabilityManager` UI)

A 7-column (Пн–Вс) month grid with prev/next-month navigation, each day cell colored by its `availability_cache` entry (mint tint = available, muted/dimmed = booked, neutral = no entry yet). Clicking a day reveals an inline edit form below the grid (available toggle + event-details text + save), reusing the existing `PUT /api/availability` endpoint as-is (already upserts by date — no backend change needed for this half).

### D.2 Google Calendar sync (Service Account — confirmed with the owner)

**Approach:** Solura provisions one Google Cloud service account (not per-tenant); the owner shares their own Google Calendar with that service account's email (view access is enough). The dashboard shows that email so the owner can copy it into Google Calendar's sharing settings, plus a field for the owner's own calendar ID (their calendar's email address, typically their Gmail).

**New Supabase column** (`supabase/migrations/0009_add_google_calendar_id.sql`):
```sql
alter table company_profile add column if not exists google_calendar_id text;
```

**New backend dependencies** (`backend/requirements.txt`): `google-api-python-client`, `google-auth`.

**New backend config**: `GOOGLE_SERVICE_ACCOUNT_JSON` env var — the full service-account key JSON as a string (same manual-env-var pattern already used for other secrets in this repo).

**New backend module** `backend/app/calendar_sync.py`:
- `get_service_account_email() -> str` — parses `GOOGLE_SERVICE_ACCOUNT_JSON`, returns `client_email`.
- `async def sync_calendar(tenant_id: str, calendar_id: str) -> int` — lists events on `calendar_id` for the next 90 days via the Google Calendar API, and for each **day that has at least one event**, upserts `availability_cache` with `is_available=false` and `event_details` set to that day's event summary/summaries. Returns the count of days synced. **Only asserts busy days from real calendar events — never marks a day "available" from the absence of an event** (that would be fabricating a fact the calendar didn't actually state; a day with no calendar event and no prior manual entry simply stays unset, exactly like today's manual-only flow).

**New backend endpoints** (`backend/app/routers/internal.py`, same shared-secret pattern as `/internal/test-chat` and `/internal/broadcast`):
- `GET /internal/calendar-service-account-email` → `{"email": str}` — no tenant scoping needed, the service account is shared infrastructure.
- `POST /internal/sync-calendar` body `{"tenant_id": str, "calendar_id": str}` → `{"synced_count": int}`.

**Dashboard:** `dashboard/src/lib/calendar.ts` (fetch the service-account email, trigger a sync, save `googleCalendarId` onto `company_profile` reusing the existing `upsertColumn` pattern already used for `disabled_skills`/`policies`). The Календарь page shows: a connection panel (service-account email to copy, calendar-ID input, save, and a "Синхронизировать сейчас" button once a calendar ID is saved — manual trigger only, no automatic background sync, matching this repo's existing constraint of having no job scheduler) above the D.1 month grid.

## Explicitly out of scope for this pass

- Direct photo file upload (Supabase Storage) — URL field only, per Section B's reasoning.
- Automatic/scheduled Google Calendar sync — manual "sync now" button only, same scheduler-infrastructure constraint that already deferred broadcasts-as-automation and proactive review requests.
- Two-way sync (Cortège writing bookings back to the owner's Google Calendar) — read-only sync from Google into `availability_cache` only.
- Per-tenant service accounts / OAuth — one shared service account, owner shares access to it, per the owner's own confirmed choice.

## Open questions for planning

1. Exact Sidebar placement of "Каталог" and "Календарь" relative to the existing CRM group and Настройки — reasonable default: Обзор → CRM group → Каталог → Календарь → Настройки → Тест-консоль → Ассистент (both new items read as owner-configuration surfaces, grouped near Настройки without being buried inside it) — not a design blocker, confirm during planning.
2. Month-grid component structure/date-math details — implementation detail.
