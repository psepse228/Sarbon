-- 0001_init_schema.sql
-- Multi-tenant schema for the wedding restaurant chatbot pilot.

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  telegram_bot_token text,
  instagram_account_id text,
  created_at timestamptz default now()
);

create table company_profile (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  packages jsonb,
  faq jsonb,
  partners jsonb,
  policies text,
  updated_at timestamptz default now()
);
create index idx_company_profile_tenant_id on company_profile(tenant_id);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  channel text check (channel in ('telegram', 'instagram')),
  client_id text not null,
  status text default 'active',
  last_message_at timestamptz,
  created_at timestamptz default now()
);
create index idx_conversations_tenant_id on conversations(tenant_id);
create index idx_conversations_tenant_client on conversations(tenant_id, client_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  role text check (role in ('client', 'bot', 'human')),
  content text not null,
  created_at timestamptz default now()
);
create index idx_messages_conversation_id on messages(conversation_id);

create table client_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  client_id text not null,
  summary text,
  tags text[],
  last_interaction timestamptz
);
create index idx_client_profiles_tenant_id on client_profiles(tenant_id);
create unique index idx_client_profiles_tenant_client on client_profiles(tenant_id, client_id);

create table availability_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  date date not null,
  is_available boolean,
  event_details text,
  synced_at timestamptz default now()
);
create index idx_availability_cache_tenant_date on availability_cache(tenant_id, date);

create table escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  reason text,
  notified_owner boolean default false,
  created_at timestamptz default now()
);
create index idx_escalations_conversation_id on escalations(conversation_id);
