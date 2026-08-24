-- One-row shortcut for the learner dashboard. Source tables update this row
-- through triggers, so the client needs only one read for XP, level and streak.
create table if not exists public.user_dashboard_snapshots (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  streak integer not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_dashboard_snapshots enable row level security;
drop policy if exists "users read own dashboard snapshot" on public.user_dashboard_snapshots;
create policy "users read own dashboard snapshot"
  on public.user_dashboard_snapshots for select to authenticated
  using (user_id = auth.uid());

create or replace function public.refresh_user_dashboard_snapshot(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  curriculum_count integer := 0;
  curriculum_xp integer := 0;
  account_xp integer := 0;
  account_streak integer := 0;
  affected integer := 0;
begin
  if p_user_id is null then return; end if;

  select count(*), coalesce(sum(xp), 0), coalesce(max(streak), 0)
    into curriculum_count, curriculum_xp, account_streak
  from public.curriculum_leaderboard_stats
  where user_id = p_user_id;

  if curriculum_count > 0 then
    account_xp := curriculum_xp;
  else
    select greatest(
      coalesce((select xp from public.profiles where id = p_user_id), 0),
      coalesce((select xp from public.leaderboard_stats where user_id = p_user_id), 0)
    ) into account_xp;
  end if;

  account_streak := greatest(
    account_streak,
    coalesce((select streak from public.leaderboard_stats where user_id = p_user_id), 0),
    coalesce((select current_streak from public.streak_states where user_id = p_user_id), 0)
  );

  update public.user_dashboard_snapshots
  set xp = account_xp,
      level = greatest(1, floor(account_xp / 200.0)::integer + 1),
      streak = account_streak,
      updated_at = now()
  where user_id = p_user_id;
  get diagnostics affected = row_count;

  if affected = 0 then
    insert into public.user_dashboard_snapshots (user_id, xp, level, streak, updated_at)
    values (
      p_user_id,
      account_xp,
      greatest(1, floor(account_xp / 200.0)::integer + 1),
      account_streak,
      now()
    );
  end if;
end;
$$;

create or replace function public.refresh_user_dashboard_snapshot_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_user_dashboard_snapshot(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;

do $$
declare source_table text;
begin
  foreach source_table in array array[
    'curriculum_leaderboard_stats',
    'leaderboard_stats',
    'streak_states'
  ] loop
    execute format('drop trigger if exists refresh_user_dashboard_snapshot_after_change on public.%I', source_table);
    execute format(
      'create trigger refresh_user_dashboard_snapshot_after_change after insert or update or delete on public.%I for each row execute function public.refresh_user_dashboard_snapshot_trigger()',
      source_table
    );
  end loop;
end;
$$;

-- Existing accounts receive a snapshot immediately when this migration runs.
do $$
declare learner record;
begin
  for learner in select id from public.profiles loop
    perform public.refresh_user_dashboard_snapshot(learner.id);
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_dashboard_snapshots'
  ) then
    alter publication supabase_realtime add table public.user_dashboard_snapshots;
  end if;
end;
$$;

comment on table public.user_dashboard_snapshots is
  'Precomputed per-user dashboard shortcut, refreshed automatically from XP and streak source tables.';
