-- Run in the Supabase SQL editor for the shared "ken-apps" project.
-- Tables are prefixed with the app name (goal_tracker_) since this
-- Supabase project is shared across multiple apps.

create table goal_tracker_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8a5cf6',
  created_at timestamptz not null default now()
);

create table goal_tracker_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references goal_tracker_activities(id) on delete cascade,
  date date not null,
  unique (activity_id, date)
);

alter table goal_tracker_activities enable row level security;
alter table goal_tracker_completions enable row level security;

create policy "own activities" on goal_tracker_activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own completions" on goal_tracker_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shared with the whole household (Ken + Nao). RLS itself stays open to any
-- authenticated user; access is actually restricted one level up, in Auth:
-- both accounts were created directly in the dashboard and js/auth.js sends
-- OTP codes with shouldCreateUser:false, so nobody else can self-register.
create table goal_tracker_todos (
  id uuid primary key default gen_random_uuid(),
  list_type text not null check (list_type in ('shared', 'ken', 'nao')),
  title text not null,
  done boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table goal_tracker_chores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  last_done_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table goal_tracker_todos enable row level security;
alter table goal_tracker_chores enable row level security;

create policy "household todos" on goal_tracker_todos
  for all to authenticated using (true) with check (true);

create policy "household chores" on goal_tracker_chores
  for all to authenticated using (true) with check (true);

-- Manual drag-to-reorder ordering. Position is only meaningful within a
-- single list_type for todos (each list is reordered independently).
alter table goal_tracker_todos add column position integer not null default 0;
alter table goal_tracker_chores add column position integer not null default 0;

-- Household net-worth dashboard. Live stock/ETF/crypto prices are fetched
-- client-side via the api/quote.js Vercel function, not stored here.
create table goal_tracker_assets (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('shared', 'ken', 'nao')),
  asset_type text not null check (asset_type in ('stock', 'etf', 'crypto', 'cash')),
  name text not null,
  symbol text,
  quantity numeric,
  amount numeric,
  currency text not null default 'JPY',
  memo text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table goal_tracker_assets enable row level security;

create policy "household assets" on goal_tracker_assets
  for all to authenticated using (true) with check (true);

-- Manual drag-to-reorder ordering, same convention as todos/chores.
alter table goal_tracker_assets add column position integer not null default 0;

-- Due dates for the home-screen dashboard (todos due soon / chores due soon).
alter table goal_tracker_todos add column due_date date;
alter table goal_tracker_chores add column next_due_date date;

-- Shared household shopping list (groceries / daily necessities). Same
-- sharing model as todos/chores: RLS stays open to any authenticated user.
create table goal_tracker_shopping_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('food', 'daily')),
  name text not null,
  quantity text,
  bought boolean not null default false,
  position integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  bought_at timestamptz
);

alter table goal_tracker_shopping_items enable row level security;

create policy "household shopping items" on goal_tracker_shopping_items
  for all to authenticated using (true) with check (true);

-- Realtime: lets both household members' screens pick up each other's
-- writes instantly instead of only on next navigation/reload. Each
-- *-app.js subscribes via its repository's subscribeToChanges().
alter publication supabase_realtime add table
  goal_tracker_todos,
  goal_tracker_chores,
  goal_tracker_assets,
  goal_tracker_shopping_items;
