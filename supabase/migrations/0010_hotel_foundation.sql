-- Add hotel tenants and distinct hotel-room resources without changing or
-- repurposing existing restaurant table, order, or guest-session records.
-- Apply after migrations 0001 through 0009.

alter table public.restaurants
  add column if not exists business_type text not null default 'restaurant'
    check (business_type in ('restaurant','hotel')),
  add column if not exists currency_code text not null default 'INR'
    check (currency_code ~ '^[A-Z]{3}$'),
  add column if not exists time_zone text not null default 'Asia/Kolkata',
  add column if not exists welcome_message text not null default ''
    check (length(welcome_message) <= 500),
  add column if not exists room_service_enabled boolean not null default false;

create table public.hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.restaurants(id) on delete cascade,
  room_number text not null check (length(trim(room_number)) between 1 and 32),
  room_type text not null default '' check (length(room_type) <= 80),
  floor_label text not null default '' check (length(floor_label) <= 40),
  capacity smallint check (capacity is null or capacity between 1 and 20),
  public_token uuid not null unique default gen_random_uuid(),
  room_service_enabled boolean not null default true,
  housekeeping_status text not null default 'clean'
    check (housekeeping_status in ('clean','needs_service','in_progress','inspected')),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id,room_number),
  unique (hotel_id,id)
);
create index hotel_rooms_hotel_active on public.hotel_rooms(hotel_id,is_active,room_number);

alter table public.hotel_rooms enable row level security;
create policy "hotel members read rooms" on public.hotel_rooms for select to authenticated
  using (public.is_restaurant_member(hotel_id));
