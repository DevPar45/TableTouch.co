-- Group many table-order rounds under one named guest dining session.
alter table public.restaurants
  add column service_charge_rate numeric(5,2) not null default 0 check (service_charge_rate between 0 and 30),
  add column service_charge_label text not null default 'Service charge';

create table public.dining_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  branch_id uuid not null,
  table_id uuid not null,
  public_token uuid not null unique,
  guest_name text not null check (length(trim(guest_name)) between 2 and 80),
  status text not null default 'open' check (status in ('open','bill_requested','closed')),
  started_at timestamptz not null default now(),
  bill_requested_at timestamptz,
  closed_at timestamptz,
  tax_rate_snapshot numeric(5,2),
  service_charge_rate_snapshot numeric(5,2),
  service_charge_label_snapshot text,
  bill_subtotal numeric(10,2),
  service_charge_amount numeric(10,2),
  tax_amount numeric(10,2),
  bill_total numeric(10,2),
  foreign key (restaurant_id,branch_id) references public.branches(restaurant_id,id),
  foreign key (restaurant_id,table_id) references public.restaurant_tables(restaurant_id,id),
  unique (restaurant_id,id)
);
create index dining_sessions_restaurant_open on public.dining_sessions(restaurant_id,status,started_at desc);

alter table public.orders add column dining_session_id uuid, add column guest_name text not null default '';
alter table public.orders add constraint orders_session_same_tenant_fk
  foreign key (restaurant_id,dining_session_id) references public.dining_sessions(restaurant_id,id);
create index orders_dining_session_created on public.orders(dining_session_id,created_at);

create table public.dining_session_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  dining_session_id uuid not null,
  source_order_id uuid,
  source_order_item_id uuid,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_kind text not null default 'item' check (line_kind in ('item','additional')),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id,dining_session_id) references public.dining_sessions(restaurant_id,id) on delete cascade,
  foreign key (restaurant_id,source_order_id) references public.orders(restaurant_id,id) on delete set null (source_order_id),
  foreign key (source_order_item_id) references public.order_items(id) on delete set null
);
create index dining_session_items_session on public.dining_session_items(dining_session_id,created_at);

alter table public.dining_sessions enable row level security;
alter table public.dining_session_items enable row level security;
create policy "restaurant members read dining sessions" on public.dining_sessions for select using (public.is_restaurant_member(restaurant_id));
create policy "restaurant members update dining sessions" on public.dining_sessions for update using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));
create policy "platform admins read dining sessions" on public.dining_sessions for select using (public.is_platform_admin());
create policy "members read session bill items" on public.dining_session_items for select using (public.is_restaurant_member(restaurant_id));
create policy "members manage session bill items" on public.dining_session_items for all using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));
grant select,update on public.dining_sessions to authenticated;
grant select,insert,update,delete on public.dining_session_items to authenticated;

