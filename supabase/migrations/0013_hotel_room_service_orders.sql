-- Room-service orders intentionally do not create room charges or payments. A
-- hotel employee must verify the stay and collect/record payment in its PMS or POS.

create table public.hotel_room_service_orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.restaurants(id) on delete cascade,
  room_id uuid not null,
  order_items jsonb not null check (jsonb_typeof(order_items)='array' and jsonb_array_length(order_items)>0),
  subtotal numeric(12,2) not null check (subtotal>=0),
  total numeric(12,2) not null check (total>=0),
  guest_note text not null default '' check (length(guest_note)<=500),
  status text not null default 'new' check (status in ('new','accepted','preparing','ready','delivered','cancelled')),
  idempotency_key uuid not null,
  tracking_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,room_id) references public.hotel_rooms(hotel_id,id) on delete cascade,
  unique (hotel_id,idempotency_key)
);
create index hotel_room_service_orders_queue on public.hotel_room_service_orders(hotel_id,status,created_at desc);
create index hotel_room_service_orders_room on public.hotel_room_service_orders(room_id,created_at desc);

alter table public.hotel_room_service_orders enable row level security;
create policy "hotel team read room service orders" on public.hotel_room_service_orders for select to authenticated using (public.is_restaurant_member(hotel_id));
create policy "platform admins read room service orders" on public.hotel_room_service_orders for select to authenticated using (public.is_platform_admin());

create or replace function public.hotel_room_service_orders_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create trigger hotel_room_service_orders_touch_updated_at before update on public.hotel_room_service_orders
  for each row execute procedure public.hotel_room_service_orders_touch_updated_at();

create or replace function public.place_hotel_room_service_order(
  p_hotel_slug text,p_room_number text,p_room_token uuid,p_items jsonb,p_idempotency_key uuid,p_guest_note text default ''
) returns table(order_id uuid,tracking_token uuid,order_total numeric,status text)
language plpgsql security definer set search_path=public
as $$
declare
  v_hotel public.restaurants%rowtype; v_room public.hotel_rooms%rowtype; v_existing public.hotel_room_service_orders%rowtype;
  v_line jsonb; v_item public.menu_items%rowtype; v_quantity integer; v_items jsonb:='[]'::jsonb; v_subtotal numeric(12,2):=0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then raise exception 'Choose between 1 and 30 menu items'; end if;
  if length(trim(coalesce(p_guest_note,''))) > 500 then raise exception 'Keep the note within 500 characters'; end if;
  select h.* into v_hotel from public.restaurants h where h.slug=p_hotel_slug and h.business_type='hotel' and h.approval_status='approved' and h.service_status='online' and h.room_service_enabled;
  if not found then raise exception 'Room service is unavailable'; end if;
  select * into v_room from public.hotel_rooms r where r.hotel_id=v_hotel.id and r.room_number=trim(p_room_number) and r.public_token=p_room_token and r.is_active and r.room_service_enabled and r.archived_at is null;
  if not found then raise exception 'Use the QR or NFC tag provided in this room'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_room.id::text||p_idempotency_key::text,0));
  select * into v_existing from public.hotel_room_service_orders where hotel_id=v_hotel.id and idempotency_key=p_idempotency_key;
  if found then return query select v_existing.id,v_existing.tracking_token,v_existing.total,v_existing.status; return; end if;
  for v_line in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_line) <> 'object' or coalesce(v_line->>'item_id','') !~ '^[0-9a-fA-F-]{36}$' or jsonb_typeof(v_line->'quantity') <> 'number' then raise exception 'Each order item must have a menu item and quantity'; end if;
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 20 then raise exception 'Choose a quantity between 1 and 20'; end if;
    select * into v_item from public.menu_items where id=(v_line->>'item_id')::uuid and restaurant_id=v_hotel.id and is_available;
    if not found then raise exception 'One or more selected menu items are unavailable'; end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object('menu_item_id',v_item.id,'item_name',v_item.name,'unit_price',v_item.price,'quantity',v_quantity));
    v_subtotal := v_subtotal + v_item.price*v_quantity;
  end loop;
  insert into public.hotel_room_service_orders(hotel_id,room_id,order_items,subtotal,total,guest_note,idempotency_key)
    values(v_hotel.id,v_room.id,v_items,v_subtotal,v_subtotal,trim(coalesce(p_guest_note,'')),p_idempotency_key) returning * into v_existing;
  return query select v_existing.id,v_existing.tracking_token,v_existing.total,v_existing.status;
end $$;
revoke all on function public.place_hotel_room_service_order(text,text,uuid,jsonb,uuid,text) from public;
grant execute on function public.place_hotel_room_service_order(text,text,uuid,jsonb,uuid,text) to anon,authenticated;

create or replace function public.update_hotel_room_service_order(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public
as $$
declare v_order public.hotel_room_service_orders%rowtype; v_role public.restaurant_role;
begin
  select * into v_order from public.hotel_room_service_orders where id=p_order_id for update;
  if not found then raise exception 'Room-service order not found'; end if;
  select role into v_role from public.restaurant_members where restaurant_id=v_order.hotel_id and user_id=auth.uid();
  if v_role is null then raise exception 'Hotel team access required'; end if;
  if p_status not in ('accepted','preparing','ready','delivered','cancelled') then raise exception 'Choose a valid room-service order status'; end if;
  if p_status='cancelled' and v_role='staff' then raise exception 'Only a manager can cancel room-service orders'; end if;
  if (v_order.status,p_status) not in (('new','accepted'),('new','cancelled'),('accepted','preparing'),('accepted','cancelled'),('preparing','ready'),('preparing','cancelled'),('ready','delivered'),('ready','cancelled')) then raise exception 'Invalid room-service order transition'; end if;
  update public.hotel_room_service_orders set status=p_status,accepted_at=case when p_status='accepted' then now() else accepted_at end,delivered_at=case when p_status='delivered' then now() else delivered_at end where id=v_order.id;
end $$;
revoke all on function public.update_hotel_room_service_order(uuid,text) from public;
grant execute on function public.update_hotel_room_service_order(uuid,text) to authenticated;

create or replace function public.get_hotel_room_service_order(p_tracking_token uuid)
returns table(status text,created_at timestamptz,updated_at timestamptz,order_total numeric,items jsonb)
language sql stable security definer set search_path=public
as $$ select status,created_at,updated_at,total,order_items from public.hotel_room_service_orders where tracking_token=p_tracking_token $$;
revoke all on function public.get_hotel_room_service_order(uuid) from public;
grant execute on function public.get_hotel_room_service_order(uuid) to anon,authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hotel_room_service_orders') then alter publication supabase_realtime add table public.hotel_room_service_orders; end if;
end $$;
