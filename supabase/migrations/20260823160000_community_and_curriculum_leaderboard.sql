-- Migration: Community comment likes and curriculum leaderboard pagination
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_comment_idx on public.comment_likes(comment_id);

alter table public.comment_likes enable row level security;

drop policy if exists "comment likes readable" on public.comment_likes;
create policy "comment likes readable" on public.comment_likes for select to authenticated using (true);

drop policy if exists "users create own comment likes" on public.comment_likes;
create policy "users create own comment likes" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "users delete own comment likes" on public.comment_likes;
create policy "users delete own comment likes" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

-- Function: get_curriculum_leaderboard supporting null textbook_id (all) or specific textbook
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
  with participants as (
    select ut.user_id, ut.textbook_id
    from public.user_textbooks ut
    where (p_textbook_id is null or ut.textbook_id = p_textbook_id)
    union
    select cls.user_id, cls.textbook_id
    from public.curriculum_leaderboard_stats cls
    where (p_textbook_id is null or cls.textbook_id = p_textbook_id)
    union
    select ls.user_id, null::uuid as textbook_id
    from public.leaderboard_stats ls
    where p_textbook_id is null
  ), learners as (
    select p.id as user_id,
           p.display_name,
           coalesce(case when p_textbook_id is null then ls.xp else cls.xp end, 0)::integer as xp,
           coalesce(case when p_textbook_id is null then ls.streak else cls.streak end, 0)::integer as streak,
           coalesce(case when p_textbook_id is null then ls.updated_at else cls.updated_at end, p.updated_at) as updated_at
    from (select distinct user_id from participants) participant
    join public.profiles p on p.id = participant.user_id
    left join public.user_roles ur on ur.user_id = participant.user_id
    left join public.leaderboard_stats ls on ls.user_id = participant.user_id and p_textbook_id is null
    left join public.curriculum_leaderboard_stats cls on cls.user_id = participant.user_id and cls.textbook_id = p_textbook_id
    where coalesce(ur.role, 'user'::public.app_role) = 'user'::public.app_role
      and coalesce(case when p_textbook_id is null then ls.xp else cls.xp end, 0) > 0
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
         coalesce(s.total_count, 0)::bigint, s.my_rank
  from ranked r
  cross join summary s
  order by r.rank_position
  limit greatest(1, least(coalesce(p_page_size, 10), 100))
  offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_page_size, 10), 100));
$$;

revoke all on function public.get_curriculum_leaderboard(uuid, integer, integer) from public;
grant execute on function public.get_curriculum_leaderboard(uuid, integer, integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.comment_likes;
exception
  when duplicate_object then null;
end $$;
