-- 0006_add_disabled_skills.sql
-- Skill keys the owner has turned off (see backend/app/ai/engine.py's
-- TOGGLEABLE_TOOLS). Empty array (the default) means every toggleable
-- tool is offered to the model, same as before this column existed.

alter table company_profile add column if not exists disabled_skills jsonb not null default '[]'::jsonb;
