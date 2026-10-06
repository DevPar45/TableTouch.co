-- Tabletouch multi-tenant core. Run this migration in a new Supabase project.
create extension if not exists pgcrypto;

create type public.restaurant_role as enum ('owner','manager','staff');
create type public.order_status as enum ('new','accepted','preparing','ready','served','completed','cancelled');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  owner_name text not null default '',
  owner_email text not null default '',
  fssai_number text not null default '',
  gst_number text not null default '',
  description text not null default '',
  logo_url text,
  cover_url text,
  primary_color text not null default '#4b111b',
  accent_color text not null default '#bc9b62',
  phone text not null default '',
  address text not null default '',
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  service_status text not null default 'offline' check (service_status in ('online','offline','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.restaurant_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (restaurant_id,user_id)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  address text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id,id)
);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null,
  table_number text not null,
  public_token uuid not null unique default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id,branch_id) references public.branches(restaurant_id,id) on delete cascade,
  unique (restaurant_id,branch_id,table_number), unique (restaurant_id,id)
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (restaurant_id,id)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  is_vegetarian boolean not null default false,
  is_available boolean not null default true,
  is_bestseller boolean not null default false,
  tags text[] not null default '{}',
  prep_minutes integer check (prep_minutes is null or prep_minutes between 0 and 1440),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id,category_id) references public.menu_categories(restaurant_id,id) on delete set null (category_id),
  unique (restaurant_id,id)
);

create table public.business_documents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  storage_path text not null,
  document_type text not null,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewer_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  branch_id uuid not null,
  table_id uuid not null,
  status public.order_status not null default 'new',
  subtotal numeric(10,2) not null check (subtotal >= 0),
  tax numeric(10,2) not null check (tax >= 0),
  total numeric(10,2) not null check (total >= 0),
  guest_note text not null default '',
  tracking_token uuid not null unique default gen_random_uuid(),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id,branch_id) references public.branches(restaurant_id,id),
  foreign key (restaurant_id,table_id) references public.restaurant_tables(restaurant_id,id),
  unique (restaurant_id,idempotency_key), unique (restaurant_id,id)
);
create index orders_restaurant_status_created on public.orders(restaurant_id,status,created_at desc);
create index orders_table_created on public.orders(table_id,created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  menu_item_id uuid,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total numeric(10,2) not null check (line_total >= 0),
  foreign key (restaurant_id,order_id) references public.orders(restaurant_id,id) on delete cascade,
  foreign key (restaurant_id,menu_item_id) references public.menu_items(restaurant_id,id) on delete set null (menu_item_id)
);

create or replace function public.is_restaurant_member(target_restaurant uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.restaurant_members m where m.restaurant_id = target_restaurant and m.user_id = auth.uid()) $$;

alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.branches enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.business_documents enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "owners create applications" on public.restaurants for insert with check (auth.uid() is not null and approval_status='pending' and service_status='offline');
create policy "members update own restaurant" on public.restaurants for update using (public.is_restaurant_member(id)) with check (public.is_restaurant_member(id));
create policy "members read their memberships" on public.restaurant_members for select using (user_id=auth.uid() or public.is_restaurant_member(restaurant_id));
create policy "restaurant records visible to member" on public.branches for select using (public.is_restaurant_member(restaurant_id));
create policy "restaurant records manageable by member" on public.branches for all using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));
create policy "tables are private to restaurant members" on public.restaurant_tables for select using (public.is_restaurant_member(restaurant_id));
create policy "restaurant tables manageable by member" on public.restaurant_tables for all using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));
create policy "published categories are public" on public.menu_categories for select using (is_active and exists(select 1 from public.restaurants r where r.id=restaurant_id and r.approval_status='approved' and r.service_status='online') or public.is_restaurant_member(restaurant_id));
create policy "categories manageable by member" on public.menu_categories for all using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));
create policy "published items are public" on public.menu_items for select using ((is_available and exists(select 1 from public.restaurants r where r.id=restaurant_id and r.approval_status='approved' and r.service_status='online')) or public.is_restaurant_member(restaurant_id));
create policy "items manageable by member" on public.menu_items for all using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));
create policy "documents private to restaurant members" on public.business_documents for select using (public.is_restaurant_member(restaurant_id));
create policy "orders private to restaurant members" on public.orders for select using (public.is_restaurant_member(restaurant_id));
create policy "members update restaurant orders" on public.orders for update using (public.is_restaurant_member(restaurant_id)) with check (public.is_restaurant_member(restaurant_id));
create policy "order items private to restaurant members" on public.order_items for select using (public.is_restaurant_member(restaurant_id));

