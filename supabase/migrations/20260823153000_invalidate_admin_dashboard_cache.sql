-- Keep the admin dashboard shortcut fresh without rescanning aggregate tables on
-- every read. Any source-table mutation marks both cached ranges as stale; an
-- open admin dashboard then refreshes immediately through Realtime.
create or replace function public.invalidate_admin_dashboard_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_dashboard_cache
  set refreshed_at = '1970-01-01 00:00:00+00'::timestamptz;
  return null;
end;
$$;

do $$
declare
  source_table text;
begin
  foreach source_table in array array[
    'daily_study_stats',
    'lesson_progress',
    'vocabulary_progress',
    'profiles',
    'textbooks',
    'lessons'
  ]
  loop
    if to_regclass(format('public.%I', source_table)) is not null then
      execute format('drop trigger if exists invalidate_admin_dashboard_cache_after_change on public.%I', source_table);
      execute format(
        'create trigger invalidate_admin_dashboard_cache_after_change after insert or update or delete or truncate on public.%I for each statement execute function public.invalidate_admin_dashboard_cache()',
        source_table
      );
    end if;
  end loop;
end;
$$;

comment on function public.invalidate_admin_dashboard_cache() is
  'Marks cached admin dashboard snapshots stale after source data changes.';
