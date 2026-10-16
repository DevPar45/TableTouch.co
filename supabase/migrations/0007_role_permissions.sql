-- Enforce the existing owner/manager/staff membership roles for operational data.
-- This is forward-only and preserves current owner access created by registration.

create or replace function public.has_restaurant_role(
  target_restaurant uuid,
  allowed_roles public.restaurant_role[]
) returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.restaurant_members member
    where member.restaurant_id=target_restaurant
      and member.user_id=auth.uid()
      and member.role=any(allowed_roles)
  )
$$;

revoke all on function public.has_restaurant_role(uuid,public.restaurant_role[]) from public;
grant execute on function public.has_restaurant_role(uuid,public.restaurant_role[]) to authenticated;

-- A printed QR code or NFC tag keeps its restaurant/table route permanently.
-- Its high-entropy capability can only change through this explicit operation,
-- which invalidates the prior physical tag if it was lost or copied.
create or replace function public.rotate_table_public_token(p_restaurant_id uuid,p_table_number text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_token uuid;
begin
  if not public.has_restaurant_role(p_restaurant_id,array['owner','manager']::public.restaurant_role[]) then raise exception 'Restaurant manager access required'; end if;
  update public.restaurant_tables
    set public_token=gen_random_uuid()
    where restaurant_id=p_restaurant_id and table_number=lpad(trim(p_table_number),2,'0')
    returning public_token into v_token;
  if v_token is null then raise exception 'Table not found'; end if;
  return v_token;
end $$;
revoke all on function public.rotate_table_public_token(uuid,text) from public;
grant execute on function public.rotate_table_public_token(uuid,text) to authenticated;

-- Pausing a table stops new QR/NFC sessions. Re-enabling keeps its capability
-- stable, so restaurants do not need to replace physical tags unnecessarily.
create or replace function public.set_restaurant_table_active(p_restaurant_id uuid,p_table_number text,p_is_active boolean)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.has_restaurant_role(p_restaurant_id,array['owner','manager']::public.restaurant_role[]) then raise exception 'Restaurant manager access required'; end if;
  update public.restaurant_tables
    set is_active=p_is_active
    where restaurant_id=p_restaurant_id and table_number=lpad(trim(p_table_number),2,'0');
  if not found then raise exception 'Table not found'; end if;
end $$;
revoke all on function public.set_restaurant_table_active(uuid,text,boolean) from public;
grant execute on function public.set_restaurant_table_active(uuid,text,boolean) to authenticated;

-- Restaurant profile and service settings are an owner responsibility.
drop policy if exists "members update own restaurant" on public.restaurants;
create policy "owners update own restaurant" on public.restaurants
  for update to authenticated
  using (public.has_restaurant_role(id,array['owner']::public.restaurant_role[]))
  with check (public.has_restaurant_role(id,array['owner']::public.restaurant_role[]));

-- Managers can run menus and tables, but staff cannot change the restaurant's
-- public configuration or QR inventory.
drop policy if exists "restaurant records manageable by member" on public.branches;
create policy "owners and managers manage branches" on public.branches
  for all to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));

drop policy if exists "restaurant tables manageable by member" on public.restaurant_tables;
create policy "owners and managers manage tables" on public.restaurant_tables
  for all to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));

drop policy if exists "categories manageable by member" on public.menu_categories;
create policy "owners and managers manage categories" on public.menu_categories
  for all to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));

drop policy if exists "items manageable by member" on public.menu_items;
create policy "owners and managers manage menu items" on public.menu_items
  for all to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));

drop policy if exists "members upload restaurant images" on storage.objects;
create policy "owners and managers upload restaurant images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id='restaurant-assets'
    and public.has_restaurant_role(((storage.foldername(name))[1])::uuid,array['owner','manager']::public.restaurant_role[])
  );

drop policy if exists "members update restaurant images" on storage.objects;
create policy "owners and managers update restaurant images" on storage.objects
  for update to authenticated
  using (
    bucket_id='restaurant-assets'
    and public.has_restaurant_role(((storage.foldername(name))[1])::uuid,array['owner','manager']::public.restaurant_role[])
  )
  with check (
    bucket_id='restaurant-assets'
    and public.has_restaurant_role(((storage.foldername(name))[1])::uuid,array['owner','manager']::public.restaurant_role[])
  );

drop policy if exists "members delete restaurant images" on storage.objects;
create policy "owners and managers delete restaurant images" on storage.objects
  for delete to authenticated
  using (
    bucket_id='restaurant-assets'
    and public.has_restaurant_role(((storage.foldername(name))[1])::uuid,array['owner','manager']::public.restaurant_role[])
  );

