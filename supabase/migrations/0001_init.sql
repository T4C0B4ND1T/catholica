-- Catholica schema. Shared content is public-read and written only by the service role.
-- Personal rows are owned by auth.uid() and protected by row-level security.

-- Shared tables ------------------------------------------------------------

create table public.readings (
  date date primary key,
  feast text,
  season text not null,
  color text not null,
  cycle text,
  sections jsonb not null default '[]'::jsonb,
  lectionary text,
  source_url text,
  fetched_at timestamptz not null default now()
);

create table public.reflections (
  date date primary key references public.readings (date) on delete cascade,
  text text not null,
  model text,
  created_at timestamptz not null default now()
);

create table public.bulletins (
  sunday_date date primary key,
  source_url text,
  storage_path text,
  page_count integer,
  text text,
  text_search tsvector generated always as (to_tsvector('english', coalesce(text, ''))) stored,
  fetched_at timestamptz not null default now()
);

create index bulletins_text_search_idx on public.bulletins using gin (text_search);

create table public.job_runs (
  id bigserial primary key,
  job text not null,
  started_at timestamptz not null default now(),
  status text not null,
  message text
);

create index job_runs_job_started_idx on public.job_runs (job, started_at desc);

-- Personal tables ----------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  section text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, section)
);

create table public.intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_ticks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, date)
);

-- Row-level security ---------------------------------------------------------

alter table public.readings enable row level security;
alter table public.reflections enable row level security;
alter table public.bulletins enable row level security;
alter table public.job_runs enable row level security;

create policy "public read" on public.readings for select to anon, authenticated using (true);
create policy "public read" on public.reflections for select to anon, authenticated using (true);
create policy "public read" on public.bulletins for select to anon, authenticated using (true);
create policy "public read" on public.job_runs for select to anon, authenticated using (true);

alter table public.notes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.intentions enable row level security;
alter table public.routines enable row level security;
alter table public.routine_ticks enable row level security;

create policy "owner all" on public.notes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner all" on public.bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner all" on public.intentions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner all" on public.routines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner all" on public.routine_ticks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: private bucket for bulletin PDFs (served through the app with the admin client).
insert into storage.buckets (id, name, public) values ('bulletins', 'bulletins', false)
  on conflict do nothing;
