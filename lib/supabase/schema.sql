-- HandWriting Supabase schema
--
-- Anonymous sign-in: anonymous users use the `authenticated` Postgres role.
-- Each user (anonymous or permanent) is isolated by auth.uid() = user_id.
-- Use auth_is_anonymous() / auth_is_permanent() when a feature should be
-- limited to permanent accounts only.

-- ---------------------------------------------------------------------------
-- JWT helpers
-- ---------------------------------------------------------------------------

create or replace function public.auth_is_anonymous()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function public.auth_is_permanent()
returns boolean
language sql
stable
set search_path = public
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled worksheet',
  description text,
  template text,
  file_path text,
  storage_bucket text default 'worksheets',
  metadata jsonb default '{}'::jsonb,
  grade_level text,
  subject text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_fonts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  family text,
  style text,
  file_path text not null,
  storage_bucket text default 'fonts',
  file_size integer,
  source text,
  created_at timestamptz default now()
);

create table if not exists public.worksheet_images (
  id uuid primary key default gen_random_uuid(),
  worksheet_id uuid not null references public.worksheets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  storage_bucket text default 'worksheet-images',
  position_x double precision default 0,
  position_y double precision default 0,
  width double precision default 200,
  height double precision default 200,
  rotation double precision default 0,
  created_at timestamptz default now()
);

alter table public.worksheets enable row level security;
alter table public.user_fonts enable row level security;
alter table public.worksheet_images enable row level security;

-- ---------------------------------------------------------------------------
-- worksheets RLS (anonymous + permanent users, own rows only)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can view own worksheets" on public.worksheets;
create policy "Users can view own worksheets" on public.worksheets
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own worksheets" on public.worksheets;
create policy "Users can insert own worksheets" on public.worksheets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own worksheets" on public.worksheets;
create policy "Users can update own worksheets" on public.worksheets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own worksheets" on public.worksheets;
create policy "Users can delete own worksheets" on public.worksheets
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_fonts RLS
-- ---------------------------------------------------------------------------

drop policy if exists "Users can view own fonts" on public.user_fonts;
create policy "Users can view own fonts" on public.user_fonts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own fonts" on public.user_fonts;
create policy "Users can insert own fonts" on public.user_fonts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own fonts" on public.user_fonts;
create policy "Users can update own fonts" on public.user_fonts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own fonts" on public.user_fonts;
create policy "Users can delete own fonts" on public.user_fonts
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- worksheet_images RLS
-- ---------------------------------------------------------------------------

drop policy if exists "Users can view own worksheet images" on public.worksheet_images;
create policy "Users can view own worksheet images" on public.worksheet_images
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own worksheet images" on public.worksheet_images;
create policy "Users can insert own worksheet images" on public.worksheet_images
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own worksheet images" on public.worksheet_images;
create policy "Users can update own worksheet images" on public.worksheet_images
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own worksheet images" on public.worksheet_images;
create policy "Users can delete own worksheet images" on public.worksheet_images
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets (private; path prefix = auth.uid())
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('fonts', 'fonts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('worksheets', 'worksheets', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('worksheet-images', 'worksheet-images', false)
on conflict (id) do nothing;

-- fonts
drop policy if exists "Users can upload own font files" on storage.objects;
create policy "Users can upload own font files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fonts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read own font files" on storage.objects;
create policy "Users can read own font files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fonts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own font files" on storage.objects;
create policy "Users can delete own font files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fonts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own font files" on storage.objects;
create policy "Users can update own font files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fonts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- worksheets
drop policy if exists "Users can upload own worksheet files" on storage.objects;
create policy "Users can upload own worksheet files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'worksheets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read own worksheet files" on storage.objects;
create policy "Users can read own worksheet files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'worksheets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own worksheet files" on storage.objects;
create policy "Users can delete own worksheet files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'worksheets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own worksheet files" on storage.objects;
create policy "Users can update own worksheet files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'worksheets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- worksheet-images
drop policy if exists "Users can upload own worksheet image files" on storage.objects;
create policy "Users can upload own worksheet image files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'worksheet-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read own worksheet image files" on storage.objects;
create policy "Users can read own worksheet image files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'worksheet-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own worksheet image files" on storage.objects;
create policy "Users can delete own worksheet image files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'worksheet-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own worksheet image files" on storage.objects;
create policy "Users can update own worksheet image files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'worksheet-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Example: restrict a future feature to permanent users only
-- ---------------------------------------------------------------------------
-- create policy "Only permanent users can publish worksheets"
--   on public.worksheets
--   as restrictive
--   for update
--   to authenticated
--   with check (
--     not public.auth_is_anonymous()
--     or coalesce((metadata->>'published')::boolean, false) is false
--   );
