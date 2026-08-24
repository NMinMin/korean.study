-- Reconcile the live Supabase schema with the current application.
-- This migration is intentionally idempotent and replaces the missing pieces
-- from 20260824103000 without reverting the newer ranking/streak behavior.

-- ---------------------------------------------------------------------------
-- Reminder delivery ledger (backend service-role only)
-- ---------------------------------------------------------------------------

create table if not exists public.reminder_email_deliveries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, study_date)
);

alter table public.reminder_email_deliveries enable row level security;
revoke all on table public.reminder_email_deliveries from anon, authenticated;
grant all on table public.reminder_email_deliveries to service_role;

-- ---------------------------------------------------------------------------
-- Canonical activity write RPC and learning rollups
-- ---------------------------------------------------------------------------

create or replace function public.save_activity_progress(
  p_textbook_id uuid,
  p_lesson_id uuid,
  p_activity_type text,
  p_progress_percent numeric,
  p_completed_items jsonb,
  p_completed_at timestamptz
)
returns public.activity_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_textbook_id uuid;
  v_progress numeric := greatest(0, least(100, coalesce(p_progress_percent, 0)));
  saved public.activity_progress;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_activity_type not in ('tuvung', 'nghechep', 'shadowing', 'ontap') then
    raise exception 'Unsupported activity type' using errcode = '22023';
  end if;

  select l.textbook_id into v_textbook_id
  from public.lessons l
  where l.id = p_lesson_id;

  if v_textbook_id is null then
    raise exception 'Lesson not found' using errcode = '23503';
  end if;
  if p_textbook_id is distinct from v_textbook_id then
    raise exception 'Lesson does not belong to textbook' using errcode = '23514';
  end if;

  update public.activity_progress
  set textbook_id = v_textbook_id,
      progress_percent = v_progress,
      completed_items = coalesce(p_completed_items, '{}'::jsonb),
      completed_at = case when v_progress >= 100 then coalesce(p_completed_at, now()) else null end,
      updated_at = now()
  where user_id = v_user_id
    and lesson_id = p_lesson_id
    and activity_type = p_activity_type
  returning * into saved;

  if saved.user_id is null then
    begin
      insert into public.activity_progress (
        user_id, textbook_id, lesson_id, activity_type, progress_percent,
        completed_items, completed_at, updated_at
      ) values (
        v_user_id, v_textbook_id, p_lesson_id, p_activity_type, v_progress,
        coalesce(p_completed_items, '{}'::jsonb),
        case when v_progress >= 100 then coalesce(p_completed_at, now()) else null end,
        now()
      )
      returning * into saved;
    exception when unique_violation then
      update public.activity_progress
      set textbook_id = v_textbook_id,
          progress_percent = v_progress,
          completed_items = coalesce(p_completed_items, '{}'::jsonb),
          completed_at = case when v_progress >= 100 then coalesce(p_completed_at, now()) else null end,
          updated_at = now()
      where user_id = v_user_id
        and lesson_id = p_lesson_id
        and activity_type = p_activity_type
      returning * into saved;
    end;
  end if;

  return saved;
end;
$$;

revoke all on function public.save_activity_progress(uuid, uuid, text, numeric, jsonb, timestamptz) from public;
grant execute on function public.save_activity_progress(uuid, uuid, text, numeric, jsonb, timestamptz) to authenticated;
revoke insert, update, delete on table public.activity_progress from anon, authenticated;
grant select on table public.activity_progress to authenticated;

