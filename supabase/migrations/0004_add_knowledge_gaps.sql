-- 0004_add_knowledge_gaps.sql
-- Questions the guest bot couldn't ground an answer for (flag_knowledge_gap
-- tool, backend/app/ai/engine.py). Owner reviews/answers/dismisses these
-- from the dashboard's Configuration -> "Пробелы" tab. Answering appends
-- the question/answer pair to company_profile.faq; dismissing just closes
-- the row with no FAQ entry created.

create table knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  conversation_id uuid references conversations(id),
  question text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  answer text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index idx_knowledge_gaps_tenant_status on knowledge_gaps(tenant_id, status);
