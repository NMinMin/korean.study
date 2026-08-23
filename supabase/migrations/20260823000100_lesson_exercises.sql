create table if not exists public.lesson_exercises (
  id uuid primary key default gen_random_uuid(),
  source_key text,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  skill_type text not null check (skill_type in ('vocabulary_grammar','dictation','shadowing','review')),
  exercise_type text not null default 'question',
  prompt_ko text not null,
  prompt_vi text,
  answer jsonb not null default '{}'::jsonb,
  explanation_vi text,
  media_url text,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_exercises enable row level security;

drop policy if exists "published lesson exercises are readable" on public.lesson_exercises;
create policy "published lesson exercises are readable" on public.lesson_exercises
  for select to authenticated using (status = 'published' or public.is_admin());

drop policy if exists "admins manage lesson exercises" on public.lesson_exercises;
create policy "admins manage lesson exercises" on public.lesson_exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists lesson_exercises_lesson_skill_idx
  on public.lesson_exercises(lesson_id, skill_type, sort_order);

create unique index if not exists lesson_exercises_source_key_uidx
  on public.lesson_exercises(source_key);
