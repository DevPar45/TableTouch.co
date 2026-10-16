-- Real provider payment records and immutable receipts. Apply after 0008.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  dining_session_id uuid not null references public.dining_sessions(id) on delete restrict,
  provider text not null check (provider in ('razorpay')),
  provider_order_id text unique,
  provider_payment_id text unique,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency='INR'),
  status text not null default 'created' check (status in ('created','paid','failed','refunded')),
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_restaurant_created on public.payments(restaurant_id,created_at desc);
create index payments_session on public.payments(dining_session_id);

create table public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('razorpay')),
  event_key text not null unique,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  dining_session_id uuid not null unique references public.dining_sessions(id) on delete restrict,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  receipt_number text not null unique,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency='INR'),
  issued_at timestamptz not null default now()
);

alter table public.payments enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.receipts enable row level security;
create policy "owners and managers read payments" on public.payments for select to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));
create policy "owners and managers read receipts" on public.receipts for select to authenticated
  using (public.has_restaurant_role(restaurant_id,array['owner','manager']::public.restaurant_role[]));
create policy "platform admins read payments" on public.payments for select to authenticated using (public.is_platform_admin());
create policy "platform admins read receipts" on public.receipts for select to authenticated using (public.is_platform_admin());

create or replace function public.payments_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
create trigger payments_touch_updated_at before update on public.payments for each row execute procedure public.payments_touch_updated_at();