create or replace function public.refresh_learning_rollups(p_user_id uuid, p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_textbook_id uuid;
  v_progress numeric := 0;
  v_completed integer := 0;
  v_curriculum_xp integer := 0;
  v_streak integer := 0;
begin
  select l.textbook_id into v_textbook_id
  from public.lessons l
  where l.id = p_lesson_id;
  if v_textbook_id is null then return; end if;

  select coalesce(round(sum(coalesce(ap.progress_percent, 0)) / 4), 0),
         count(*) filter (where ap.progress_percent >= 100)
    into v_progress, v_completed
  from public.activity_progress ap
  where ap.user_id = p_user_id
    and ap.lesson_id = p_lesson_id
    and ap.activity_type in ('tuvung', 'nghechep', 'shadowing', 'ontap');

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

  select coalesce(round(sum(lp.progress_percent)), 0)::integer
    into v_curriculum_xp
  from public.lesson_progress lp
  where lp.user_id = p_user_id and lp.textbook_id = v_textbook_id;

  select coalesce(ss.current_streak, 0) into v_streak
  from public.streak_states ss
  where ss.user_id = p_user_id;

  insert into public.curriculum_leaderboard_stats (user_id, textbook_id, xp, streak, updated_at)
  values (p_user_id, v_textbook_id, v_curriculum_xp, v_streak, now())
  on conflict (user_id, textbook_id) do update set
    xp = excluded.xp,
    streak = excluded.streak,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.refresh_learning_rollups(uuid, uuid) from public;
grant execute on function public.refresh_learning_rollups(uuid, uuid) to service_role;

create or replace function public.refresh_learning_rollups_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_learning_rollups(
    coalesce(new.user_id, old.user_id),
    coalesce(new.lesson_id, old.lesson_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists activity_progress_sync_lesson on public.activity_progress;
drop trigger if exists refresh_learning_rollups_after_activity on public.activity_progress;
create trigger refresh_learning_rollups_after_activity
after insert or update or delete on public.activity_progress
for each row execute function public.refresh_learning_rollups_trigger();

drop function if exists public.sync_lesson_progress_from_activities();

-- Recalculate all existing activity-backed lessons, then preserve legacy
-- lesson_progress users that predate activity_progress.
do $$
declare r record;
begin
  for r in select distinct user_id, lesson_id from public.activity_progress loop
    perform public.refresh_learning_rollups(r.user_id, r.lesson_id);
  end loop;
end $$;

insert into public.curriculum_leaderboard_stats (user_id, textbook_id, xp, streak, updated_at)
select lp.user_id,
       lp.textbook_id,
       round(sum(lp.progress_percent))::integer,
       coalesce(max(ss.current_streak), 0)::integer,
       max(lp.updated_at)
from public.lesson_progress lp
left join public.streak_states ss on ss.user_id = lp.user_id
group by lp.user_id, lp.textbook_id
on conflict (user_id, textbook_id) do update set
  xp = excluded.xp,
  streak = excluded.streak,
  updated_at = excluded.updated_at;

-- ---------------------------------------------------------------------------
-- Daily-goal streak: one missed date freezes, two missed dates reset.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_streak_from_daily_goal(p_user_id uuid, p_study_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes numeric := 0;
  v_goal integer := 15;
  v_current integer := 0;
  v_longest integer := 0;
  v_last date;
  v_freeze boolean := true;
  v_freeze_month date := date_trunc('month', p_study_date)::date;
  v_saved_freeze_month date;
  v_gap integer;
begin
  select coalesce(ds.minutes, 0) into v_minutes
  from public.daily_study_stats ds
  where ds.user_id = p_user_id and ds.study_date = p_study_date;

  select coalesce(us.daily_goal_minutes, 15) into v_goal
  from public.user_settings us
  where us.user_id = p_user_id;

  if v_minutes < v_goal then return; end if;

  select ss.current_streak, ss.longest_streak, ss.last_study_date,
         ss.freeze_available, ss.freeze_granted_month
    into v_current, v_longest, v_last, v_freeze, v_saved_freeze_month
  from public.streak_states ss
  where ss.user_id = p_user_id;

  if v_last is not null and v_last >= p_study_date then return; end if;

  if v_saved_freeze_month is null or v_saved_freeze_month < v_freeze_month then
    v_freeze := true;
    v_saved_freeze_month := v_freeze_month;
  end if;

  v_gap := case when v_last is null then null else p_study_date - v_last end;
  if v_gap is null or v_gap <= 1 then
    v_current := v_current + 1;
  elsif v_gap = 2 and v_freeze then
    v_freeze := false;
  else
    v_current := 1;
    v_freeze := true;
    v_saved_freeze_month := v_freeze_month;
  end if;
  v_longest := greatest(v_longest, v_current);

  insert into public.streak_states (
    user_id, current_streak, longest_streak, last_study_date,
    freeze_available, freeze_granted_month, updated_at
  ) values (
    p_user_id, v_current, v_longest, p_study_date,
    v_freeze, v_saved_freeze_month, now()
  )
  on conflict (user_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    last_study_date = excluded.last_study_date,
    freeze_available = excluded.freeze_available,
    freeze_granted_month = excluded.freeze_granted_month,
    updated_at = excluded.updated_at;

  update public.curriculum_leaderboard_stats
  set streak = v_current, updated_at = now()
  where user_id = p_user_id and streak is distinct from v_current;

  update public.leaderboard_stats
  set streak = v_current, updated_at = now()
  where user_id = p_user_id and streak is distinct from v_current;
end;
$$;

revoke all on function public.refresh_streak_from_daily_goal(uuid, date) from public;
grant execute on function public.refresh_streak_from_daily_goal(uuid, date) to service_role;

create or replace function public.refresh_streak_from_daily_goal_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_streak_from_daily_goal(new.user_id, new.study_date);
  return new;
end;
$$;

drop trigger if exists refresh_streak_after_daily_minutes on public.daily_study_stats;
create trigger refresh_streak_after_daily_minutes
after insert or update of minutes on public.daily_study_stats
for each row execute function public.refresh_streak_from_daily_goal_trigger();

create or replace function public.expire_inactive_streaks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_ids uuid[];
  v_count integer := 0;
begin
  select array_agg(ss.user_id) into v_user_ids
  from public.streak_states ss
  where ss.current_streak > 0
    and ss.last_study_date is not null
    and current_date - ss.last_study_date >= 3;

  if coalesce(cardinality(v_user_ids), 0) = 0 then return 0; end if;

  update public.streak_states
  set current_streak = 0,
      freeze_available = true,
      freeze_granted_month = date_trunc('month', current_date)::date,
      updated_at = now()
  where user_id = any(v_user_ids);
  get diagnostics v_count = row_count;

  update public.curriculum_leaderboard_stats
  set streak = 0, updated_at = now()
  where user_id = any(v_user_ids) and streak <> 0;

  update public.leaderboard_stats
  set streak = 0, updated_at = now()
  where user_id = any(v_user_ids) and streak <> 0;

  return v_count;
end;
$$;

revoke all on function public.expire_inactive_streaks() from public;
grant execute on function public.expire_inactive_streaks() to service_role;

-- ---------------------------------------------------------------------------
-- Close client-side score/reward write paths.
-- ---------------------------------------------------------------------------

drop policy if exists "users create own curriculum leaderboard stats" on public.curriculum_leaderboard_stats;
drop policy if exists "users update own curriculum leaderboard stats" on public.curriculum_leaderboard_stats;
drop policy if exists "users create own leaderboard stats" on public.leaderboard_stats;
drop policy if exists "users update own leaderboard stats" on public.leaderboard_stats;

revoke insert, update, delete on table public.curriculum_leaderboard_stats from anon, authenticated;
revoke insert, update, delete on table public.leaderboard_stats from anon, authenticated;
grant select on table public.curriculum_leaderboard_stats to authenticated;
grant select on table public.leaderboard_stats to authenticated;

create or replace function public.award_lesson_gems(p_textbook_id text, p_lesson_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_textbook uuid;
  v_lesson uuid;
  v_inserted integer := 0;
  v_balance integer := 0;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  begin
    v_textbook := p_textbook_id::uuid;
    v_lesson := p_lesson_id::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid lesson identifier' using errcode = '22023';
  end;

  if not exists (
    select 1
    from public.lessons l
    join public.lesson_progress lp
      on lp.lesson_id = l.id
     and lp.user_id = v_user
     and lp.progress_percent >= 100
    where l.id = v_lesson and l.textbook_id = v_textbook
  ) then
    raise exception 'Lesson is not completed' using errcode = '42501';
  end if;

  insert into public.user_wallets (user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  insert into public.gem_events (user_id, event_key, amount, event_type, metadata)
  values (
    v_user,
    'lesson:' || v_textbook::text || ':' || v_lesson::text,
    25,
    'lesson_complete',
    jsonb_build_object('textbook_id', v_textbook, 'lesson_id', v_lesson)
  )
  on conflict (user_id, event_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.user_wallets
    set gem_balance = gem_balance + 25, updated_at = now()
    where user_id = v_user;
  end if;

  select uw.gem_balance into v_balance
  from public.user_wallets uw
  where uw.user_id = v_user;

  return jsonb_build_object(
    'awarded', v_inserted = 1,
    'amount', case when v_inserted = 1 then 25 else 0 end,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.award_lesson_gems(text, text) from public;
grant execute on function public.award_lesson_gems(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Constraints, indexes, cache invalidation, and Realtime.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.activity_progress'::regclass
      and conname = 'activity_progress_activity_type_check'
      and not convalidated
  ) then
    alter table public.activity_progress
      validate constraint activity_progress_activity_type_check;
  end if;
end $$;

drop index if exists public.activity_progress_user_lesson_type_uidx;
drop index if exists public.lesson_progress_user_lesson_uidx;
drop index if exists public.lessons_textbook_idx;
drop index if exists public.daily_study_stats_user_date_idx;

create index if not exists lesson_progress_user_updated_idx
  on public.lesson_progress (user_id, updated_at desc);

drop trigger if exists invalidate_admin_dashboard_cache_after_change on public.content_reports;
create trigger invalidate_admin_dashboard_cache_after_change
after insert or update or delete or truncate on public.content_reports
for each statement execute function public.invalidate_admin_dashboard_cache();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';

