create table if not exists public.tts_jobs (
  id uuid primary key,
  requested_by uuid not null references auth.users(id),
  exercise_id uuid references public.lesson_exercises(id) on delete set null,
  exercise_updated_at timestamptz,
  text_content text not null check (length(text_content) between 1 and 5000),
  voice text not null,
  speed numeric not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  audio_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lease_until timestamptz
);
create index if not exists tts_jobs_pending_idx on public.tts_jobs (created_at) where status = 'queued';
alter table public.tts_jobs enable row level security;
revoke all on public.tts_jobs from anon, authenticated;
grant select, insert, update on public.tts_jobs to service_role;

create or replace function public.claim_tts_job()
returns setof public.tts_jobs language plpgsql security definer set search_path = public as $$
declare job_id uuid;
begin
  perform pg_advisory_xact_lock(92834751);
  update public.tts_jobs set status = 'failed', error_message = 'Yêu cầu bị gián đoạn. Vui lòng thử lại.', updated_at = now()
    where status = 'processing' and lease_until < now();
  if exists (select 1 from public.tts_jobs where status = 'processing') then return; end if;
  if exists (select 1 from public.tts_jobs where status in ('completed', 'failed') and updated_at > now() - interval '2 seconds') then return; end if;
  select id into job_id from public.tts_jobs where status = 'queued' order by created_at, id limit 1 for update skip locked;
  if job_id is null then return; end if;
  return query update public.tts_jobs set status = 'processing', lease_until = now() + interval '8 minutes', updated_at = now()
    where id = job_id returning *;
end $$;
revoke all on function public.claim_tts_job() from public, anon, authenticated;
grant execute on function public.claim_tts_job() to service_role;
