-- `safeupdate` rejects both unqualified UPDATE statements and the implicit
-- UPDATE branch of INSERT .. ON CONFLICT. Keep every mutation explicitly
-- scoped so activity progress can also invalidate the admin shortcut safely.

create or replace function public.invalidate_admin_dashboard_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_dashboard_cache
  set refreshed_at = '1970-01-01 00:00:00+00'::timestamptz
  where range_days in (7, 30);
  return null;
end;
$$;

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
security invoker
set search_path = public
as $$
declare
  saved public.activity_progress;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_activity_type not in ('tuvung', 'nghechep', 'shadowing', 'ontap') then
    raise exception 'Unsupported activity type' using errcode = '22023';
  end if;

  update public.activity_progress
  set textbook_id = p_textbook_id,
      progress_percent = greatest(0, least(100, p_progress_percent)),
      completed_items = coalesce(p_completed_items, '{}'::jsonb),
      completed_at = p_completed_at,
      updated_at = now()
  where user_id = auth.uid()
    and lesson_id = p_lesson_id
    and activity_type = p_activity_type
  returning * into saved;

  if saved.user_id is null then
    begin
      insert into public.activity_progress (
        user_id, textbook_id, lesson_id, activity_type, progress_percent,
        completed_items, completed_at, updated_at
      ) values (
        auth.uid(), p_textbook_id, p_lesson_id, p_activity_type,
        greatest(0, least(100, p_progress_percent)),
        coalesce(p_completed_items, '{}'::jsonb), p_completed_at, now()
      )
      returning * into saved;
    exception when unique_violation then
      -- A concurrent request inserted the same activity between UPDATE and
      -- INSERT. Retry with the same fully-qualified key.
      update public.activity_progress
      set textbook_id = p_textbook_id,
          progress_percent = greatest(0, least(100, p_progress_percent)),
          completed_items = coalesce(p_completed_items, '{}'::jsonb),
          completed_at = p_completed_at,
          updated_at = now()
      where user_id = auth.uid()
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

notify pgrst, 'reload schema';
