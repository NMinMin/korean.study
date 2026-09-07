-- Derived statistics must only be written by their validated RPCs/triggers.
-- Earlier migrations left a permissive table policy in place and the latest
-- streak migration accidentally exposed an arbitrary-user SECURITY DEFINER
-- function to authenticated clients.

drop policy if exists "users manage own daily study stats"
  on public.daily_study_stats;
drop policy if exists "users read own daily study stats"
  on public.daily_study_stats;
create policy "users read own daily study stats"
  on public.daily_study_stats for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on table public.daily_study_stats
  from anon, authenticated;
grant select on table public.daily_study_stats to authenticated;

revoke all on function public.record_study_minutes(numeric) from public;
grant execute on function public.record_study_minutes(numeric) to authenticated;

revoke all on function public.refresh_streak_from_daily_goal(uuid, date) from public;
revoke execute on function public.refresh_streak_from_daily_goal(uuid, date) from authenticated;
grant execute on function public.refresh_streak_from_daily_goal(uuid, date) to service_role;

revoke all on function public.refresh_user_dashboard_snapshot(uuid) from public;
grant execute on function public.refresh_user_dashboard_snapshot(uuid) to service_role;

revoke all on function public.invalidate_admin_dashboard_cache() from public;
grant execute on function public.invalidate_admin_dashboard_cache() to service_role;

notify pgrst, 'reload schema';
