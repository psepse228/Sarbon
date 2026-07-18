-- 0011_add_lead_notes.sql
-- Free-text notes the owner keeps on a lead (call outcomes, preferences,
-- anything not captured by the structured fields) -- shown/edited from the
-- new lead detail modal on /d/leads.

alter table cortege_leads add column if not exists notes text;
