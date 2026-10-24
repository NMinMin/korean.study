-- All settings writes, including administrative changes, take effect next Monday.
create table public.study_target_versions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  effective_from date not null,
  target_completion_date date,
  primary key (user_id, effective_from)
);
alter table public.study_target_versions enable row level security;
create policy "read own target history" on public.study_target_versions for select to authenticated using (user_id = auth.uid());
insert into public.study_target_versions
select user_id, '-infinity'::date, target_completion_date from public.study_plans;
create function public.version_study_target() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_start date;
begin
  if TG_OP = 'UPDATE' then
    if new.target_completion_date is not distinct from old.target_completion_date then return new; end if;
  end if;
  select date_trunc('week', now() at time zone timezone)::date + 7 into v_start
    from public.profiles where id = new.user_id;
  insert into public.study_target_versions values (new.user_id, v_start, new.target_completion_date)
  on conflict (user_id, effective_from) do update set target_completion_date = excluded.target_completion_date;
  return new;
end; $$;
create trigger version_study_target after insert or update on public.study_plans
for each row execute function public.version_study_target();

create table public.study_plan_versions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  effective_from date not null,
  weekly_schedule smallint[] not null,
  daily_goal_minutes integer not null,
  primary key (user_id, effective_from)
);
alter table public.study_plan_versions enable row level security;
create policy "read own plan history" on public.study_plan_versions for select to authenticated using (user_id = auth.uid());
insert into public.study_plan_versions
select user_id, '-infinity'::date, weekly_schedule, daily_goal_minutes from public.user_settings;

create function public.version_study_settings() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_today date; v_start date;
begin
  select (now() at time zone coalesce(timezone, 'Asia/Ho_Chi_Minh'))::date into v_today
    from public.profiles where id = new.user_id;
  v_start := date_trunc('week', v_today)::date + 7;
  if TG_OP = 'INSERT' then
    insert into public.study_plan_versions values (new.user_id, '-infinity', array[1,2,3,4,5]::smallint[], 15)
    on conflict do nothing;
  elsif new.weekly_schedule is not distinct from old.weekly_schedule
    and new.daily_goal_minutes is not distinct from old.daily_goal_minutes then
    return new;
  end if;
  insert into public.study_plan_versions values (new.user_id, v_start, new.weekly_schedule, new.daily_goal_minutes)
  on conflict (user_id, effective_from) do update set weekly_schedule = excluded.weekly_schedule,
    daily_goal_minutes = excluded.daily_goal_minutes;
  return new;
end; $$;
create trigger version_study_settings after insert or update on public.user_settings
for each row execute function public.version_study_settings();

-- Save the learner's plan in one transaction, avoiding a partially saved plan.
create function public.save_weekly_study_plan(p_days smallint[], p_goal integer,
  p_target date, p_reminder boolean, p_time time, p_sound boolean) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_days is null or exists (select 1 from unnest(p_days) d where d is null or d < 1 or d > 7) then
    raise exception 'Invalid study days' using errcode = '22023';
  end if;
  insert into public.user_settings (user_id, weekly_schedule, daily_goal_minutes, reminder_enabled, reminder_time, effect_sound_enabled)
  values (auth.uid(), p_days, p_goal, p_reminder, p_time, p_sound)
  on conflict (user_id) do update set weekly_schedule = excluded.weekly_schedule,
    daily_goal_minutes = excluded.daily_goal_minutes, reminder_enabled = excluded.reminder_enabled,
    reminder_time = excluded.reminder_time, effect_sound_enabled = excluded.effect_sound_enabled, updated_at = now();
  insert into public.study_plans (user_id, target_completion_date) values (auth.uid(), p_target)
  on conflict (user_id) do update set target_completion_date = excluded.target_completion_date, updated_at = now();
end; $$;
revoke all on function public.save_weekly_study_plan(smallint[],integer,date,boolean,time,boolean) from public;
grant execute on function public.save_weekly_study_plan(smallint[],integer,date,boolean,time,boolean) to authenticated;

