-- Progress can be saved before a learner has a streak_states row. A scalar
-- SELECT INTO with no matching row assigns NULL, so downstream leaderboard
-- inserts must also be protected at the table boundary.

update public.curriculum_leaderboard_stats
set streak = 0
where streak is null;

alter table public.curriculum_leaderboard_stats
  alter column streak set default 0;

create or replace function public.normalize_curriculum_leaderboard_streak()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.streak := coalesce(new.streak, 0);
  return new;
end;
$$;

drop trigger if exists normalize_curriculum_leaderboard_streak_before_write
  on public.curriculum_leaderboard_stats;
create trigger normalize_curriculum_leaderboard_streak_before_write
before insert or update of streak on public.curriculum_leaderboard_stats
for each row execute function public.normalize_curriculum_leaderboard_streak();

-- Refresh the shortcut rows after repairing the source ledger.
do $$
declare learner record;
begin
  for learner in select id from public.profiles loop
    perform public.refresh_user_dashboard_snapshot(learner.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
