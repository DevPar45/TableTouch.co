-- Connect the production screens to tenant-scoped data and authenticated workflows.
-- Apply after migrations 0001 through 0005 in Supabase.

-- Restaurant users need to read their own parent record; public users only use the
-- deliberately limited public_restaurant_profiles view.
create policy "members read own restaurant" on public.restaurants
  for select using (public.is_restaurant_member(id));
alter table public.restaurants add column if not exists hours text not null default '';
alter table public.restaurants add column if not exists instagram text not null default '';
create or replace view public.public_restaurant_profiles with (security_invoker=false) as
select id,slug,name,description,logo_url,cover_url,primary_color,accent_color,phone,address,tax_rate,hours,instagram
from public.restaurants where approval_status='approved' and service_status='online';
grant select on public.public_restaurant_profiles to anon,authenticated;

alter table public.business_documents add column if not exists reviewed_at timestamptz;
create table public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.platform_audit_events enable row level security;
create policy "platform admins read audit events" on public.platform_audit_events for select to authenticated using (public.is_platform_admin());
grant select on public.platform_audit_events to authenticated;

create or replace function public.audit_restaurant_workflow()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if old.approval_status is distinct from new.approval_status then
    insert into public.platform_audit_events(actor_id,restaurant_id,action,details)
      values(auth.uid(),new.id,'application_'||new.approval_status,jsonb_build_object('previous',old.approval_status,'current',new.approval_status));
  end if;
  if old.service_status is distinct from new.service_status then
    insert into public.platform_audit_events(actor_id,restaurant_id,action,details)
      values(auth.uid(),new.id,'service_status_changed',jsonb_build_object('previous',old.service_status,'current',new.service_status));
  end if;
  return new;
end $$;
create trigger restaurants_audit_workflow after update on public.restaurants
for each row execute function public.audit_restaurant_workflow();