-- Guests submit only a table token + menu item IDs/quantities. The database owns prices/tax.
create or replace function public.place_table_order(
  p_restaurant_slug text,
  p_table_number text,
  p_items jsonb,
  p_idempotency_key uuid,
  p_guest_note text default ''
) returns table(order_id uuid, tracking_token uuid, order_total numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_order public.orders%rowtype;
  v_subtotal numeric(10,2) := 0;
  v_tax numeric(10,2) := 0;
  v_lines jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then
    raise exception 'Invalid order items';
  end if;
  select t.* into v_table from public.restaurant_tables t join public.restaurants r on r.id=t.restaurant_id
  where r.slug=p_restaurant_slug and t.table_number=p_table_number and t.is_active
  order by t.created_at,t.id limit 1;
  if not found then raise exception 'Table is not active'; end if;
  select * into v_restaurant from public.restaurants r where r.id=v_table.restaurant_id and r.approval_status='approved' and r.service_status='online';
  if not found then raise exception 'Restaurant is not accepting orders'; end if;
  select * into v_order from public.orders o where o.restaurant_id=v_table.restaurant_id and o.idempotency_key=p_idempotency_key;
  if found then return query select v_order.id,v_order.tracking_token,v_order.total; return; end if;

  with requested as (
    select (x->>'item_id')::uuid as item_id, sum((x->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) x group by (x->>'item_id')::uuid
  ), priced as (
    select i.id,i.name,i.price::numeric(10,2) price,requested.quantity
    from requested join public.menu_items i on i.id=requested.item_id and i.restaurant_id=v_table.restaurant_id
    where i.is_available and requested.quantity between 1 and 50
  )
  select coalesce(sum(price*quantity),0), coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price,'quantity',quantity)), '[]'::jsonb)
  into v_subtotal,v_lines from priced;
  if v_subtotal<=0 or jsonb_array_length(v_lines) <> (select count(distinct (x->>'item_id')::uuid) from jsonb_array_elements(p_items) x) then
    raise exception 'One or more menu items are unavailable';
  end if;
  v_tax := round(v_subtotal * v_restaurant.tax_rate / 100,2);
  insert into public.orders(restaurant_id,branch_id,table_id,subtotal,tax,total,guest_note,idempotency_key)
  values(v_table.restaurant_id,v_table.branch_id,v_table.id,v_subtotal,v_tax,v_subtotal+v_tax,left(coalesce(p_guest_note,''),500),p_idempotency_key)
  returning * into v_order;
  insert into public.order_items(restaurant_id,order_id,menu_item_id,item_name,unit_price,quantity,line_total)
  select v_table.restaurant_id,v_order.id,(x->>'id')::uuid,x->>'name',(x->>'price')::numeric,(x->>'quantity')::integer,(x->>'price')::numeric*(x->>'quantity')::integer
  from jsonb_array_elements(v_lines) x;
  return query select v_order.id,v_order.tracking_token,v_order.total;
end;
$$;
revoke all on function public.place_table_order(text,text,jsonb,uuid,text) from public;
grant execute on function public.place_table_order(text,text,jsonb,uuid,text) to anon, authenticated;

-- Anonymous tracking is restricted to a random high-entropy token and exposes no guest identity.
create or replace function public.get_order_tracking(p_tracking_token uuid)
returns table(status public.order_status, table_number text, restaurant_name text, updated_at timestamptz)
language sql stable security definer set search_path=public
as $$ select o.status,t.table_number,r.name,o.updated_at from public.orders o join public.restaurant_tables t on t.id=o.table_id join public.restaurants r on r.id=o.restaurant_id where o.tracking_token=p_tracking_token $$;
revoke all on function public.get_order_tracking(uuid) from public;
grant execute on function public.get_order_tracking(uuid) to anon,authenticated;

grant usage on schema public to anon, authenticated;
revoke all on public.restaurants from anon;
grant select on public.restaurants to authenticated;
grant select on public.restaurant_tables,public.menu_categories,public.menu_items to anon,authenticated;
grant insert,update,delete on public.branches,public.restaurant_tables,public.menu_categories,public.menu_items to authenticated;
grant update on public.restaurants to authenticated;
grant select on public.orders to authenticated;
grant update(status) on public.orders to authenticated;
grant select on public.order_items,public.restaurant_members,public.branches,public.business_documents to authenticated;
