-- Only service-role backend operations may change account lock metadata.
-- The existing own-profile UPDATE policy otherwise includes these columns.
create or replace function public.protect_account_lock_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated' and (
    new.is_locked is distinct from old.is_locked
    or new.locked_at is distinct from old.locked_at
    or new.locked_by is distinct from old.locked_by
  ) then
    raise exception 'Account lock fields may only be updated by the administration backend'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_account_lock_fields_before_update on public.profiles;
create trigger protect_account_lock_fields_before_update
before update on public.profiles for each row
execute function public.protect_account_lock_fields();
