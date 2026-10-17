-- Hotel guest-service requests are distinct from room-service orders and never
-- use a public room identifier as proof of a guest stay or a payment authority.

create table public.hotel_service_requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.restaurants(id) on delete cascade,
  room_id uuid not null,
  request_type text not null check (request_type in ('housekeeping','fresh_towels','extra_pillows','extra_blankets','toiletries','water','tea_coffee','cutlery','tray_pickup','assistance','luggage')),
  note text not null default '' check (length(note) <= 300),
  status text not null default 'pending' check (status in ('pending','acknowledged','in_progress','completed','cancelled')),
  assigned_to uuid references auth.users(id) on delete set null,
  internal_note text not null default '' check (length(internal_note) <= 1000),
  idempotency_key uuid not null,
  tracking_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (hotel_id,room_id) references public.hotel_rooms(hotel_id,id) on delete cascade,
  unique (hotel_id,idempotency_key)
);
create index hotel_service_requests_queue on public.hotel_service_requests(hotel_id,status,created_at desc);
create index hotel_service_requests_room on public.hotel_service_requests(room_id,created_at desc);

alter table public.hotel_service_requests enable row level security;
create policy "hotel team read hotel service requests" on public.hotel_service_requests for select to authenticated
  using (public.is_restaurant_member(hotel_id));
create policy "platform admins read hotel service requests" on public.hotel_service_requests for select to authenticated
  using (public.is_platform_admin());

create or replace function public.hotel_service_requests_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create trigger hotel_service_requests_touch_updated_at before update on public.hotel_service_requests
  for each row execute procedure public.hotel_service_requests_touch_updated_at();

create or replace function public.request_hotel_service(
  p_hotel_slug text,p_room_number text,p_room_token uuid,p_request_type text,
  p_note text,p_idempotency_key uuid,p_tracking_token uuid
) returns table(request_id uuid,tracking_token uuid,status text)
language plpgsql security definer set search_path=public
as $$
declare v_hotel public.restaurants%rowtype; v_room public.hotel_rooms%rowtype; v_existing public.hotel_service_requests%rowtype;
begin
  if p_request_type not in ('housekeeping','fresh_towels','extra_pillows','extra_blankets','toiletries','water','tea_coffee','cutlery','tray_pickup','assistance','luggage') then raise exception 'Choose a valid hotel service request'; end if;
  if length(trim(coalesce(p_note,'')))>300 then raise exception 'Keep the note within 300 characters'; end if;
  select h.* into v_hotel from public.restaurants h
    where h.slug=p_hotel_slug and h.business_type='hotel' and h.approval_status='approved' and h.service_status='online' and h.room_service_enabled;
  if not found then raise exception 'Hotel service is unavailable'; end if;
  select * into v_room from public.hotel_rooms r
    where r.hotel_id=v_hotel.id and r.room_number=trim(p_room_number) and r.public_token=p_room_token
      and r.is_active and r.room_service_enabled and r.archived_at is null;
  if not found then raise exception 'Use the QR or NFC tag provided in this room'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_room.id::text||p_idempotency_key::text,0));
  select * into v_existing from public.hotel_service_requests where hotel_id=v_hotel.id and idempotency_key=p_idempotency_key;
  if found then return query select v_existing.id,v_existing.tracking_token,v_existing.status; return; end if;
  if (select count(*) from public.hotel_service_requests where room_id=v_room.id and created_at>now()-interval '1 hour')>=20 then raise exception 'Please contact reception for further assistance'; end if;
  select * into v_existing from public.hotel_service_requests
    where room_id=v_room.id and request_type=p_request_type and status in ('pending','acknowledged','in_progress') and created_at>now()-interval '30 seconds'
    order by created_at desc limit 1;
  if found then return query select v_existing.id,v_existing.tracking_token,v_existing.status; return; end if;
  insert into public.hotel_service_requests(hotel_id,room_id,request_type,note,idempotency_key,tracking_token)
    values(v_hotel.id,v_room.id,p_request_type,trim(coalesce(p_note,'')),p_idempotency_key,p_tracking_token)
    returning * into v_existing;
  return query select v_existing.id,v_existing.tracking_token,v_existing.status;
end $$;
revoke all on function public.request_hotel_service(text,text,uuid,text,text,uuid,uuid) from public;
grant execute on function public.request_hotel_service(text,text,uuid,text,text,uuid,uuid) to anon,authenticated;

create or replace function public.update_hotel_service_request(
  p_request_id uuid,p_status text,p_assigned_to uuid default null,p_internal_note text default null
) returns void language plpgsql security definer set search_path=public
as $$
declare v_request public.hotel_service_requests%rowtype; v_role public.restaurant_role;
begin
  select * into v_request from public.hotel_service_requests where id=p_request_id for update;
  if not found then raise exception 'Hotel service request not found'; end if;
  select role into v_role from public.restaurant_members where restaurant_id=v_request.hotel_id and user_id=auth.uid();
  if v_role is null then raise exception 'Hotel team access required'; end if;
  if p_status not in ('acknowledged','in_progress','completed','cancelled') then raise exception 'Choose a valid request status'; end if;
  if p_assigned_to is not null and v_role not in ('owner','manager') then raise exception 'Only a manager can assign requests'; end if;
  if p_status='cancelled' and v_role='staff' then raise exception 'Only a manager can cancel requests'; end if;
  if (v_request.status,p_status) not in (('pending','acknowledged'),('pending','in_progress'),('pending','cancelled'),('acknowledged','in_progress'),('acknowledged','completed'),('acknowledged','cancelled'),('in_progress','completed'),('in_progress','cancelled')) then raise exception 'Invalid hotel service request transition'; end if;
  update public.hotel_service_requests
    set status=p_status,
        assigned_to=case when p_assigned_to is not null then p_assigned_to when p_status in ('acknowledged','in_progress') then coalesce(assigned_to,auth.uid()) else assigned_to end,
        internal_note=case when p_internal_note is null then internal_note else left(trim(p_internal_note),1000) end,
        acknowledged_at=case when p_status in ('acknowledged','in_progress') then coalesce(acknowledged_at,now()) else acknowledged_at end,
        completed_at=case when p_status='completed' then now() else completed_at end
    where id=v_request.id;
end $$;
revoke all on function public.update_hotel_service_request(uuid,text,uuid,text) from public;
grant execute on function public.update_hotel_service_request(uuid,text,uuid,text) to authenticated;

create or replace function public.get_hotel_service_request(p_tracking_token uuid)
returns table(request_type text,status text,created_at timestamptz,acknowledged_at timestamptz,completed_at timestamptz)
language sql stable security definer set search_path=public
as $$ select request_type,status,created_at,acknowledged_at,completed_at from public.hotel_service_requests where tracking_token=p_tracking_token $$;
revoke all on function public.get_hotel_service_request(uuid) from public;
grant execute on function public.get_hotel_service_request(uuid) to anon,authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hotel_service_requests') then
    alter publication supabase_realtime add table public.hotel_service_requests;
  end if;
end $$;
