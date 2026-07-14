-- 0010_add_tenant_owner_email.sql
-- Links a tenant to the Google account that owns it. Unique so two Google
-- accounts can never collide onto the same tenant, and so a race between two
-- concurrent first-logins for the same brand-new email is caught by Postgres
-- (unique_violation, code 23505) rather than silently creating two tenants —
-- see dashboard/src/lib/telegram/auth.ts's resolveOrCreateTenantByEmail.

alter table tenants add column if not exists owner_email text unique;
