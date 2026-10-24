-- The AI study guide (context, explanation and reflection for each reading of every Mass) beside each day's reflection,
-- and a personal AI reflection per reader and day, written from that reader's notes and intentions.

alter table public.reflections add column study jsonb;

create table public.personal_reflections (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  text text not null,
  level text not null,
  model text,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.personal_reflections enable row level security;

create policy "owner all" on public.personal_reflections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
