-- Persist AI questions for all learners.
alter table public.custom_lessons
 add column if not exists questions jsonb not null default '[]'::jsonb
 check (jsonb_typeof(questions) = 'array');