create or replace function public.review_restaurant_application(p_restaurant_id uuid,p_decision text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform administrator access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid application decision'; end if;
  update public.restaurants set approval_status=p_decision,service_status='offline' where id=p_restaurant_id;
  if not found then raise exception 'Restaurant application not found'; end if;
  update public.business_documents set review_status=p_decision,reviewer_id=auth.uid(),reviewed_at=now() where restaurant_id=p_restaurant_id;
end $$;
revoke all on function public.review_restaurant_application(uuid,text) from public;
grant execute on function public.review_restaurant_application(uuid,text) to authenticated;

create or replace function public.set_restaurant_service_status(p_restaurant_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform administrator access required'; end if;
  if p_status not in ('online','offline','paused') then raise exception 'Invalid service status'; end if;
  update public.restaurants set service_status=p_status where id=p_restaurant_id and approval_status='approved';
  if not found then raise exception 'Only an approved restaurant can change service status'; end if;
end $$;
revoke all on function public.set_restaurant_service_status(uuid,text) from public;
grant execute on function public.set_restaurant_service_status(uuid,text) to authenticated;

-- Keep proof documents private and put guest-facing food photography in a public
-- bucket. Public buckets expose files for viewing, but writes remain tenant-guarded.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-proofs','business-proofs',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=10485760,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restaurant-assets','restaurant-assets',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=8388608,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "members upload restaurant images" on storage.objects for insert to authenticated
  with check (bucket_id='restaurant-assets' and public.is_restaurant_member(((storage.foldername(name))[1])::uuid));
create policy "members update restaurant images" on storage.objects for update to authenticated
  using (bucket_id='restaurant-assets' and public.is_restaurant_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id='restaurant-assets' and public.is_restaurant_member(((storage.foldername(name))[1])::uuid));
create policy "members delete restaurant images" on storage.objects for delete to authenticated
  using (bucket_id='restaurant-assets' and public.is_restaurant_member(((storage.foldername(name))[1])::uuid));

-- The registration form creates initial table links together with the restaurant.
drop function public.register_restaurant(text,text,text,text,text,text,text,text[]);
create function public.register_restaurant(
  p_slug text, p_name text, p_owner_name text, p_phone text, p_address text,
  p_fssai_number text, p_gst_number text, p_document_paths text[] default '{}',
  p_table_count integer default 8
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_restaurant uuid; v_branch uuid; v_path text; v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if length(trim(p_name)) < 2 or length(trim(p_owner_name)) < 2 or length(trim(p_phone)) < 7 then
    raise exception 'Restaurant and owner contact details are required';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid restaurant URL'; end if;
  if p_table_count not between 1 and 100 then raise exception 'Choose between 1 and 100 tables'; end if;
  if p_document_paths is null or cardinality(p_document_paths)=0 then raise exception 'At least one business proof document is required'; end if;
  insert into public.restaurants(slug,name,owner_name,owner_email,phone,address,fssai_number,gst_number,approval_status,service_status)
  values(p_slug,trim(p_name),trim(p_owner_name),coalesce((select email from auth.users where id=auth.uid()),''),trim(p_phone),trim(p_address),coalesce(p_fssai_number,''),coalesce(p_gst_number,''),'pending','offline') returning id into v_restaurant;
  insert into public.restaurant_members(restaurant_id,user_id,role) values(v_restaurant,auth.uid(),'owner');
  insert into public.branches(restaurant_id,name,address) values(v_restaurant,'Main branch',trim(p_address)) returning id into v_branch;
  insert into public.menu_categories(restaurant_id,name,sort_order) values
    (v_restaurant,'Recommended',0),(v_restaurant,'Starters',1),(v_restaurant,'Main Course',2),(v_restaurant,'Drinks',3),(v_restaurant,'Desserts',4);
  insert into public.restaurant_tables(restaurant_id,branch_id,table_number)
    select v_restaurant,v_branch,lpad(n::text,2,'0') from generate_series(1,p_table_count) n;
  foreach v_path in array p_document_paths loop
    if v_path !~ ('^applications/' || auth.uid()::text || '/') then
      raise exception 'Business document path is outside this application';
    end if;
    insert into public.business_documents(restaurant_id,storage_path,document_type)
      values(v_restaurant,v_path,'business-proof');
  end loop;
  return v_restaurant;
end $$;
revoke all on function public.register_restaurant(text,text,text,text,text,text,text,text[],integer) from public;
grant execute on function public.register_restaurant(text,text,text,text,text,text,text,text[],integer) to authenticated;

-- Public QR capability endpoint: only the random per-session token can read this
-- session, and the response contains that session's own order rounds only.
create or replace function public.get_dining_session(p_session_id uuid,p_session_token uuid)
returns table(session_id uuid,guest_name text,status text,started_at timestamptz,bill_requested_at timestamptz,
  table_number text,order_count bigint,subtotal numeric,orders jsonb)
language sql stable security definer set search_path=public
as $$
  select s.id,s.guest_name,s.status,s.started_at,s.bill_requested_at,t.table_number,
    count(o.id)::bigint,coalesce(sum(o.subtotal) filter (where o.status<>'cancelled'),0)::numeric,
    coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'status',o.status,'created_at',o.created_at,'subtotal',o.subtotal,'total',o.total,
      'items',(select coalesce(jsonb_agg(jsonb_build_object('item_id',oi.menu_item_id,'name',oi.item_name,'price',oi.unit_price,'quantity',oi.quantity)), '[]'::jsonb)
        from public.order_items oi where oi.order_id=o.id)
    ) order by o.created_at) filter (where o.id is not null),'[]'::jsonb)
  from public.dining_sessions s join public.restaurant_tables t on t.id=s.table_id
  left join public.orders o on o.dining_session_id=s.id
  where s.id=p_session_id and s.public_token=p_session_token
  group by s.id,t.table_number
$$;
revoke all on function public.get_dining_session(uuid,uuid) from public;
grant execute on function public.get_dining_session(uuid,uuid) to anon,authenticated;

