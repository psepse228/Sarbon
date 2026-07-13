-- 0008_add_reviews.sql
-- Ratings/feedback a guest volunteers unprompted during a conversation
-- (capture_review tool, backend/app/ai/engine.py). No unique constraint on
-- conversation_id — unlike leads, a review isn't incrementally built up, so
-- if a guest leaves feedback twice both rows are kept as-is.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  conversation_id uuid references conversations(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);
create index idx_reviews_tenant on reviews(tenant_id);
