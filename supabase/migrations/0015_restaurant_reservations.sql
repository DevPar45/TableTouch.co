-- Restaurant-scoped reservations. This is deliberately additive: it does not
-- change table QR/NFC ordering or any existing bills.
do $$ begin
  create type public.reservation_status as enum ('booked','arrived','seated','completed','cancelled','no_show');
exception when duplicate_object then null;
end $$;

create table if not exists public.restaurant_reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid,
  guest_name text not null check (char_length(trim(guest_name)) between 2 and 120),
  guest_phone text not null default '' check (char_length(guest_phone) <= 40),
  party_size smallint not null check (party_size between 1 and 100),
  reservation_at timestamptz not null,
  duration_minutes smallint not null default 90 check (duration_minutes between 15 and 720),
  status public.reservation_status not null default 'booked',
  notes text not null default '' check (char_length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id,table_id)
    references public.restaurant_tables(restaurant_id,id) on delete set null
);

create index if not exists restaurant_reservations_schedule_idx
  on public.restaurant_reservations(restaurant_id,reservation_at);
create index if not exists restaurant_reservations_table_idx
  on public.restaurant_reservations(restaurant_id,table_id,reservation_at)
  where table_id is not null;

create or replace function public.restaurant_reservations_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists restaurant_reservations_touch_updated_at on public.restaurant_reservations;
create trigger restaurant_reservations_touch_updated_at
  before update on public.restaurant_reservations
  for each row execute procedure public.restaurant_reservations_touch_updated_at();

alter table public.restaurant_reservations enable row level security;

create policy "members read restaurant reservations" on public.restaurant_reservations
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "owners and managers manage reservations" on public.restaurant_reservations
  for all to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));

grant select,insert,update,delete on public.restaurant_reservations to authenticated;

-- Include this table in the Supabase realtime publication when the project
-- uses the default publication. It is safe to re-run during a local reset.
do $$ begin
  alter publication supabase_realtime add table public.restaurant_reservations;
exception when duplicate_object then null;
end $$;
