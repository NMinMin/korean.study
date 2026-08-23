-- Save one user's activity progress atomically without issuing a PostgREST
-- PATCH. Some installations enable a database request guard that rejects
-- PATCH requests even when PostgREST has supplied filters.

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

  insert into public.activity_progress (
    user_id, textbook_id, lesson_id, activity_type, progress_percent,
    completed_items, completed_at, updated_at
  ) values (
    auth.uid(), p_textbook_id, p_lesson_id, p_activity_type,
    greatest(0, least(100, p_progress_percent)),
    coalesce(p_completed_items, '{}'::jsonb), p_completed_at, now()
  )
  on conflict (user_id, lesson_id, activity_type)
  do update set
    textbook_id = excluded.textbook_id,
    progress_percent = excluded.progress_percent,
    completed_items = excluded.completed_items,
    completed_at = excluded.completed_at,
    updated_at = now()
  where public.activity_progress.user_id = auth.uid()
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.save_activity_progress(uuid, uuid, text, numeric, jsonb, timestamptz) from public;
grant execute on function public.save_activity_progress(uuid, uuid, text, numeric, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
