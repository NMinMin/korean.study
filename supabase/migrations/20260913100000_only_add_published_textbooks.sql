-- Students may only add published textbooks to their personal catalog.
-- This restrictive policy complements the existing ownership policy.
drop policy if exists "users add only published textbooks" on public.user_textbooks;
create policy "users add only published textbooks"
on public.user_textbooks
as restrictive
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.textbooks textbook
    where textbook.id = textbook_id
      and textbook.status = 'published'
  )
);

drop policy if exists "users keep only published textbooks" on public.user_textbooks;
create policy "users keep only published textbooks"
on public.user_textbooks
as restrictive
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.textbooks textbook
    where textbook.id = textbook_id
      and textbook.status = 'published'
  )
);
