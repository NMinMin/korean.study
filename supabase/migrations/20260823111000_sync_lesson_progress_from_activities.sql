create or replace function public.sync_lesson_progress_from_activities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  calculated_progress numeric(5,2);
begin
  select round(coalesce(sum(progress_percent), 0) / 4.0, 2)
  into calculated_progress
  from public.activity_progress
  where user_id = new.user_id and lesson_id = new.lesson_id;

  insert into public.lesson_progress (
    user_id, textbook_id, lesson_id, progress_percent,
    last_activity, last_position, updated_at
  ) values (
    new.user_id, new.textbook_id, new.lesson_id, calculated_progress,
    new.activity_type,
    jsonb_build_object('activity', new.activity_type, 'activityProgress', new.progress_percent),
    now()
  )
  on conflict (user_id, lesson_id) do update set
    textbook_id = excluded.textbook_id,
    progress_percent = excluded.progress_percent,
    last_activity = excluded.last_activity,
    last_position = coalesce(public.lesson_progress.last_position, '{}'::jsonb) || excluded.last_position,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists activity_progress_sync_lesson on public.activity_progress;
create trigger activity_progress_sync_lesson
after insert or update of progress_percent on public.activity_progress
for each row execute function public.sync_lesson_progress_from_activities();

-- Đồng bộ lại dữ liệu hoạt động đã có trước khi trigger được tạo.
insert into public.lesson_progress (user_id, textbook_id, lesson_id, progress_percent, last_activity, last_position, updated_at)
select
  user_id,
  max(textbook_id::text)::uuid,
  lesson_id,
  round(coalesce(sum(progress_percent), 0) / 4.0, 2),
  'progress-sync',
  '{}'::jsonb,
  now()
from public.activity_progress
group by user_id, lesson_id
on conflict (user_id, lesson_id) do update set
  textbook_id = excluded.textbook_id,
  progress_percent = excluded.progress_percent,
  last_activity = excluded.last_activity,
  updated_at = now();
