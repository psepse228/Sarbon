-- 0009_add_google_calendar_id.sql
-- The venue's own Google Calendar ID (their calendar's email address),
-- shared with Solura's single Google service account (read-only access) so
-- backend/app/calendar_sync.py can sync busy days into availability_cache.
-- No per-tenant service account — one shared account, each owner grants it
-- view access to their own calendar.

alter table company_profile add column if not exists google_calendar_id text;
