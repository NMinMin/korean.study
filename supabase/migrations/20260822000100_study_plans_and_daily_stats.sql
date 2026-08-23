-- Per-user study planning and daily learning time.
create table if not exists public.study_plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  target_completion_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_study_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_date date not null default current_date,
  minutes numeric(8,2) not null default 0 check (minutes >= 0 and minutes <= 1440),
  updated_at timestamptz not null default now(),
  primary key (user_id, study_date)
);

alter table public.study_plans enable row level security;
alter table public.daily_study_stats enable row level security;

create policy "users manage own study plan"
  on public.study_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users manage own daily study stats"
  on public.daily_study_stats for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists daily_study_stats_user_date_idx
  on public.daily_study_stats(user_id, study_date desc);
