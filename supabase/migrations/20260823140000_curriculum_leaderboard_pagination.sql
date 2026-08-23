create or replace function public.get_curriculum_leaderboard(
  p_textbook_id uuid,
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
  with participants as (
    select ut.user_id
    from public.user_textbooks ut
    where ut.textbook_id = p_textbook_id
    union
    select cls.user_id
    from public.curriculum_leaderboard_stats cls
    where cls.textbook_id = p_textbook_id
  ), learners as (
    select p.id as user_id,
           p.display_name,
           coalesce(cls.xp, 0)::integer as xp,
           coalesce(cls.streak, 0)::integer as streak,
           coalesce(cls.updated_at, ut.started_at, p.updated_at) as updated_at
    from participants participant
    join public.profiles p on p.id = participant.user_id
    left join public.user_roles ur on ur.user_id = participant.user_id
    left join public.user_textbooks ut
      on ut.user_id = participant.user_id and ut.textbook_id = p_textbook_id
    left join public.curriculum_leaderboard_stats cls
      on cls.user_id = participant.user_id and cls.textbook_id = p_textbook_id
    where coalesce(ur.role, 'user'::public.app_role) = 'user'::public.app_role
      and coalesce(cls.xp, 0) > 0
  ), ranked as (
    select row_number() over (order by xp desc, streak desc, updated_at asc, user_id) as rank_position,
           learners.*
    from learners
  ), summary as (
    select count(*)::bigint as total_count,
           max(ranked.rank_position) filter (where ranked.user_id = auth.uid())::bigint as my_rank
    from ranked
  )
  select r.rank_position, r.user_id, r.display_name, r.xp, r.streak, r.updated_at,
         s.total_count, s.my_rank
  from ranked r
  cross join summary s
  order by r.rank_position
  limit greatest(1, least(coalesce(p_page_size, 10), 100))
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_page_size, 10), 100));
$$;

revoke all on function public.get_curriculum_leaderboard(uuid, integer, integer) from public;
grant execute on function public.get_curriculum_leaderboard(uuid, integer, integer) to authenticated;
