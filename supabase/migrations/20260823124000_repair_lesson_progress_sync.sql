-- Repair legacy progress schemas and remove the second ON CONFLICT dependency
-- inside the activity_progress -> lesson_progress trigger.

-- Old projects may have an activity_type CHECK that predates `ontap`.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'activity_progress'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%activity_type%'
  loop
    execute format('alter table public.activity_progress drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.activity_progress
  add constraint activity_progress_activity_type_check
  check (activity_type in ('tuvung', 'nghechep', 'shadowing', 'ontap')) not valid;

-- Clean legacy duplicates before restoring the expected lesson key.
delete from public.lesson_progress older
using public.lesson_progress newer
where older.ctid < newer.ctid
  and older.user_id = newer.user_id
  and older.lesson_id = newer.lesson_id;

create unique index if not exists lesson_progress_user_lesson_uidx
  on public.lesson_progress (user_id, lesson_id);

create or replace function public.sync_lesson_progress_from_activities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  calculated_progress numeric(5,2);
  affected_rows integer;
begin
  select round(coalesce(sum(progress_percent), 0) / 4.0, 2)
  into calculated_progress
  from public.activity_progress
  where user_id = new.user_id
    and lesson_id = new.lesson_id;

  update public.lesson_progress
  set textbook_id = new.textbook_id,
      progress_percent = calculated_progress,
      last_activity = new.activity_type,
      last_position = coalesce(last_position, '{}'::jsonb)
        || jsonb_build_object('activity', new.activity_type, 'activityProgress', new.progress_percent),
      updated_at = now()
  where user_id = new.user_id
    and lesson_id = new.lesson_id;

  get diagnostics affected_rows = row_count;

  if affected_rows = 0 then
    insert into public.lesson_progress (
      user_id, textbook_id, lesson_id, progress_percent,
      last_activity, last_position, updated_at
    ) values (
      new.user_id, new.textbook_id, new.lesson_id, calculated_progress,
      new.activity_type,
      jsonb_build_object('activity', new.activity_type, 'activityProgress', new.progress_percent),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists activity_progress_sync_lesson on public.activity_progress;
create trigger activity_progress_sync_lesson
after insert or update of progress_percent on public.activity_progress
for each row execute function public.sync_lesson_progress_from_activities();

notify pgrst, 'reload schema';