create function public.is_planned_study_day(p_user_id uuid, p_date date) returns boolean
language sql stable security definer set search_path = public as $$
  select extract(isodow from p_date)::integer = any(coalesce(
    (select weekly_schedule from public.study_plan_versions where user_id = p_user_id
      and effective_from <= p_date order by effective_from desc limit 1), array[1,2,3,4,5]::smallint[]));
$$;
create function public.missed_study_days(p_user_id uuid, p_last date, p_today date) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from generate_series(p_last + 1, p_today - 1, interval '1 day') d
    where public.is_planned_study_day(p_user_id, d::date);
$$;
revoke all on function public.is_planned_study_day(uuid,date), public.missed_study_days(uuid,date,date) from public;
grant execute on function public.is_planned_study_day(uuid,date), public.missed_study_days(uuid,date,date) to service_role;

-- Flashcards and review sessions share the same next-review date policy.
create function public.align_vocabulary_review_date() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_zone text; v_date date; v_offset integer;
begin
  if new.next_review_at is null then return new; end if;
  select timezone into v_zone from public.profiles where id = new.user_id;
  v_date := (new.next_review_at at time zone v_zone)::date;
  for v_offset in 0..369 loop
    if public.is_planned_study_day(new.user_id, v_date + v_offset) then
      new.next_review_at := ((v_date + v_offset)::timestamp at time zone v_zone);
      return new;
    end if;
  end loop;
  -- Preserve the due date while the learner has paused all study days.
  return new;
end; $$;
create trigger align_vocabulary_review_date before insert or update of next_review_at on public.vocabulary_progress
for each row execute function public.align_vocabulary_review_date();

create function public.reschedule_vocabulary_for_plan() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_zone text;
begin
  select timezone into v_zone from public.profiles where id = new.user_id;
  update public.vocabulary_progress set next_review_at = next_review_at
    where user_id = new.user_id and (next_review_at at time zone v_zone)::date >= new.effective_from;
  return new;
end; $$;
create trigger reschedule_vocabulary_for_plan after insert or update on public.study_plan_versions
for each row execute function public.reschedule_vocabulary_for_plan();

-- Align existing future reviews once without moving historical results.
update public.vocabulary_progress v set next_review_at = v.next_review_at
from public.profiles p where p.id = v.user_id
  and (v.next_review_at at time zone p.timezone)::date >= (now() at time zone p.timezone)::date;

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
    from public.study_plan_versions
   where user_id = p_user_id and effective_from <= p_study_date
   order by effective_from desc limit 1;

  v_goal := greatest(1, coalesce(v_goal, 15));

  -- A day only counts when the user's configured daily goal is reached.
  if v_minutes < v_goal then
    return;
  end if;

  -- SELECT INTO without a row nulls even initialized variables.
  -- Bootstrap first and lock to serialize concurrent goal completions.
  insert into public.streak_states (user_id, current_streak, longest_streak)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  select
    coalesce(current_streak, 0),
    coalesce(longest_streak, 0),
    last_study_date,
    coalesce(freeze_available, true)
    into v_current, v_longest, v_last, v_freeze
    from public.streak_states
   where user_id = p_user_id
   for update;

  -- Already counted this day.
  if v_last is not null and v_last >= p_study_date then
    return;
  end if;

  if v_last is null then
    v_current := 1;
    v_freeze := true;
  else
    v_gap := public.missed_study_days(p_user_id, v_last, p_study_date);

    if v_gap = 0 then
      v_current := v_current + 1;
      v_freeze := true;
    elsif v_gap < 3 then
      -- Frozen period: keep the streak alive after a short missed break.
      v_current := v_current + 1;
      v_freeze := false;
    else
      -- Three planned study days were missed; start a new streak.
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
    from public.streak_states s join public.profiles p on p.id = s.user_id
   where current_streak > 0 and last_study_date is not null
     and public.missed_study_days(s.user_id, last_study_date, (now() at time zone p.timezone)::date) >= 3;

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


