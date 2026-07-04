-- 0002_add_active_notice.sql
-- Lets the owner-facing AI assistant post a short-lived announcement
-- (e.g. "we have a promotion starting tomorrow") that the client-facing bot
-- weaves into its answers. NULL/empty means no active notice.

alter table company_profile add column if not exists active_notice text;
