-- 0005_add_leads.sql
-- Guests who showed booking intent (capture_lead tool, backend/app/ai/engine.py).
-- One row per conversation — capture_lead upserts as more fields are learned
-- over the conversation. Owner works the pipeline from the dashboard's new
-- Leads page; marking a lead "booked" also marks its date unavailable in
-- availability_cache.
--
-- Named cortege_leads, not leads: this Supabase project already has an
-- unrelated "leads" table belonging to Solura's CRM assistant (Jonik's) —
-- different schema (business_name/category/city/...), do not touch it.

create table cortege_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  conversation_id uuid references conversations(id) unique,
  name text,
  phone text,
  preferred_date date,
  guest_count integer,
  budget text,
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'lost')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_cortege_leads_tenant_status on cortege_leads(tenant_id, status);