revoke all on function public.expire_inactive_streaks() from public, authenticated;
grant execute on function public.expire_inactive_streaks() to service_role;

-- Record against the learner local date, matching the daily goal read.
-- Increment study time with one atomic request. This replaces the client-side
-- read-settings + read-stats + two-upsert polling loop.

create or replace function public.record_study_minutes(p_minutes numeric, p_study_date date)
returns table (
  study_date date,
  today_minutes numeric,
  target_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := coalesce(p_study_date, current_date);
  v_minutes numeric := greatest(0, least(coalesce(p_minutes, 0), 10));
  v_total numeric := 0;
  v_target integer := 15;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_date < current_date - 1 or v_date > current_date + 1 then
    raise exception 'Study date must be within one day of server date' using errcode = '22023';
  end if;
  if v_minutes <= 0 then
    raise exception 'Minutes must be greater than zero' using errcode = '22023';
  end if;

  update public.daily_study_stats ds
  set minutes = coalesce(ds.minutes, 0) + v_minutes,
      updated_at = now()
  where ds.user_id = v_user_id
    and ds.study_date = v_date
  returning ds.minutes into v_total;

  if not found then
    begin
      insert into public.daily_study_stats (user_id, study_date, minutes, updated_at)
      values (v_user_id, v_date, v_minutes, now())
      returning minutes into v_total;
    exception when unique_violation then
      update public.daily_study_stats ds
      set minutes = coalesce(ds.minutes, 0) + v_minutes,
          updated_at = now()
      where ds.user_id = v_user_id
        and ds.study_date = v_date
      returning ds.minutes into v_total;
    end;
  end if;

  select coalesce(us.daily_goal_minutes, 15)
  into v_target
  from public.study_plan_versions us
  where us.user_id = v_user_id and us.effective_from <= v_date
  order by us.effective_from desc limit 1;
  v_target := coalesce(v_target, 15);

  return query select v_date, coalesce(v_total, v_minutes), v_target;
end;
$$;

revoke all on function public.record_study_minutes(numeric, date) from public;
grant execute on function public.record_study_minutes(numeric, date) to authenticated;


-- Increment study time with one atomic request. This replaces the client-side
-- read-settings + read-stats + two-upsert polling loop.

create or replace function public.record_study_minutes(p_minutes numeric)
returns table (
  study_date date,
  today_minutes numeric,
  target_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := current_date;
  v_minutes numeric := greatest(0, least(coalesce(p_minutes, 0), 10));
  v_total numeric := 0;
  v_target integer := 15;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_minutes <= 0 then
    raise exception 'Minutes must be greater than zero' using errcode = '22023';
  end if;

  update public.daily_study_stats ds
  set minutes = coalesce(ds.minutes, 0) + v_minutes,
      updated_at = now()
  where ds.user_id = v_user_id
    and ds.study_date = v_date
  returning ds.minutes into v_total;

  if not found then
    begin
      insert into public.daily_study_stats (user_id, study_date, minutes, updated_at)
      values (v_user_id, v_date, v_minutes, now())
      returning minutes into v_total;
    exception when unique_violation then
      update public.daily_study_stats ds
      set minutes = coalesce(ds.minutes, 0) + v_minutes,
          updated_at = now()
      where ds.user_id = v_user_id
        and ds.study_date = v_date
      returning ds.minutes into v_total;
    end;
  end if;

  select coalesce(us.daily_goal_minutes, 15)
  into v_target
  from public.study_plan_versions us
  where us.user_id = v_user_id and us.effective_from <= v_date
  order by us.effective_from desc limit 1;
  v_target := coalesce(v_target, 15);

  return query select v_date, coalesce(v_total, v_minutes), v_target;
end;
$$;

revoke all on function public.record_study_minutes(numeric) from public;
grant execute on function public.record_study_minutes(numeric) to authenticated;


notify pgrst, 'reload schema';
