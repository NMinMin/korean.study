alter table public.vocabulary_progress
  add column if not exists last_rating text check (last_rating in ('good', 'forgot', 'vague')),
  add column if not exists times_reviewed integer not null default 0 check (times_reviewed >= 0);
