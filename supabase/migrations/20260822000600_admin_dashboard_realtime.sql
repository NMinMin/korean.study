-- Allow admins to receive safe Realtime change events used to refresh aggregate
-- dashboard data. Learners still only see their own rows.
drop policy if exists "admins read all daily study stats" on public.daily_study_stats;
create policy "admins read all daily study stats" on public.daily_study_stats
  for select to authenticated using (public.is_admin());

drop policy if exists "admins read all lesson progress" on public.lesson_progress;
create policy "admins read all lesson progress" on public.lesson_progress
  for select to authenticated using (public.is_admin());

drop policy if exists "admins read all vocabulary progress" on public.vocabulary_progress;
create policy "admins read all vocabulary progress" on public.vocabulary_progress
  for select to authenticated using (public.is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_study_stats') then
    alter publication supabase_realtime add table public.daily_study_stats;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lesson_progress') then
    alter publication supabase_realtime add table public.lesson_progress;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vocabulary_progress') then
    alter publication supabase_realtime add table public.vocabulary_progress;
  end if;
end $$;
