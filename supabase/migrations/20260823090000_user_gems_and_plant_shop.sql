create table if not exists public.plant_catalog (
  id text primary key,
  name text not null,
  description text not null default '',
  price integer not null check (price >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gem_balance integer not null default 0 check (gem_balance >= 0),
  selected_plant_id text not null default 'mugunghwa' references public.plant_catalog(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_plant_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id text not null references public.plant_catalog(id),
  purchased_at timestamptz not null default now(),
  primary key (user_id, plant_id)
);

create table if not exists public.gem_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  amount integer not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

insert into public.plant_catalog (id, name, description, price, sort_order) values
  ('mugunghwa', 'Mugunghwa', 'Quốc hoa Hàn Quốc, nở rộ khi giáo trình đạt 100%.', 0, 1),
  ('cherry', 'Anh đào', 'Tán hoa anh đào hồng dịu dàng.', 100, 2),
  ('sunflower', 'Hướng dương', 'Rực rỡ và luôn hướng về phía trước.', 150, 3),
  ('lavender', 'Oải hương', 'Sắc tím nhẹ nhàng cho góc học tập.', 200, 4),
  ('bonsai', 'Bonsai', 'Một cây nhỏ thanh lịch và bền bỉ.', 250, 5)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  sort_order = excluded.sort_order;

alter table public.plant_catalog enable row level security;
alter table public.user_wallets enable row level security;
alter table public.user_plant_inventory enable row level security;
alter table public.gem_events enable row level security;

drop policy if exists "plant catalog readable" on public.plant_catalog;
create policy "plant catalog readable" on public.plant_catalog for select to authenticated using (is_active);
drop policy if exists "own wallet readable" on public.user_wallets;
create policy "own wallet readable" on public.user_wallets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own plants readable" on public.user_plant_inventory;
create policy "own plants readable" on public.user_plant_inventory for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own gem events readable" on public.gem_events;
create policy "own gem events readable" on public.gem_events for select to authenticated using (auth.uid() = user_id);

create or replace function public.ensure_my_wallet()
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into user_wallets (user_id) values (v_user) on conflict do nothing;
  insert into user_plant_inventory (user_id, plant_id) values (v_user, 'mugunghwa') on conflict do nothing;
end $$;

create or replace function public.get_my_plant_shop()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  perform ensure_my_wallet();
  select jsonb_build_object(
    'balance', w.gem_balance,
    'selected_plant', w.selected_plant_id,
    'plants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'description', p.description, 'price', p.price,
      'sort_order', p.sort_order, 'owned', i.plant_id is not null,
      'selected', w.selected_plant_id = p.id
    ) order by p.sort_order) from plant_catalog p left join user_plant_inventory i on i.user_id = v_user and i.plant_id = p.id where p.is_active), '[]'::jsonb)
  ) into v_result from user_wallets w where w.user_id = v_user;
  return v_result;
end $$;

create or replace function public.award_lesson_gems(p_textbook_id text, p_lesson_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_inserted integer; v_balance integer;
begin
  perform ensure_my_wallet();
  insert into gem_events (user_id, event_key, amount, event_type, metadata)
  values (v_user, 'lesson:' || p_textbook_id || ':' || p_lesson_id, 25, 'lesson_complete', jsonb_build_object('textbook_id', p_textbook_id, 'lesson_id', p_lesson_id))
  on conflict (user_id, event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then update user_wallets set gem_balance = gem_balance + 25, updated_at = now() where user_id = v_user; end if;
  select gem_balance into v_balance from user_wallets where user_id = v_user;
  return jsonb_build_object('awarded', v_inserted = 1, 'amount', case when v_inserted = 1 then 25 else 0 end, 'balance', v_balance);
end $$;

create or replace function public.purchase_plant(p_plant_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_price integer; v_balance integer;
begin
  perform ensure_my_wallet();
  if exists(select 1 from user_plant_inventory where user_id = v_user and plant_id = p_plant_id) then
    select gem_balance into v_balance from user_wallets where user_id = v_user;
    return jsonb_build_object('purchased', false, 'balance', v_balance);
  end if;
  select price into v_price from plant_catalog where id = p_plant_id and is_active for update;
  if v_price is null then raise exception 'Plant not found'; end if;
  update user_wallets set gem_balance = gem_balance - v_price, updated_at = now()
  where user_id = v_user and gem_balance >= v_price returning gem_balance into v_balance;
  if not found then raise exception 'Not enough gems'; end if;
  insert into user_plant_inventory(user_id, plant_id) values(v_user, p_plant_id);
  insert into gem_events(user_id, event_key, amount, event_type, metadata)
  values(v_user, 'plant:' || p_plant_id, -v_price, 'plant_purchase', jsonb_build_object('plant_id', p_plant_id));
  return jsonb_build_object('purchased', true, 'balance', v_balance);
end $$;

create or replace function public.select_plant(p_plant_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  perform ensure_my_wallet();
  if not exists(select 1 from user_plant_inventory where user_id = v_user and plant_id = p_plant_id) then raise exception 'Plant is not owned'; end if;
  update user_wallets set selected_plant_id = p_plant_id, updated_at = now() where user_id = v_user;
  return jsonb_build_object('selected_plant', p_plant_id);
end $$;

revoke all on function public.ensure_my_wallet() from public;
revoke all on function public.get_my_plant_shop() from public;
revoke all on function public.award_lesson_gems(text, text) from public;
revoke all on function public.purchase_plant(text) from public;
revoke all on function public.select_plant(text) from public;
grant execute on function public.get_my_plant_shop() to authenticated;
grant execute on function public.award_lesson_gems(text, text) to authenticated;
grant execute on function public.purchase_plant(text) to authenticated;
grant execute on function public.select_plant(text) to authenticated;
