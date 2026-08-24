-- Public/private vocabulary sets, code imports and moderation support.

alter table public.custom_lessons
  add column if not exists visibility text not null default 'public';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.custom_lessons'::regclass
      and conname = 'custom_lessons_visibility_check'
  ) then
    alter table public.custom_lessons
      add constraint custom_lessons_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end $$;

create index if not exists custom_lessons_public_created_idx
  on public.custom_lessons(created_at desc)
  where status = 'visible' and visibility = 'public';

drop policy if exists "visible custom lessons are readable" on public.custom_lessons;
drop policy if exists "accessible custom lessons are readable" on public.custom_lessons;
create policy "accessible custom lessons are readable"
on public.custom_lessons for select to authenticated
using (
  creator_id = auth.uid()
  or public.is_admin()
  or (
    status = 'visible'
    and (
      visibility = 'public'
      or exists (
        select 1
        from public.custom_lesson_bookmarks bookmark
        where bookmark.lesson_id = custom_lessons.id
          and bookmark.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists "users update own visible custom lessons" on public.custom_lessons;
drop policy if exists "users update own custom lessons" on public.custom_lessons;
create policy "users update own custom lessons"
on public.custom_lessons for update to authenticated
using (creator_id = auth.uid() or public.is_admin())
with check (creator_id = auth.uid() or public.is_admin());

create or replace function public.import_custom_lesson_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select id into target_id
  from public.custom_lessons
  where code = upper(trim(p_code))
    and status = 'visible'
  limit 1;

  if target_id is null then
    return null;
  end if;

  insert into public.custom_lesson_bookmarks(user_id, lesson_id)
  values (auth.uid(), target_id)
  on conflict (user_id, lesson_id) do nothing;

  return target_id;
end;
$$;

revoke all on function public.import_custom_lesson_by_code(text) from public;
grant execute on function public.import_custom_lesson_by_code(text) to authenticated;

alter table public.content_reports
  add column if not exists custom_lesson_id uuid references public.custom_lessons(id) on delete cascade;

alter table public.content_reports drop constraint if exists content_reports_one_target;
alter table public.content_reports
  add constraint content_reports_one_target check (
    (post_id is not null)::int
    + (comment_id is not null)::int
    + (custom_lesson_id is not null)::int = 1
  );

create unique index if not exists content_reports_unique_pending_custom_lesson
  on public.content_reports(reporter_id, custom_lesson_id)
  where custom_lesson_id is not null and status = 'pending';