create policy "hotel owners and managers manage rooms" on public.hotel_rooms for all to authenticated
  using (public.has_restaurant_role(hotel_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(hotel_id,array['owner','manager']::public.restaurant_role[]));
create policy "platform admins read hotel rooms" on public.hotel_rooms for select to authenticated
  using (public.is_platform_admin());

create or replace function public.hotel_rooms_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create trigger hotel_rooms_touch_updated_at before update on public.hotel_rooms
  for each row execute procedure public.hotel_rooms_touch_updated_at();

-- Keep the existing restaurant public view restaurant-only. Hotel public pages
-- use their own deliberately limited view, which never contains guest/stay data.
create or replace view public.public_restaurant_profiles with (security_invoker=false) as
select id,slug,name,description,logo_url,cover_url,primary_color,accent_color,phone,address,tax_rate,hours,instagram
from public.restaurants
where business_type='restaurant' and approval_status='approved' and service_status='online';

create or replace view public.public_hotel_profiles with (security_invoker=false) as
select id,slug,name,description,logo_url,cover_url,primary_color,accent_color,phone,address,tax_rate,
  hours,instagram,currency_code,time_zone,welcome_message,room_service_enabled
from public.restaurants
where business_type='hotel' and approval_status='approved' and service_status='online' and room_service_enabled;
grant select on public.public_hotel_profiles to anon,authenticated;

create or replace view public.active_public_hotel_rooms with (security_invoker=false) as
select h.slug,r.room_number,r.room_service_enabled
from public.hotel_rooms r join public.restaurants h on h.id=r.hotel_id
where h.business_type='hotel' and h.approval_status='approved' and h.service_status='online'
  and h.room_service_enabled and r.is_active and r.archived_at is null and r.room_service_enabled;
grant select on public.active_public_hotel_rooms to anon,authenticated;

-- These functions rotate or pause the capability encoded in a physical room
-- QR/NFC tag. They do not disclose guest occupancy or authorise room charges.
create or replace function public.rotate_hotel_room_public_token(p_hotel_id uuid,p_room_number text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_token uuid;
begin
  if not public.has_restaurant_role(p_hotel_id,array['owner','manager']::public.restaurant_role[]) then
    raise exception 'Hotel manager access required';
  end if;
  update public.hotel_rooms set public_token=gen_random_uuid()
    where hotel_id=p_hotel_id and room_number=trim(p_room_number) and archived_at is null
    returning public_token into v_token;
  if v_token is null then raise exception 'Room not found'; end if;
  return v_token;
end $$;
revoke all on function public.rotate_hotel_room_public_token(uuid,text) from public;
grant execute on function public.rotate_hotel_room_public_token(uuid,text) to authenticated;

create or replace function public.set_hotel_room_active(p_hotel_id uuid,p_room_number text,p_is_active boolean)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.has_restaurant_role(p_hotel_id,array['owner','manager']::public.restaurant_role[]) then
    raise exception 'Hotel manager access required';
  end if;
  update public.hotel_rooms set is_active=p_is_active
    where hotel_id=p_hotel_id and room_number=trim(p_room_number) and archived_at is null;
  if not found then raise exception 'Room not found'; end if;
end $$;
revoke all on function public.set_hotel_room_active(uuid,text,boolean) from public;
grant execute on function public.set_hotel_room_active(uuid,text,boolean) to authenticated;

-- New onboarding uses this general function. The existing restaurant function
-- remains untouched for backwards compatibility with deployed clients.
create or replace function public.register_hospitality_business(
  p_business_type text,p_slug text,p_name text,p_owner_name text,p_phone text,p_address text,
  p_fssai_number text default '',p_gst_number text default '',p_document_paths text[] default '{}',
  p_resource_count integer default 8
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_business uuid; v_branch uuid; v_path text; v_label text;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_business_type not in ('restaurant','hotel') then raise exception 'Choose a supported business type'; end if;
  if length(trim(p_name))<2 or length(trim(p_owner_name))<2 or length(trim(p_phone))<7 then
    raise exception 'Business and owner contact details are required';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid public URL'; end if;
  if p_resource_count not between 1 and case when p_business_type='hotel' then 1000 else 100 end then
    raise exception 'Choose a valid number of rooms or tables';
  end if;
  if p_document_paths is null or cardinality(p_document_paths)=0 then raise exception 'At least one business proof document is required'; end if;
  insert into public.restaurants(slug,name,owner_name,owner_email,phone,address,fssai_number,gst_number,business_type,room_service_enabled,approval_status,service_status)
    values(p_slug,trim(p_name),trim(p_owner_name),coalesce((select email from auth.users where id=auth.uid()),''),trim(p_phone),trim(p_address),coalesce(p_fssai_number,''),coalesce(p_gst_number,''),p_business_type,p_business_type='hotel','pending','offline')
    returning id into v_business;
  insert into public.restaurant_members(restaurant_id,user_id,role) values(v_business,auth.uid(),'owner');
  insert into public.branches(restaurant_id,name,address) values(v_business,case when p_business_type='hotel' then 'Property kitchen' else 'Main branch' end,trim(p_address)) returning id into v_branch;
  if p_business_type='hotel' then
    insert into public.menu_categories(restaurant_id,name,sort_order) values
      (v_business,'Breakfast',0),(v_business,'All-day dining',1),(v_business,'Beverages',2),(v_business,'Late-night menu',3);
    insert into public.hotel_rooms(hotel_id,room_number)
      select v_business,lpad(n::text,3,'0') from generate_series(1,p_resource_count) n;
  else
    insert into public.menu_categories(restaurant_id,name,sort_order) values
      (v_business,'Recommended',0),(v_business,'Starters',1),(v_business,'Main Course',2),(v_business,'Drinks',3),(v_business,'Desserts',4);
    insert into public.restaurant_tables(restaurant_id,branch_id,table_number)
      select v_business,v_branch,lpad(n::text,2,'0') from generate_series(1,p_resource_count) n;
  end if;
  foreach v_path in array p_document_paths loop
    if v_path !~ ('^applications/' || auth.uid()::text || '/') then raise exception 'Business document path is outside this application'; end if;
    insert into public.business_documents(restaurant_id,storage_path,document_type) values(v_business,v_path,'business-proof');
  end loop;
  return v_business;
end $$;
revoke all on function public.register_hospitality_business(text,text,text,text,text,text,text,text,text[],integer) from public;
grant execute on function public.register_hospitality_business(text,text,text,text,text,text,text,text,text[],integer) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hotel_rooms') then
    alter publication supabase_realtime add table public.hotel_rooms;
  end if;
end $$;
