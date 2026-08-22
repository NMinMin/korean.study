create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  comments_locked boolean not null default false,
  moderation_reason text,
  moderated_by uuid references public.profiles(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint content_reports_one_target check ((post_id is not null)::int + (comment_id is not null)::int = 1)
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_status_idx on public.posts(status);
create index if not exists comments_post_id_idx on public.comments(post_id, created_at);
create index if not exists content_reports_status_idx on public.content_reports(status, created_at desc);
create unique index if not exists content_reports_unique_pending_post
  on public.content_reports(reporter_id, post_id) where post_id is not null and status = 'pending';

alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.content_reports enable row level security;

drop policy if exists "published posts are readable" on public.posts;
create policy "published posts are readable" on public.posts for select to authenticated
  using (status = 'visible' or user_id = auth.uid());
drop policy if exists "users create own posts" on public.posts;
create policy "users create own posts" on public.posts for insert to authenticated
  with check (user_id = auth.uid() and status = 'visible' and comments_locked = false);
drop policy if exists "users update own visible posts" on public.posts;
create policy "users update own visible posts" on public.posts for update to authenticated
  using (user_id = auth.uid() and status = 'visible')
  with check (user_id = auth.uid() and status = 'visible');
drop policy if exists "users delete own posts" on public.posts;
create policy "users delete own posts" on public.posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists "visible comments are readable" on public.comments;
create policy "visible comments are readable" on public.comments for select to authenticated using (status = 'visible' or user_id = auth.uid());
drop policy if exists "users create comments on unlocked posts" on public.comments;
create policy "users create comments on unlocked posts" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible' and not p.comments_locked));
drop policy if exists "users manage own comments" on public.comments;
create policy "users manage own comments" on public.comments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users create reports" on public.content_reports;
create policy "users create reports" on public.content_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'pending');
drop policy if exists "users read own reports" on public.content_reports;
create policy "users read own reports" on public.content_reports for select to authenticated using (reporter_id = auth.uid());

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.content_reports;
