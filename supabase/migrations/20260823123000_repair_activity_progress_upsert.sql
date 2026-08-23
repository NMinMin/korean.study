-- Repair installations where activity_progress existed before the current
-- migration. `create table if not exists` does not add missing constraints to
-- an older table, while PostgREST requires a real UNIQUE/PRIMARY constraint for
-- `on_conflict=user_id,lesson_id,activity_type`.

alter table public.activity_progress
  add column if not exists textbook_id uuid references public.textbooks(id) on delete cascade,
  add column if not exists lesson_id uuid references public.lessons(id) on delete cascade,
  add column if not exists activity_type text,
  add column if not exists progress_percent numeric(5,2) not null default 0,
  add column if not exists completed_items jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Keep the newest row if an old schema allowed duplicates.
delete from public.activity_progress older
using public.activity_progress newer
where older.ctid < newer.ctid
  and older.user_id = newer.user_id
  and older.lesson_id = newer.lesson_id
  and older.activity_type = newer.activity_type;

create unique index if not exists activity_progress_user_lesson_type_uidx
  on public.activity_progress (user_id, lesson_id, activity_type);

alter table public.activity_progress enable row level security;
drop policy if exists "users manage own activity progress" on public.activity_progress;
create policy "users manage own activity progress"
on public.activity_progress for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

notify pgrst, 'reload schema';
