-- 0012_enable_rls.sql
-- Defense-in-depth, mirroring Tender Agent's 0008_enable_rls.sql: the backend
-- and dashboard exclusively use the service_role key, which bypasses RLS
-- entirely, so this changes nothing about how the app behaves today. What it
-- does change: if the anon/authenticated key were ever accidentally exposed
-- (client-side code, a leaked .env, a future feature added without
-- checking) or misused, it could not read or write a single row -- RLS
-- enabled with zero policies is a hard deny-by-default for every other role.

alter table tenants enable row level security;
alter table company_profile enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table client_profiles enable row level security;
alter table availability_cache enable row level security;
alter table escalations enable row level security;
alter table knowledge_gaps enable row level security;
alter table cortege_leads enable row level security;
alter table broadcasts enable row level security;
alter table reviews enable row level security;
