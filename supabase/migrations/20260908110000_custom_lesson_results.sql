-- Store one current test result per learner and custom vocabulary set.
-- Set owners can read the results for statistics; learners can manage only their own row.

create table if not exists public.custom_lesson_results (
  lesson_id uuid not null references public.custom_lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  percentage numeric(5,2) generated always as (round(score::numeric * 100 / total, 2)) stored,
  completed_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

create index if not exists custom_lesson_results_lesson_score_idx
  on public.custom_lesson_results(lesson_id, percentage desc, completed_at desc);

alter table public.custom_lesson_results enable row level security;

drop policy if exists "learners read own custom lesson results" on public.custom_lesson_results;
create policy "learners read own custom lesson results"
on public.custom_lesson_results for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.custom_lessons lesson
    where lesson.id = custom_lesson_results.lesson_id
      and lesson.creator_id = auth.uid()
  )
);

drop policy if exists "learners create own custom lesson results" on public.custom_lesson_results;
create policy "learners create own custom lesson results"
on public.custom_lesson_results for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "learners update own custom lesson results" on public.custom_lesson_results;
create policy "learners update own custom lesson results"
on public.custom_lesson_results for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.custom_lesson_results to authenticated;