-- Staff may run the live order queue, but menu and table configuration stays
-- with owners and managers.
drop policy if exists "members update restaurant orders" on public.orders;
create policy "restaurant team update order status" on public.orders
  for update to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager','staff']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager','staff']::public.restaurant_role[]));

drop policy if exists "restaurant members update dining sessions" on public.dining_sessions;
create policy "owners and managers update dining sessions" on public.dining_sessions
  for update to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));

drop policy if exists "members manage session bill items" on public.dining_session_items;
create policy "owners and managers manage session bill items" on public.dining_session_items
  for all to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));

-- Business documents contain legal information and remain visible to the
-- applying owner and platform administrators only.
drop policy if exists "documents private to restaurant members" on public.business_documents;
create policy "owners read restaurant documents" on public.business_documents
  for select to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner']::public.restaurant_role[]));

-- Mirror role checks inside security-definer operational procedures. RLS is
-- bypassed within these procedures, so their own authorization checks matter.
create or replace function public.place_staff_order(
  p_restaurant_id uuid,p_table_number text,p_guest_name text,p_items jsonb,p_idempotency_key uuid,
  p_source text,p_session_id uuid default null,p_guest_note text default ''
) returns table(order_id uuid,tracking_token uuid,order_total numeric,dining_session_id uuid)
language plpgsql security definer set search_path=public
as $$
declare v_restaurant public.restaurants%rowtype; v_table public.restaurant_tables%rowtype;
  v_session public.dining_sessions%rowtype; v_order public.orders%rowtype;
  v_subtotal numeric(10,2); v_tax numeric(10,2); v_lines jsonb; v_session_id uuid; v_guest_name text;
begin
  if not public.has_restaurant_role(p_restaurant_id,array['owner','manager','staff']::public.restaurant_role[]) then raise exception 'Restaurant team access required'; end if;
  if p_source not in ('POS','Waiter','Counter') then raise exception 'Invalid order source'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then raise exception 'Invalid order items'; end if;
  select * into v_restaurant from public.restaurants where id=p_restaurant_id;
  select * into v_table from public.restaurant_tables where restaurant_id=p_restaurant_id and table_number=lpad(coalesce(p_table_number,'1'),2,'0') and is_active order by created_at,id limit 1;
  if not found then raise exception 'Choose an active table'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text||p_idempotency_key::text,0));
  select * into v_order from public.orders where restaurant_id=p_restaurant_id and idempotency_key=p_idempotency_key;
  if found then return query select v_order.id,v_order.tracking_token,v_order.total,v_order.dining_session_id; return; end if;
  if p_source<>'Counter' then
    if p_session_id is not null then
      select * into v_session from public.dining_sessions where id=p_session_id and restaurant_id=p_restaurant_id and table_id=v_table.id and status='open';
      if not found then raise exception 'Dining session is closed or belongs to another table'; end if;
      v_session_id:=v_session.id;
      v_guest_name:=v_session.guest_name;
    else
      if length(trim(coalesce(p_guest_name,''))) not between 2 and 80 then raise exception 'Enter a guest name'; end if;
      insert into public.dining_sessions(restaurant_id,branch_id,table_id,public_token,guest_name)
        values(p_restaurant_id,v_table.branch_id,v_table.id,gen_random_uuid(),trim(p_guest_name)) returning id into v_session_id;
      v_guest_name:=trim(p_guest_name);
    end if;
  else
    v_guest_name:=trim(coalesce(p_guest_name,'Counter sale'));
  end if;
  with requested as (
    select (x->>'item_id')::uuid item_id,sum((x->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(p_items) x group by (x->>'item_id')::uuid
  ), priced as (
    select i.id,i.name,i.price::numeric(10,2) price,requested.quantity
    from requested join public.menu_items i on i.id=requested.item_id and i.restaurant_id=p_restaurant_id
    where i.is_available and requested.quantity between 1 and 50
  )
  select coalesce(sum(price*quantity),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'quantity',quantity)),'[]'::jsonb)
    into v_subtotal,v_lines from priced;
  if v_subtotal<=0 or jsonb_array_length(v_lines)<>(select count(distinct (x->>'item_id')::uuid) from jsonb_array_elements(p_items) x) then raise exception 'One or more menu items are unavailable'; end if;
  v_tax:=round(v_subtotal*v_restaurant.tax_rate/100,2);
  insert into public.orders(restaurant_id,branch_id,table_id,dining_session_id,guest_name,order_source,status,subtotal,tax,total,guest_note,idempotency_key)
    values(p_restaurant_id,v_table.branch_id,v_table.id,v_session_id,coalesce(v_guest_name,''),p_source,'new',v_subtotal,v_tax,v_subtotal+v_tax,left(coalesce(p_guest_note,''),500),p_idempotency_key)
    returning * into v_order;
  insert into public.order_items(restaurant_id,order_id,menu_item_id,item_name,unit_price,quantity,line_total)
    select p_restaurant_id,v_order.id,(x->>'id')::uuid,x->>'name',(x->>'price')::numeric,(x->>'quantity')::integer,(x->>'price')::numeric*(x->>'quantity')::integer from jsonb_array_elements(v_lines) x;
  return query select v_order.id,v_order.tracking_token,v_order.total,v_session_id;
