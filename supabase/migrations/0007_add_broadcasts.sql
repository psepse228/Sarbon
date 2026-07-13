-- 0007_add_broadcasts.sql
-- Owner-triggered, send-now messages to a filtered guest audience (see
-- dashboard/src/lib/broadcasts.ts and backend POST /internal/broadcast).
-- No scheduling — this is a log of sends, not a queue.

create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  message text not null,
  audience text not null check (audience in ('all', 'leads_new', 'leads_contacted', 'leads_booked')),
  recipient_count integer not null default 0,
  created_at timestamptz default now()
);
create index idx_broadcasts_tenant on broadcasts(tenant_id);
