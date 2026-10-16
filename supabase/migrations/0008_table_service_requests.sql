-- Guest table service requests, protected by the dining-session capability.
-- Apply after migrations 0001 through 0007.

create table public.table_service_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null,
  table_id uuid not null,
  dining_session_id uuid not null references public.dining_sessions(id) on delete cascade,
  request_type text not null check (request_type in ('assistance','water','cutlery','clean_table')),
  note text not null default '' check (length(note) <= 300),
  status text not null default 'new' check (status in ('new','acknowledged','resolved','cancelled')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id,branch_id) references public.branches(restaurant_id,id) on delete cascade,
  foreign key (restaurant_id,table_id) references public.restaurant_tables(restaurant_id,id) on delete cascade
);

create index table_service_requests_restaurant_status on public.table_service_requests(restaurant_id,status,created_at desc);
create index table_service_requests_session on public.table_service_requests(dining_session_id,created_at desc);

alter table public.table_service_requests enable row level security;
create policy "restaurant team read service requests" on public.table_service_requests
  for select to authenticated using (public.has_restaurant_role(restaurant_id,array['owner','manager','staff']::public.restaurant_role[]));
create policy "platform admins read service requests" on public.table_service_requests
  for select to authenticated using (public.is_platform_admin());

create or replace function public.table_service_requests_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
create trigger table_service_requests_touch_updated_at before update on public.table_service_requests
  for each row execute procedure public.table_service_requests_touch_updated_at();

-- A guest proves they are at the table with the private dining-session token.
-- A short per-type cooldown keeps a repeated tap from creating a noisy queue.
create or replace function public.request_table_service(
  p_session_id uuid,p_session_token uuid,p_request_type text,p_note text default ''
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_session public.dining_sessions%rowtype; v_id uuid;
begin
  select * into v_session
  from public.dining_sessions
  where id=p_session_id and public_token=p_session_token and status in ('open','bill_requested')
  for update;
  if not found then raise exception 'Dining session is not available'; end if;
  if p_request_type not in ('assistance','water','cutlery','clean_table') then raise exception 'Choose a valid service request'; end if;
  if length(trim(coalesce(p_note,'')))>300 then raise exception 'Keep the note within 300 characters'; end if;
  select id into v_id from public.table_service_requests
  where dining_session_id=v_session.id and request_type=p_request_type and status in ('new','acknowledged')
    and created_at>now()-interval '30 seconds'
  order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.table_service_requests(restaurant_id,branch_id,table_id,dining_session_id,request_type,note)
    values(v_session.restaurant_id,v_session.branch_id,v_session.table_id,v_session.id,p_request_type,trim(coalesce(p_note,'')))
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.request_table_service(uuid,uuid,text,text) from public;
grant execute on function public.request_table_service(uuid,uuid,text,text) to anon,authenticated;

-- Restaurant staff can acknowledge or close a request in their live queue.
create or replace function public.update_table_service_request(p_request_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public
as $$
declare v_request public.table_service_requests%rowtype;
begin
  select * into v_request from public.table_service_requests where id=p_request_id for update;
  if not found or not public.has_restaurant_role(v_request.restaurant_id,array['owner','manager','staff']::public.restaurant_role[]) then
    raise exception 'Service request is unavailable';
  end if;
  if p_status not in ('acknowledged','resolved','cancelled') then raise exception 'Choose a valid service request status'; end if;
  if v_request.status in ('resolved','cancelled') then return; end if;
  if p_status='resolved' and v_request.status='new' then raise exception 'Acknowledge the request before resolving it'; end if;
  update public.table_service_requests
  set status=p_status,
      acknowledged_at=case when p_status='acknowledged' then coalesce(acknowledged_at,now()) else acknowledged_at end,
      resolved_at=case when p_status in ('resolved','cancelled') then now() else resolved_at end
  where id=v_request.id;
end $$;
revoke all on function public.update_table_service_request(uuid,text) from public;
grant execute on function public.update_table_service_request(uuid,text) to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='table_service_requests') then
    alter publication supabase_realtime add table public.table_service_requests;
  end if;
end $$;
