create table if not exists public.curriculum_leaderboard_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  streak integer not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, textbook_id)
);

create index if not exists curriculum_leaderboard_rank_idx
  on public.curriculum_leaderboard_stats(textbook_id, xp desc, streak desc, updated_at);

alter table public.curriculum_leaderboard_stats enable row level security;

create policy "curriculum leaderboard is readable"
  on public.curriculum_leaderboard_stats for select to authenticated using (true);
create policy "users create own curriculum leaderboard stats"
  on public.curriculum_leaderboard_stats for insert to authenticated
  with check (user_id = auth.uid());
create policy "users update own curriculum leaderboard stats"
  on public.curriculum_leaderboard_stats for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
