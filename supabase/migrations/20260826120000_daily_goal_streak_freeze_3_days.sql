-- Streak policy:
-- - Only count a streak day when the learner reaches their daily goal.
-- - Missing 1-2 full days keeps the streak frozen; the next completed goal continues the streak.
-- - Missing 3 full days resets the streak, so the next completed goal starts again from 1.
-- - Keep dashboard snapshot in sync because the learner dashboard reads precomputed shortcuts.

create or replace function public.refresh_streak_from_daily_goal(p_user_id uuid, p_study_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes numeric := 0;
  v_goal integer := 15;
  v_current integer := 0;
  v_longest integer := 0;
  v_last date;
  v_freeze boolean := true;
  v_month date := date_trunc('month', p_study_date)::date;
  v_gap integer;
begin
  select coalesce(sum(minutes), 0)
    into v_minutes
    from public.daily_study_stats
   where user_id = p_user_id
     and study_date = p_study_date;

  select coalesce(daily_goal_minutes, 15)
    into v_goal
    from public.user_settings
   where user_id = p_user_id;

  v_goal := greatest(1, coalesce(v_goal, 15));

  -- A day only counts when the user's configured daily goal is reached.
  if v_minutes < v_goal then
    return;
  end if;

  select
    coalesce(current_streak, 0),
    coalesce(longest_streak, 0),
    last_study_date,
    coalesce(freeze_available, true)
    into v_current, v_longest, v_last, v_freeze
    from public.streak_states
   where user_id = p_user_id;

  -- Already counted this day.
  if v_last is not null and v_last >= p_study_date then
    return;
  end if;

  if v_last is null then
    v_current := 1;
    v_freeze := true;
  else
    v_gap := p_study_date - v_last;

    if v_gap <= 1 then
      v_current := v_current + 1;
      v_freeze := true;
    elsif v_gap <= 3 then
      -- Frozen period: keep the streak alive after a short missed break.
      v_current := v_current + 1;
      v_freeze := false;
    else
      -- Three full missed days already passed; start a new streak.
      v_current := 1;
      v_freeze := true;
    end if;
  end if;

  v_longest := greatest(coalesce(v_longest, 0), v_current);

  insert into public.streak_states (
    user_id,
    current_streak,
    longest_streak,
    last_study_date,
    freeze_available,
    freeze_granted_month,
    updated_at
  )
  values (
    p_user_id,
    v_current,
    v_longest,
    p_study_date,
    v_freeze,
    v_month,
    now()
  )
  on conflict (user_id) do update
    set current_streak = excluded.current_streak,
        longest_streak = excluded.longest_streak,
        last_study_date = excluded.last_study_date,
        freeze_available = excluded.freeze_available,
        freeze_granted_month = excluded.freeze_granted_month,
        updated_at = now();

  update public.curriculum_leaderboard_stats
     set streak = v_current,
         updated_at = now()
   where user_id = p_user_id;

  update public.leaderboard_stats
     set streak = v_current,
         updated_at = now()
   where user_id = p_user_id;

  perform public.refresh_user_dashboard_snapshot(p_user_id);
end;
$$;

create or replace function public.expire_inactive_streaks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ids uuid[];
  v_uid uuid;
begin
  select coalesce(array_agg(user_id), array[]::uuid[])
    into v_user_ids
    from public.streak_states
   where current_streak > 0
     and last_study_date is not null
     and current_date - last_study_date >= 3;

  if coalesce(array_length(v_user_ids, 1), 0) = 0 then
    return 0;
  end if;

  update public.streak_states
     set current_streak = 0,
         freeze_available = true,
         freeze_granted_month = date_trunc('month', current_date)::date,
         updated_at = now()
   where user_id = any(v_user_ids);

  update public.curriculum_leaderboard_stats
     set streak = 0,
         updated_at = now()
   where user_id = any(v_user_ids);

  update public.leaderboard_stats
     set streak = 0,
         updated_at = now()
   where user_id = any(v_user_ids);

  foreach v_uid in array v_user_ids loop
    perform public.refresh_user_dashboard_snapshot(v_uid);
  end loop;

  return array_length(v_user_ids, 1);
end;
$$;

grant execute on function public.refresh_streak_from_daily_goal(uuid, date) to authenticated;
grant execute on function public.expire_inactive_streaks() to service_role;

notify pgrst, 'reload schema';
