create table if not exists public.user_ai_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gemini_key_encrypted text not null,
  key_hint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ai_keys enable row level security;
revoke all on public.user_ai_keys from anon, authenticated;
grant select, insert, update, delete on public.user_ai_keys to service_role;