create or replace function public.start_dining_session(
  p_restaurant_slug text,p_table_number text,p_session_token uuid,p_guest_name text
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_restaurant public.restaurants%rowtype; v_table public.restaurant_tables%rowtype; v_session_id uuid;
begin
  if length(trim(p_guest_name)) not between 2 and 80 then raise exception 'Enter a name between 2 and 80 characters'; end if;
  select * into v_restaurant from public.restaurants r where r.slug=p_restaurant_slug and r.approval_status='approved' and r.service_status='online';
  if not found then raise exception 'Restaurant is not accepting orders'; end if;
  select * into v_table from public.restaurant_tables t where t.restaurant_id=v_restaurant.id and t.table_number=lpad(p_table_number,2,'0') and t.is_active order by t.created_at,t.id limit 1;
  if not found then raise exception 'Table is not active'; end if;
  select id into v_session_id from public.dining_sessions where public_token=p_session_token and status<>'closed';
  if v_session_id is not null then
    if not exists(select 1 from public.dining_sessions where id=v_session_id and restaurant_id=v_restaurant.id and table_id=v_table.id) then raise exception 'Session token belongs to another table'; end if;
    return v_session_id;
  end if;
  insert into public.dining_sessions(restaurant_id,branch_id,table_id,public_token,guest_name)
  values(v_restaurant.id,v_table.branch_id,v_table.id,p_session_token,trim(p_guest_name))
  returning id into v_session_id;
  return v_session_id;
end $$;

-- This separate function keeps all customer authority tied to the random session token.
create or replace function public.place_dining_session_order(
  p_session_id uuid,p_session_token uuid,p_items jsonb,p_idempotency_key uuid,p_guest_note text default ''
) returns table(order_id uuid,tracking_token uuid,order_total numeric)
language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_restaurant public.restaurants%rowtype; v_table public.restaurant_tables%rowtype; v_created record;
begin
  select * into v_session from public.dining_sessions s where s.id=p_session_id and s.public_token=p_session_token and s.status='open';
  if not found then raise exception 'Dining session is closed or invalid'; end if;
  select * into v_restaurant from public.restaurants r where r.id=v_session.restaurant_id;
  select * into v_table from public.restaurant_tables t where t.id=v_session.table_id;
  select * into v_created from public.place_table_order(v_restaurant.slug,v_table.table_number,p_items,p_idempotency_key,p_guest_note);
  update public.orders set dining_session_id=v_session.id,guest_name=v_session.guest_name
    where id=v_created.order_id and restaurant_id=v_session.restaurant_id;
  return query select v_created.order_id,v_created.tracking_token,v_created.order_total;
end $$;

create or replace function public.request_dining_bill(p_session_id uuid,p_session_token uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_restaurant public.restaurants%rowtype;
begin
  select * into v_session from public.dining_sessions s where s.id=p_session_id and s.public_token=p_session_token and s.status='open' for update;
  if not found then raise exception 'Dining session is not open'; end if;
  select * into v_restaurant from public.restaurants r where r.id=v_session.restaurant_id;
  update public.dining_sessions set status='bill_requested',bill_requested_at=now(),tax_rate_snapshot=v_restaurant.tax_rate,
    service_charge_rate_snapshot=v_restaurant.service_charge_rate,service_charge_label_snapshot=v_restaurant.service_charge_label
    where id=v_session.id;
  insert into public.dining_session_items(restaurant_id,dining_session_id,source_order_id,source_order_item_id,item_name,unit_price,quantity,line_kind)
  select oi.restaurant_id,v_session.id,oi.order_id,oi.id,oi.item_name,oi.unit_price,oi.quantity,'item'
  from public.order_items oi join public.orders o on o.id=oi.order_id
  where o.dining_session_id=v_session.id and o.status<>'cancelled';
end $$;

create or replace function public.finalize_dining_bill(p_session_id uuid)
returns table(bill_subtotal numeric,service_charge numeric,tax_amount numeric,bill_total numeric)
language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_subtotal numeric(10,2); v_service numeric(10,2); v_tax numeric(10,2); v_total numeric(10,2);
begin
  select * into v_session from public.dining_sessions s where s.id=p_session_id and s.status='bill_requested' for update;
  if not found or not public.is_restaurant_member(v_session.restaurant_id) then raise exception 'Bill is unavailable'; end if;
  select coalesce(sum(unit_price*quantity),0)::numeric(10,2) into v_subtotal from public.dining_session_items where dining_session_id=v_session.id and restaurant_id=v_session.restaurant_id;
  v_service:=round(v_subtotal*coalesce(v_session.service_charge_rate_snapshot,0)/100,2);
  v_tax:=round((v_subtotal+v_service)*coalesce(v_session.tax_rate_snapshot,0)/100,2);
  v_total:=v_subtotal+v_service+v_tax;
  update public.dining_sessions set status='closed',closed_at=now(),bill_subtotal=v_subtotal,service_charge_amount=v_service,tax_amount=v_tax,bill_total=v_total where id=v_session.id;
  return query select v_subtotal,v_service,v_tax,v_total;
end $$;

revoke all on function public.start_dining_session(text,text,uuid,text) from public;
revoke all on function public.place_dining_session_order(uuid,uuid,jsonb,uuid,text) from public;
revoke all on function public.request_dining_bill(uuid,uuid) from public;
revoke all on function public.finalize_dining_bill(uuid) from public;
grant execute on function public.start_dining_session(text,text,uuid,text) to anon,authenticated;
grant execute on function public.place_dining_session_order(uuid,uuid,jsonb,uuid,text) to anon,authenticated;
grant execute on function public.request_dining_bill(uuid,uuid) to anon,authenticated;
grant execute on function public.finalize_dining_bill(uuid) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dining_sessions') then
    alter publication supabase_realtime add table public.dining_sessions;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dining_session_items') then
    alter publication supabase_realtime add table public.dining_session_items;
  end if;
end $$;
