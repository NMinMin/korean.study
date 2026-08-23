-- Profiles are visible to signed-in users for community attribution, but only
-- public columns may be selected and only user-editable columns may be changed.
-- Server-managed fields (xp, level and account-lock metadata) stay behind the
-- service-role backend.
revoke all privileges on table public.profiles from anon;
revoke select, insert, update, delete on table public.profiles from authenticated;

grant select (id, display_name, avatar_url) on table public.profiles to authenticated;
grant update (display_name, avatar_url, timezone) on table public.profiles to authenticated;

drop policy if exists "profiles readable by authenticated users" on public.profiles;
create policy "authenticated users read public profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- The previous FOR ALL policy on comments supplied a second permissive INSERT
-- check. PostgreSQL ORs permissive policies, so it allowed an owner to bypass
-- the locked/hidden-post check. Keep one policy per operation instead.
revoke all privileges on table public.comments from anon;
revoke insert, update, delete on table public.comments from authenticated;

grant select on table public.comments to authenticated;
grant insert (post_id, user_id, parent_id, content) on table public.comments to authenticated;
grant update (content) on table public.comments to authenticated;
grant delete on table public.comments to authenticated;

create or replace function public.is_valid_comment_parent(
  target_parent_id uuid,
  target_post_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_parent_id is null or exists (
    select 1
    from public.comments parent
    where parent.id = target_parent_id
      and parent.post_id = target_post_id
      and parent.status = 'visible'
  );
$$;

revoke all on function public.is_valid_comment_parent(uuid, uuid) from public;
grant execute on function public.is_valid_comment_parent(uuid, uuid) to authenticated;

drop policy if exists "visible comments are readable" on public.comments;
create policy "visible comments are readable"
  on public.comments
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      status = 'visible'
      and exists (
        select 1
        from public.posts p
        where p.id = post_id
          and p.status = 'visible'
      )
    )
  );

drop policy if exists "users create comments on unlocked posts" on public.comments;
create policy "users create comments on unlocked posts"
  on public.comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'visible'
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.status = 'visible'
        and not p.comments_locked
    )
    and public.is_valid_comment_parent(parent_id, post_id)
  );

drop policy if exists "users manage own comments" on public.comments;
drop policy if exists "users update own visible comments" on public.comments;
create policy "users update own visible comments"
  on public.comments
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'visible')
  with check (
    user_id = auth.uid()
    and status = 'visible'
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.status = 'visible'
        and not p.comments_locked
    )
  );

drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments"
  on public.comments
  for delete
  to authenticated
  using (user_id = auth.uid());
