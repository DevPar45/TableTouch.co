-- Extend the shared order record for POS and waiter entry.
alter table public.orders
  add column if not exists order_source text not null default 'QR/NFC'
    check (order_source in ('QR/NFC', 'POS', 'Waiter', 'Counter'));
