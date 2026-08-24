-- Keep lesson/card progress, curriculum ranking, streak and dashboard shortcut
-- derived from the same canonical learning rows.

create or replace function public.refresh_learning_rollups(p_user_id uuid, p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_textbook_id uuid;
  v_progress numeric := 0;
  v_completed integer := 0;
  v_curriculum_xp integer := 0;
  v_streak integer := 0;
begin
  select textbook_id into v_textbook_id from public.lessons where id = p_lesson_id;
  if v_textbook_id is null then return; end if;

  select coalesce(round(sum(coalesce(progress_percent, 0)) / 4), 0),
         count(*) filter (where progress_percent >= 100)
    into v_progress, v_completed
  from public.activity_progress
  where user_id = p_user_id and lesson_id = p_lesson_id
    and activity_type in ('tuvung', 'nghechep', 'shadowing', 'ontap');

  insert into public.lesson_progress (
    user_id, textbook_id, lesson_id, progress_percent, last_activity,
    last_position, updated_at
  ) values (
    p_user_id, v_textbook_id, p_lesson_id, least(100, v_progress), 'lesson',
    jsonb_build_object('progressPercent', least(100, v_progress), 'completed', v_completed = 4), now()
  )
  on conflict (user_id, lesson_id) do update set
    textbook_id = excluded.textbook_id,
    progress_percent = excluded.progress_percent,
    last_position = excluded.last_position,
    updated_at = excluded.updated_at;

  select coalesce(round(sum(ap.progress_percent) / 100.0 * 25), 0)::integer
    into v_curriculum_xp
  from public.activity_progress ap
  join public.lessons l on l.id = ap.lesson_id
  where ap.user_id = p_user_id and l.textbook_id = v_textbook_id
    and ap.activity_type in ('tuvung', 'nghechep', 'shadowing', 'ontap');

  select coalesce(current_streak, 0) into v_streak
  from public.streak_states where user_id = p_user_id;

  insert into public.curriculum_leaderboard_stats (user_id, textbook_id, xp, streak, updated_at)
  values (p_user_id, v_textbook_id, v_curriculum_xp, v_streak, now())
  on conflict (user_id, textbook_id) do update set
    xp = excluded.xp, streak = excluded.streak, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_learning_rollups_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_learning_rollups(coalesce(new.user_id, old.user_id), coalesce(new.lesson_id, old.lesson_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_learning_rollups_after_activity on public.activity_progress;
drop trigger if exists activity_progress_sync_lesson on public.activity_progress;
create trigger refresh_learning_rollups_after_activity
after insert or update or delete on public.activity_progress
for each row execute function public.refresh_learning_rollups_trigger();

-- A streak is earned only after reaching the configured daily minute goal.
-- One missed calendar day consumes the freeze; two missed days reset the chain.
create or replace function public.refresh_streak_from_daily_goal(p_user_id uuid, p_study_date date)
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
  v_gap integer;
begin
  select coalesce(minutes, 0) into v_minutes from public.daily_study_stats
   where user_id = p_user_id and study_date = p_study_date;
  select coalesce(daily_goal_minutes, 15) into v_goal from public.user_settings where user_id = p_user_id;
  if v_minutes < v_goal then return; end if;

  select current_streak, longest_streak, last_study_date, freeze_available
    into v_current, v_longest, v_last, v_freeze
  from public.streak_states where user_id = p_user_id;

  if v_last = p_study_date then return; end if;
  v_gap := case when v_last is null then null else p_study_date - v_last end;
  if v_gap is null or v_gap <= 1 then
    v_current := v_current + 1;
  elsif v_gap = 2 and v_freeze then
    v_freeze := false;
  else
    v_current := 1;
  end if;
  v_longest := greatest(v_longest, v_current);

  insert into public.streak_states(user_id, current_streak, longest_streak, last_study_date, freeze_available, updated_at)
  values(p_user_id, v_current, v_longest, p_study_date, v_freeze, now())
  on conflict(user_id) do update set current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak, last_study_date = excluded.last_study_date,
    freeze_available = excluded.freeze_available, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_streak_from_daily_goal_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_streak_from_daily_goal(new.user_id, new.study_date);
  return new;
end;
$$;
drop trigger if exists refresh_streak_after_daily_minutes on public.daily_study_stats;
create trigger refresh_streak_after_daily_minutes after insert or update of minutes
on public.daily_study_stats for each row execute function public.refresh_streak_from_daily_goal_trigger();

create or replace function public.expire_inactive_streaks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.streak_states
  set current_streak = 0, updated_at = now()
  where current_streak > 0
    and last_study_date is not null
    and current_date - last_study_date >= 2;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_inactive_streaks() from public;
grant execute on function public.expire_inactive_streaks() to service_role;

-- Backfill all existing activity rows so users such as Mai Anh appear in the
-- correct curriculum ranking and completed lessons feed the review calendar.
do $$
declare r record;
begin
  for r in select distinct user_id, lesson_id from public.activity_progress loop
    perform public.refresh_learning_rollups(r.user_id, r.lesson_id);
  end loop;
end $$;

create table if not exists public.reminder_email_deliveries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, study_date)
);
alter table public.reminder_email_deliveries enable row level security;

notify pgrst, 'reload schema';