end $$;

create or replace function public.prepare_dining_bill(p_session_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_restaurant public.restaurants%rowtype;
begin
  select * into v_session from public.dining_sessions where id=p_session_id for update;
  if not found or not public.has_restaurant_role(v_session.restaurant_id,array['owner','manager']::public.restaurant_role[]) then raise exception 'Bill is unavailable'; end if;
  if v_session.status='bill_requested' then return; end if;
  if v_session.status<>'open' then raise exception 'Dining session is closed'; end if;
  select * into v_restaurant from public.restaurants where id=v_session.restaurant_id;
  update public.dining_sessions set status='bill_requested',bill_requested_at=now(),tax_rate_snapshot=v_restaurant.tax_rate,
    service_charge_rate_snapshot=v_restaurant.service_charge_rate,service_charge_label_snapshot=v_restaurant.service_charge_label where id=v_session.id;
  delete from public.dining_session_items where dining_session_id=v_session.id and restaurant_id=v_session.restaurant_id;
  insert into public.dining_session_items(restaurant_id,dining_session_id,source_order_id,source_order_item_id,item_name,unit_price,quantity,line_kind)
  select oi.restaurant_id,v_session.id,oi.order_id,oi.id,oi.item_name,oi.unit_price,oi.quantity,'item'
  from public.order_items oi join public.orders o on o.id=oi.order_id
  where o.dining_session_id=v_session.id and o.status<>'cancelled';
end $$;

create or replace function public.replace_dining_bill_items(p_session_id uuid,p_lines jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.dining_sessions where id=p_session_id and status='bill_requested' for update;
  if v_restaurant is null or not public.has_restaurant_role(v_restaurant,array['owner','manager']::public.restaurant_role[]) then raise exception 'Bill is unavailable'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>100 then raise exception 'Invalid bill lines'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x where length(trim(coalesce(x->>'name','')))<1 or length(x->>'name')>160 or coalesce((x->>'price')::numeric,-1)<0 or coalesce((x->>'quantity')::integer,0) not between 1 and 99 or coalesce(x->>'kind','item') not in ('item','additional')) then raise exception 'Invalid bill line'; end if;
  delete from public.dining_session_items where dining_session_id=p_session_id and restaurant_id=v_restaurant;
  insert into public.dining_session_items(restaurant_id,dining_session_id,item_name,unit_price,quantity,line_kind)
    select v_restaurant,p_session_id,trim(x->>'name'),(x->>'price')::numeric,(x->>'quantity')::integer,coalesce(x->>'kind','item') from jsonb_array_elements(p_lines) x;
end $$;

create or replace function public.finalize_dining_bill(p_session_id uuid)
returns table(bill_subtotal numeric,service_charge numeric,tax_amount numeric,bill_total numeric)
language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_subtotal numeric(10,2); v_service numeric(10,2); v_tax numeric(10,2); v_total numeric(10,2);
begin
  select * into v_session from public.dining_sessions s where s.id=p_session_id and s.status='bill_requested' for update;
  if not found or not public.has_restaurant_role(v_session.restaurant_id,array['owner','manager']::public.restaurant_role[]) then raise exception 'Bill is unavailable'; end if;
  select coalesce(sum(unit_price*quantity),0)::numeric(10,2) into v_subtotal from public.dining_session_items where dining_session_id=v_session.id and restaurant_id=v_session.restaurant_id;
  v_service:=round(v_subtotal*coalesce(v_session.service_charge_rate_snapshot,0)/100,2);
  v_tax:=round((v_subtotal+v_service)*coalesce(v_session.tax_rate_snapshot,0)/100,2);
  v_total:=v_subtotal+v_service+v_tax;
  update public.dining_sessions set status='closed',closed_at=now(),bill_subtotal=v_subtotal,service_charge_amount=v_service,tax_amount=v_tax,bill_total=v_total where id=v_session.id;
  return query select v_subtotal,v_service,v_tax,v_total;
end $$;

create or replace function public.reopen_dining_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.dining_sessions where id=p_session_id and status='bill_requested' for update;
  if v_restaurant is null or not public.has_restaurant_role(v_restaurant,array['owner','manager']::public.restaurant_role[]) then raise exception 'Dining session is unavailable'; end if;
  update public.dining_sessions set status='open',bill_requested_at=null where id=p_session_id;
end $$;
