-- TableTouch commercial-plan selection. This records a selected service plan
-- during onboarding; it deliberately does not activate or charge a plan.
alter table public.restaurants
  add column if not exists selected_service_plan text not null default 'free_pilot'
  check (selected_service_plan in ('free_pilot','card_kit','digital_table','food_photography','complete')),
  add column if not exists service_plan_status text not null default 'requested'
  check (service_plan_status in ('requested','quoted','active','cancelled'));

drop function if exists public.register_hospitality_business(text,text,text,text,text,text,text,text,text[],integer,text,text,text);
create function public.register_hospitality_business(
  p_business_type text,p_slug text,p_name text,p_owner_name text,p_phone text,p_address text,
  p_fssai_number text default '',p_gst_number text default '',p_document_paths text[] default '{}',
  p_resource_count integer default 8,p_currency_code text default 'INR',
  p_time_zone text default 'Asia/Kolkata',p_welcome_message text default '',
  p_service_plan text default 'free_pilot'
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_business uuid; v_branch uuid; v_path text;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_business_type not in ('restaurant','hotel') then raise exception 'Choose a supported business type'; end if;
  if p_service_plan not in ('free_pilot','card_kit','digital_table','food_photography','complete') then raise exception 'Choose a valid TableTouch service plan'; end if;
  if length(trim(p_name))<2 or length(trim(p_owner_name))<2 or length(trim(p_phone))<7 then raise exception 'Business and owner contact details are required'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid public URL'; end if;
  if p_resource_count not between 1 and case when p_business_type='hotel' then 1000 else 100 end then raise exception 'Choose a valid number of rooms or tables'; end if;
  if p_currency_code !~ '^[A-Z]{3}$' then raise exception 'Choose a valid ISO currency code'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_time_zone) then raise exception 'Choose a valid time zone'; end if;
  if length(trim(coalesce(p_welcome_message,'')))>500 then raise exception 'Welcome message is too long'; end if;
  if p_document_paths is null or cardinality(p_document_paths)=0 then raise exception 'At least one business proof document is required'; end if;
  insert into public.restaurants(slug,name,owner_name,owner_email,phone,address,fssai_number,gst_number,business_type,currency_code,time_zone,welcome_message,room_service_enabled,selected_service_plan,approval_status,service_status)
    values(p_slug,trim(p_name),trim(p_owner_name),coalesce((select email from auth.users where id=auth.uid()),''),trim(p_phone),trim(p_address),coalesce(p_fssai_number,''),coalesce(p_gst_number,''),p_business_type,p_currency_code,p_time_zone,trim(coalesce(p_welcome_message,'')),p_business_type='hotel',p_service_plan,'pending','offline') returning id into v_business;
  insert into public.restaurant_members(restaurant_id,user_id,role) values(v_business,auth.uid(),'owner');
  insert into public.branches(restaurant_id,name,address) values(v_business,case when p_business_type='hotel' then 'Property kitchen' else 'Main branch' end,trim(p_address)) returning id into v_branch;
  if p_business_type='hotel' then
    insert into public.menu_categories(restaurant_id,name,sort_order) values (v_business,'Breakfast',0),(v_business,'All-day dining',1),(v_business,'Beverages',2),(v_business,'Late-night menu',3);
    insert into public.hotel_rooms(hotel_id,room_number) select v_business,lpad(n::text,3,'0') from generate_series(1,p_resource_count) n;
  else
    insert into public.menu_categories(restaurant_id,name,sort_order) values (v_business,'Recommended',0),(v_business,'Starters',1),(v_business,'Main Course',2),(v_business,'Drinks',3),(v_business,'Desserts',4);
    insert into public.restaurant_tables(restaurant_id,branch_id,table_number) select v_business,v_branch,lpad(n::text,2,'0') from generate_series(1,p_resource_count) n;
  end if;
  foreach v_path in array p_document_paths loop
    if v_path !~ ('^applications/' || auth.uid()::text || '/') then raise exception 'Business document path is outside this application'; end if;
    insert into public.business_documents(restaurant_id,storage_path,document_type) values(v_business,v_path,'business-proof');
  end loop;
  return v_business;
end $$;
revoke all on function public.register_hospitality_business(text,text,text,text,text,text,text,text,text[],integer,text,text,text,text) from public;
grant execute on function public.register_hospitality_business(text,text,text,text,text,text,text,text,text[],integer,text,text,text,text) to authenticated;
