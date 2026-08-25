-- Let authenticated administrators receive new community reports immediately.
drop policy if exists "admins read community reports realtime" on public.content_reports;
create policy "admins read community reports realtime"
  on public.content_reports for select to authenticated
  using (public.is_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'content_reports'
  ) then
    alter publication supabase_realtime add table public.content_reports;
  end if;
end
$$;
