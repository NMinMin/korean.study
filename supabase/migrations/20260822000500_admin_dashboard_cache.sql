-- Cached admin dashboard snapshots. The API refreshes a row only when it is stale,
-- so opening the dashboard repeatedly does not rescan progress tables.
create table if not exists public.admin_dashboard_cache (
  range_days smallint primary key check (range_days in (7, 30)),
  payload jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now()
);

alter table public.admin_dashboard_cache enable row level security;

drop policy if exists "admins read dashboard cache" on public.admin_dashboard_cache;
create policy "admins read dashboard cache"
  on public.admin_dashboard_cache for select to authenticated
  using (public.is_admin());

comment on table public.admin_dashboard_cache is
  'Short-lived precomputed snapshots for the admin dashboard; refreshed server-side.';
