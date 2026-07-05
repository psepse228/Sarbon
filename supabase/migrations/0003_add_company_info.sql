-- 0003_add_company_info.sql
-- Adds basic company-identity fields (shown in the dashboard's new
-- "Профиль компании" page and woven into the client bot's system prompt,
-- same pattern as active_notice). NULL/empty means not set.

alter table company_profile add column if not exists company_name text;
alter table company_profile add column if not exists address text;
alter table company_profile add column if not exists phone text;
alter table company_profile add column if not exists socials text;
