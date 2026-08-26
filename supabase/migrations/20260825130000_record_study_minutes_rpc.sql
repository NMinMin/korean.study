-- Increment study time with one atomic request. This replaces the client-side
-- read-settings + read-stats + two-upsert polling loop.

create or replace function public.record_study_minutes(p_minutes numeric)
returns table (
  study_date date,
  today_minutes numeric,
  target_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date := current_date;
  v_minutes numeric := greatest(0, least(coalesce(p_minutes, 0), 10));
  v_total numeric := 0;
  v_target integer := 15;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_minutes <= 0 then
    raise exception 'Minutes must be greater than zero' using errcode = '22023';
  end if;

  update public.daily_study_stats ds
  set minutes = coalesce(ds.minutes, 0) + v_minutes,
      updated_at = now()
  where ds.user_id = v_user_id
    and ds.study_date = v_date
  returning ds.minutes into v_total;

  if not found then
    begin
      insert into public.daily_study_stats (user_id, study_date, minutes, updated_at)
      values (v_user_id, v_date, v_minutes, now())
      returning minutes into v_total;
    exception when unique_violation then
      update public.daily_study_stats ds
      set minutes = coalesce(ds.minutes, 0) + v_minutes,
          updated_at = now()
      where ds.user_id = v_user_id
        and ds.study_date = v_date
      returning ds.minutes into v_total;
    end;
  end if;

  select coalesce(us.daily_goal_minutes, 15)
  into v_target
  from public.user_settings us
  where us.user_id = v_user_id;
  v_target := coalesce(v_target, 15);

  return query select v_date, coalesce(v_total, v_minutes), v_target;
end;
$$;

revoke all on function public.record_study_minutes(numeric) from public;
grant execute on function public.record_study_minutes(numeric) to authenticated;

notify pgrst, 'reload schema';
