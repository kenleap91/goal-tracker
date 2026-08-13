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
