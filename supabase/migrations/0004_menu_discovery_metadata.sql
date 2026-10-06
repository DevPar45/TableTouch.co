-- Add restaurant-authored menu discovery metadata without changing existing items.
alter table public.menu_items
  add column if not exists ingredients text[] not null default '{}',
  add column if not exists allergens text[] not null default '{}',
  add column if not exists spice_level text,
  add column if not exists chef_recommendation boolean not null default false,
  add column if not exists search_keywords text[] not null default '{}';

create index if not exists menu_items_ingredients_gin_idx
  on public.menu_items using gin (ingredients);

create index if not exists menu_items_allergens_gin_idx
  on public.menu_items using gin (allergens);

create index if not exists menu_items_search_keywords_gin_idx
  on public.menu_items using gin (search_keywords);
