-- Finalize curriculum ranking and streak behavior for the checked learning flows.

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

  -- Lesson progress is the shared source for both migrated accounts and new
  -- activity rows. One completed lesson contributes 100 curriculum XP.
  select coalesce(round(sum(progress_percent)), 0)::integer
    into v_curriculum_xp
  from public.lesson_progress
  where user_id = p_user_id and textbook_id = v_textbook_id;

  select coalesce(current_streak, 0) into v_streak
  from public.streak_states where user_id = p_user_id;

  insert into public.curriculum_leaderboard_stats (user_id, textbook_id, xp, streak, updated_at)
  values (p_user_id, v_textbook_id, v_curriculum_xp, v_streak, now())
  on conflict (user_id, textbook_id) do update set
    xp = excluded.xp, streak = excluded.streak, updated_at = excluded.updated_at;
end;
$$;

-- Backfill legacy lesson_progress rows so existing learners are assigned to
-- the actual curricula they studied, even if activity_progress was introduced later.
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

create or replace function public.get_curriculum_leaderboard(
  p_textbook_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 10
)
returns table (
  rank_position bigint,
  user_id uuid,
  display_name text,
  xp integer,
  streak integer,
  updated_at timestamptz,
  total_count bigint,
  my_rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with curriculum_totals as (
    select cls.user_id,
           coalesce(sum(cls.xp), 0)::integer as xp,
           coalesce(max(cls.streak), 0)::integer as streak,
           max(cls.updated_at) as updated_at
    from public.curriculum_leaderboard_stats cls
    group by cls.user_id
  ), participants as (
    select ut.user_id from public.user_textbooks ut
    where p_textbook_id is null or ut.textbook_id = p_textbook_id
    union
    select cls.user_id from public.curriculum_leaderboard_stats cls
    where p_textbook_id is null or cls.textbook_id = p_textbook_id
    union
    select ls.user_id from public.leaderboard_stats ls
    where p_textbook_id is null
  ), learners as (
    select p.id as user_id,
           p.display_name,
           case when p_textbook_id is null
             then greatest(coalesce(ct.xp, 0), coalesce(ls.xp, 0))::integer
             else coalesce(cls.xp, 0)::integer
           end as xp,
           case when p_textbook_id is null
             then greatest(coalesce(ct.streak, 0), coalesce(ls.streak, 0))::integer
             else coalesce(cls.streak, 0)::integer
           end as streak,
           coalesce(
             case when p_textbook_id is null then ct.updated_at else cls.updated_at end,
             ls.updated_at,
             p.updated_at
           ) as updated_at
    from (select distinct user_id from participants) participant
    join public.profiles p on p.id = participant.user_id
    left join public.user_roles ur on ur.user_id = participant.user_id
    left join public.leaderboard_stats ls on ls.user_id = participant.user_id
    left join curriculum_totals ct on ct.user_id = participant.user_id
    left join public.curriculum_leaderboard_stats cls
      on cls.user_id = participant.user_id and cls.textbook_id = p_textbook_id
    where coalesce(ur.role, 'user'::public.app_role) = 'user'::public.app_role
  ), ranked as (
    select row_number() over (order by xp desc, streak desc, updated_at asc, user_id) as rank_position,
           learners.*
    from learners
    where xp > 0
  ), summary as (
    select count(*)::bigint as total_count,
           max(ranked.rank_position) filter (where ranked.user_id = auth.uid())::bigint as my_rank
    from ranked
  )
  select r.rank_position, r.user_id, r.display_name, r.xp, r.streak, r.updated_at,
         coalesce(s.total_count, 0)::bigint, s.my_rank
  from ranked r
  cross join summary s
  order by r.rank_position
  limit greatest(1, least(coalesce(p_page_size, 10), 100))
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_page_size, 10), 100));
$$;

revoke all on function public.get_curriculum_leaderboard(uuid, integer, integer) from public;
grant execute on function public.get_curriculum_leaderboard(uuid, integer, integer) to authenticated;

-- A date gap of 2 means exactly one missed date, which is the frozen day.
-- Reset only at a gap of 3: two complete missed dates.
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
    and current_date - last_study_date >= 3;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_inactive_streaks() from public;
grant execute on function public.expire_inactive_streaks() to service_role;

notify pgrst, 'reload schema';
