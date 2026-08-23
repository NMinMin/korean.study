create table if not exists public.activity_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  activity_type text not null check (activity_type in ('tuvung', 'nghechep', 'shadowing', 'ontap')),
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  completed_items jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id, activity_type)
);
alter table public.activity_progress enable row level security;
drop policy if exists "users manage own activity progress" on public.activity_progress;
create policy "users manage own activity progress" on public.activity_progress for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists activity_progress_lesson_idx on public.activity_progress (lesson_id, activity_type);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activity_progress') then
    alter publication supabase_realtime add table public.activity_progress;
  end if;
end $$;
