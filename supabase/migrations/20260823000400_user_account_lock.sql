alter table public.profiles
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id) on delete set null;

create index if not exists profiles_is_locked_idx on public.profiles(is_locked) where is_locked = true;
