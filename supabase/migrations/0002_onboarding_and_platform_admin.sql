-- Private platform controls and owner onboarding. Promote the first platform
-- operator by inserting their auth.users UUID into platform_admins after signup.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "admins can see their own platform role" on public.platform_admins
  for select using (user_id=auth.uid());

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.platform_admins where user_id=auth.uid()) $$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

create policy "platform admins read all restaurants" on public.restaurants
  for select using (public.is_platform_admin());
create policy "platform admins review restaurants" on public.restaurants
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "platform admins read all applications" on public.business_documents
  for select using (public.is_platform_admin());
create policy "platform admins review applications" on public.business_documents
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());
grant update on public.business_documents to authenticated;
create policy "platform admins read all orders" on public.orders
  for select using (public.is_platform_admin());
create policy "platform admins can see all restaurant memberships" on public.restaurant_members
  for select using (public.is_platform_admin());

create or replace function public.protect_restaurant_review_fields()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_platform_admin() then
    if new.approval_status is distinct from old.approval_status then
      raise exception 'Only a platform administrator can change approval status';
    end if;
    if new.service_status is distinct from old.service_status and old.approval_status <> 'approved' then
      raise exception 'Restaurant must be approved before going online';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger restaurants_protect_review_fields before update on public.restaurants
for each row execute function public.protect_restaurant_review_fields();

create or replace function public.register_restaurant(
  p_slug text, p_name text, p_owner_name text, p_phone text, p_address text,
  p_fssai_number text, p_gst_number text, p_document_paths text[] default '{}'
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_restaurant uuid; v_branch uuid; v_path text;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if length(trim(p_name)) < 2 or length(trim(p_owner_name)) < 2 or length(trim(p_phone)) < 7 then
    raise exception 'Restaurant and owner contact details are required';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid restaurant URL'; end if;
  if p_document_paths is null or cardinality(p_document_paths)=0 then raise exception 'At least one business proof document is required'; end if;
  insert into public.restaurants(slug,name,owner_name,owner_email,phone,address,fssai_number,gst_number,approval_status,service_status)
  values(p_slug,trim(p_name),trim(p_owner_name),coalesce((select email from auth.users where id=auth.uid()),''),trim(p_phone),trim(p_address),coalesce(p_fssai_number,''),coalesce(p_gst_number,''),'pending','offline') returning id into v_restaurant;
  insert into public.restaurant_members(restaurant_id,user_id,role) values(v_restaurant,auth.uid(),'owner');
  insert into public.branches(restaurant_id,name,address) values(v_restaurant,'Main branch',trim(p_address)) returning id into v_branch;
  insert into public.menu_categories(restaurant_id,name,sort_order) values
    (v_restaurant,'Recommended',0),(v_restaurant,'Starters',1),(v_restaurant,'Main Course',2),(v_restaurant,'Drinks',3),(v_restaurant,'Desserts',4);
  foreach v_path in array p_document_paths loop
    if v_path !~ ('^applications/' || auth.uid()::text || '/') then
      raise exception 'Business document path is outside this application';
    end if;
    insert into public.business_documents(restaurant_id,storage_path,document_type)
    values(v_restaurant,v_path,'business-proof');
  end loop;
  return v_restaurant;
end $$;
revoke all on function public.register_restaurant(text,text,text,text,text,text,text,text[]) from public;
grant execute on function public.register_restaurant(text,text,text,text,text,text,text,text[]) to authenticated;

-- A public menu table endpoint that omits the private QR capability token.
create or replace view public.active_public_tables with (security_invoker=false) as
select r.slug,t.table_number,t.is_active
from public.restaurant_tables t join public.restaurants r on r.id=t.restaurant_id
where t.is_active and r.approval_status='approved' and r.service_status='online';
grant select on public.active_public_tables to anon,authenticated;

create or replace view public.public_restaurant_profiles with (security_invoker=false) as
select id,slug,name,description,logo_url,cover_url,primary_color,accent_color,phone,address,tax_rate
from public.restaurants where approval_status='approved' and service_status='online';
grant select on public.public_restaurant_profiles to anon,authenticated;

create or replace function public.touch_order_updated_at()
returns trigger language plpgsql set search_path=public
as $$ begin new.updated_at=now(); return new; end $$;
create trigger orders_touch_updated_at before update on public.orders
for each row execute function public.touch_order_updated_at();

create or replace function public.enforce_order_status_transition()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.status is distinct from old.status and not public.is_platform_admin() then
    if not (
      (old.status='new' and new.status in ('accepted','cancelled')) or
      (old.status='accepted' and new.status in ('preparing','cancelled')) or
      (old.status='preparing' and new.status in ('ready','cancelled')) or
      (old.status='ready' and new.status='served') or
      (old.status='served' and new.status='completed')
    ) then raise exception 'Invalid order status transition: % to %',old.status,new.status; end if;
  end if;
  return new;
end $$;
create trigger orders_check_status_transition before update on public.orders
for each row execute function public.enforce_order_status_transition();

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='order_items') then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;

-- Create the private `business-proofs` bucket before applying the following.
create policy "owners upload application proofs" on storage.objects for insert to authenticated
  with check (bucket_id='business-proofs' and (storage.foldername(name))[1]='applications' and (storage.foldername(name))[2]=auth.uid()::text);
create policy "owners read their own application proofs" on storage.objects for select to authenticated
  using (bucket_id='business-proofs' and ((storage.foldername(name))[1]='applications' and (storage.foldername(name))[2]=auth.uid()::text or public.is_platform_admin()));
create policy "owners remove their own unsubmitted proofs" on storage.objects for delete to authenticated
  using (bucket_id='business-proofs' and (storage.foldername(name))[1]='applications' and (storage.foldername(name))[2]=auth.uid()::text);
