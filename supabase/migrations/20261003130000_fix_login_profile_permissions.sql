-- Login reads only the public columns already permitted by the profile policy.
-- Account status is scoped to auth.uid(); no caller-supplied user id is accepted.
grant select (id, display_name, avatar_url) on public.profiles to authenticated;

create or replace function public.is_my_account_locked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_locked from public.profiles p where p.id = auth.uid()),
    true
  );
$$;

revoke all on function public.is_my_account_locked() from public, anon;
grant execute on function public.is_my_account_locked() to authenticated;
