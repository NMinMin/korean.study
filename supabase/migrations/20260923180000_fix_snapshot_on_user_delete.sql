-- Preserve the existing function permissions while fixing cascading deletes.
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

  -- Cascading account deletion also fires the source-table DELETE triggers.
  -- Do not recreate a snapshot after its parent profile has been deleted.
  -- Keep an existing profile alive until this transaction finishes writing.
  perform 1 from public.profiles where id = p_user_id for key share;
  if not found then return; end if;

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


