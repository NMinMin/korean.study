-- Persistent social data: post likes, community-created lessons and leaderboard snapshots.

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.custom_lessons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  words jsonb not null default '[]'::jsonb check (jsonb_typeof(words) = 'array'),
  quiz_types text[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_lesson_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.custom_lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.leaderboard_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  streak integer not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists post_likes_post_idx on public.post_likes(post_id);
create index if not exists custom_lessons_created_idx on public.custom_lessons(created_at desc) where status = 'visible';
create index if not exists custom_lesson_bookmarks_user_idx on public.custom_lesson_bookmarks(user_id, created_at desc);
create index if not exists leaderboard_stats_rank_idx on public.leaderboard_stats(xp desc, streak desc, updated_at);

alter table public.post_likes enable row level security;
alter table public.custom_lessons enable row level security;
alter table public.custom_lesson_bookmarks enable row level security;
alter table public.leaderboard_stats enable row level security;

create policy "likes are readable" on public.post_likes for select to authenticated using (true);
create policy "users create own likes" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "users delete own likes" on public.post_likes for delete to authenticated using (user_id = auth.uid());

create policy "visible custom lessons are readable" on public.custom_lessons for select to authenticated
  using (status = 'visible' or creator_id = auth.uid() or public.is_admin());
create policy "users create own custom lessons" on public.custom_lessons for insert to authenticated
  with check (creator_id = auth.uid() and status = 'visible');
create policy "users update own visible custom lessons" on public.custom_lessons for update to authenticated
  using (creator_id = auth.uid() and status = 'visible')
  with check (creator_id = auth.uid() and status = 'visible');
create policy "users delete own custom lessons" on public.custom_lessons for delete to authenticated
  using (creator_id = auth.uid());

create policy "users read own custom lesson bookmarks" on public.custom_lesson_bookmarks for select to authenticated
  using (user_id = auth.uid());
create policy "users create own custom lesson bookmarks" on public.custom_lesson_bookmarks for insert to authenticated
  with check (user_id = auth.uid());
create policy "users delete own custom lesson bookmarks" on public.custom_lesson_bookmarks for delete to authenticated
  using (user_id = auth.uid());

create policy "leaderboard is readable" on public.leaderboard_stats for select to authenticated using (true);
create policy "users create own leaderboard stats" on public.leaderboard_stats for insert to authenticated
  with check (user_id = auth.uid());
create policy "users update own leaderboard stats" on public.leaderboard_stats for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
