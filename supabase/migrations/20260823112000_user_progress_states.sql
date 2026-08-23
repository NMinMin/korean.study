create table if not exists public.user_progress_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  state_key text not null,
  state_value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key),
  check (state_key like 'progress:%')
);

alter table public.user_progress_states enable row level security;
drop policy if exists "users manage own progress states" on public.user_progress_states;
create policy "users manage own progress states"
on public.user_progress_states for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists user_progress_states_updated_idx
on public.user_progress_states (user_id, updated_at desc);