-- Public ordering can start only with the unguessable token encoded in the
-- restaurant's printed table QR/NFC link. Bare restaurant/table URLs stay read-only.
drop function public.start_dining_session(text,text,uuid,text);
create function public.start_dining_session(
  p_restaurant_slug text,p_table_number text,p_table_token uuid,p_session_token uuid,p_guest_name text
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_restaurant public.restaurants%rowtype; v_table public.restaurant_tables%rowtype; v_session_id uuid; v_active_count integer;
begin
  if length(trim(p_guest_name)) not between 2 and 80 then raise exception 'Enter a name between 2 and 80 characters'; end if;
  if p_table_token is null or p_session_token is null then raise exception 'Open the QR code placed at your table'; end if;
  select * into v_restaurant from public.restaurants r where r.slug=p_restaurant_slug and r.approval_status='approved' and r.service_status='online';
  if not found then raise exception 'Restaurant is not accepting orders'; end if;
  select * into v_table from public.restaurant_tables t where t.restaurant_id=v_restaurant.id and t.table_number=lpad(p_table_number,2,'0') and t.public_token=p_table_token and t.is_active order by t.created_at,t.id limit 1;
  if not found then raise exception 'This QR code is invalid or no longer active'; end if;
  perform pg_advisory_xact_lock(hashtextextended('table-session:'||p_session_token::text,0));
  select id into v_session_id from public.dining_sessions where public_token=p_session_token and status<>'closed';
  if v_session_id is not null then
    if not exists(select 1 from public.dining_sessions where id=v_session_id and restaurant_id=v_restaurant.id and table_id=v_table.id) then raise exception 'Session token belongs to another table'; end if;
    return v_session_id;
  end if;
  select count(*) into v_active_count from public.dining_sessions where table_id=v_table.id and status<>'closed';
  if v_active_count>=40 then raise exception 'Please ask the restaurant team to start a table session'; end if;
  insert into public.dining_sessions(restaurant_id,branch_id,table_id,public_token,guest_name)
  values(v_restaurant.id,v_table.branch_id,v_table.id,p_session_token,trim(p_guest_name)) returning id into v_session_id;
  return v_session_id;
end $$;
revoke all on function public.start_dining_session(text,text,uuid,uuid,text) from public;
grant execute on function public.start_dining_session(text,text,uuid,uuid,text) to anon,authenticated;

-- Do not expose the underlying table-number-only order procedure to guest clients.
revoke all on function public.place_table_order(text,text,jsonb,uuid,text) from public,anon,authenticated;

create or replace function public.place_dining_session_order(
  p_session_id uuid,p_session_token uuid,p_items jsonb,p_idempotency_key uuid,p_guest_note text default ''
) returns table(order_id uuid,tracking_token uuid,order_total numeric)
language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_restaurant public.restaurants%rowtype; v_table public.restaurant_tables%rowtype; v_created record; v_existing public.orders%rowtype;
begin
  select * into v_session from public.dining_sessions s where s.id=p_session_id and s.public_token=p_session_token and s.status='open';
  if not found then raise exception 'Dining session is closed or invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_session.restaurant_id::text||p_idempotency_key::text,0));
  select * into v_existing from public.orders where restaurant_id=v_session.restaurant_id and idempotency_key=p_idempotency_key;
  if found then return query select v_existing.id,v_existing.tracking_token,v_existing.total; return; end if;
  if (select count(*) from public.orders where dining_session_id=v_session.id and created_at>now()-interval '1 hour')>=30 then raise exception 'Please ask the restaurant team for help with this table'; end if;
  select * into v_restaurant from public.restaurants r where r.id=v_session.restaurant_id;
  select * into v_table from public.restaurant_tables t where t.id=v_session.table_id;
  select * into v_created from public.place_table_order(v_restaurant.slug,v_table.table_number,p_items,p_idempotency_key,p_guest_note);
  update public.orders set dining_session_id=v_session.id,guest_name=v_session.guest_name
    where id=v_created.order_id and restaurant_id=v_session.restaurant_id;
  return query select v_created.order_id,v_created.tracking_token,v_created.order_total;
end $$;
revoke all on function public.place_dining_session_order(uuid,uuid,jsonb,uuid,text) from public;
grant execute on function public.place_dining_session_order(uuid,uuid,jsonb,uuid,text) to anon,authenticated;

-- Staff orders are priced from the restaurant's database menu and require tenant
-- membership. QR guests continue to use the capability-token-based RPCs.
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
  if not public.is_restaurant_member(p_restaurant_id) then raise exception 'Restaurant membership required'; end if;
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
revoke all on function public.place_staff_order(uuid,text,text,jsonb,uuid,text,uuid,text) from public;
grant execute on function public.place_staff_order(uuid,text,text,jsonb,uuid,text,uuid,text) to authenticated;

create or replace function public.prepare_dining_bill(p_session_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_restaurant public.restaurants%rowtype;
begin
  select * into v_session from public.dining_sessions where id=p_session_id for update;
  if not found or not public.is_restaurant_member(v_session.restaurant_id) then raise exception 'Bill is unavailable'; end if;
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
revoke all on function public.prepare_dining_bill(uuid) from public;
grant execute on function public.prepare_dining_bill(uuid) to authenticated;

create or replace function public.request_dining_bill(p_session_id uuid,p_session_token uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_restaurant public.restaurants%rowtype;
begin
  select * into v_session from public.dining_sessions s where s.id=p_session_id and s.public_token=p_session_token and s.status='open' for update;
  if not found then raise exception 'Dining session is not open'; end if;
  select * into v_restaurant from public.restaurants r where r.id=v_session.restaurant_id;
  update public.dining_sessions set status='bill_requested',bill_requested_at=now(),tax_rate_snapshot=v_restaurant.tax_rate,
    service_charge_rate_snapshot=v_restaurant.service_charge_rate,service_charge_label_snapshot=v_restaurant.service_charge_label where id=v_session.id;
  delete from public.dining_session_items where dining_session_id=v_session.id and restaurant_id=v_session.restaurant_id;
  insert into public.dining_session_items(restaurant_id,dining_session_id,source_order_id,source_order_item_id,item_name,unit_price,quantity,line_kind)
  select oi.restaurant_id,v_session.id,oi.order_id,oi.id,oi.item_name,oi.unit_price,oi.quantity,'item'
  from public.order_items oi join public.orders o on o.id=oi.order_id
  where o.dining_session_id=v_session.id and o.status<>'cancelled';
end $$;
revoke all on function public.request_dining_bill(uuid,uuid) from public;
grant execute on function public.request_dining_bill(uuid,uuid) to anon,authenticated;

drop function public.get_order_tracking(uuid);
create function public.get_order_tracking(p_tracking_token uuid)
returns table(status public.order_status,table_number text,restaurant_name text,updated_at timestamptz,order_total numeric,items jsonb)
language sql stable security definer set search_path=public
as $$
  select o.status,t.table_number,r.name,o.updated_at,o.total,
    (select coalesce(jsonb_agg(jsonb_build_object('name',oi.item_name,'price',oi.unit_price,'quantity',oi.quantity)), '[]'::jsonb)
     from public.order_items oi where oi.order_id=o.id)
  from public.orders o join public.restaurant_tables t on t.id=o.table_id join public.restaurants r on r.id=o.restaurant_id
  where o.tracking_token=p_tracking_token
$$;
revoke all on function public.get_order_tracking(uuid) from public;
grant execute on function public.get_order_tracking(uuid) to anon,authenticated;

create or replace function public.replace_dining_bill_items(p_session_id uuid,p_lines jsonb)
returns void language plpgsql security definer set search_path=public
as $$
declare v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.dining_sessions where id=p_session_id and status='bill_requested' for update;
  if v_restaurant is null or not public.is_restaurant_member(v_restaurant) then raise exception 'Bill is unavailable'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>100 then raise exception 'Invalid bill lines'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x where length(trim(coalesce(x->>'name','')))<1 or length(x->>'name')>160 or coalesce((x->>'price')::numeric,-1)<0 or coalesce((x->>'quantity')::integer,0) not between 1 and 99 or coalesce(x->>'kind','item') not in ('item','additional')) then raise exception 'Invalid bill line'; end if;
  delete from public.dining_session_items where dining_session_id=p_session_id and restaurant_id=v_restaurant;
  insert into public.dining_session_items(restaurant_id,dining_session_id,item_name,unit_price,quantity,line_kind)
    select v_restaurant,p_session_id,trim(x->>'name'),(x->>'price')::numeric,(x->>'quantity')::integer,coalesce(x->>'kind','item') from jsonb_array_elements(p_lines) x;
end $$;
revoke all on function public.replace_dining_bill_items(uuid,jsonb) from public;
grant execute on function public.replace_dining_bill_items(uuid,jsonb) to authenticated;

create or replace function public.reopen_dining_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from public.dining_sessions where id=p_session_id and status='bill_requested' for update;
  if v_restaurant is null or not public.is_restaurant_member(v_restaurant) then raise exception 'Dining session is unavailable'; end if;
  update public.dining_sessions set status='open',bill_requested_at=null where id=p_session_id;
end $$;
revoke all on function public.reopen_dining_session(uuid) from public;
grant execute on function public.reopen_dining_session(uuid) to authenticated;

-- Orders are immutable to clients except for the guarded status field.
revoke update on public.orders from authenticated;
grant update(status) on public.orders to authenticated;
revoke update on public.dining_sessions from authenticated;
revoke insert,update,delete on public.dining_session_items from authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='restaurant_tables') then alter publication supabase_realtime add table public.restaurant_tables; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='platform_audit_events') then alter publication supabase_realtime add table public.platform_audit_events; end if;
end $$;
