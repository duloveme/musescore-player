-- Apply in the Supabase SQL editor or with the Supabase CLI.
-- This file is not run by the Next.js deploy.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '연주자',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  artist text not null default '',
  difficulty text not null default '',
  tags text[] not null default '{}',
  favorite boolean not null default false,
  last_practiced_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.song_assets (
  id uuid primary key,
  song_id uuid not null references public.songs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('score', 'audio')),
  bucket text not null default 'song-files',
  object_path text not null,
  byte_size bigint not null check (byte_size > 0),
  mime text not null default '',
  original_name text not null,
  version integer not null default 1 check (version > 0),
  status text not null check (status in ('uploading', 'ready', 'failed', 'replaced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (object_path)
);

create unique index song_assets_one_ready
  on public.song_assets (song_id, kind)
  where status = 'ready';

create table public.sync_points (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  score_asset_id uuid references public.song_assets (id) on delete set null,
  audio_asset_id uuid references public.song_assets (id) on delete set null,
  score_ms numeric not null,
  audio_sec numeric not null check (audio_sec >= 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (song_id, score_ms)
);

create table public.practice_loops (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  start_measure integer not null check (start_measure >= 0),
  end_measure integer not null check (end_measure >= start_measure),
  score_asset_id uuid references public.song_assets (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.practice_settings (
  song_id uuid primary key references public.songs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  tempo_ratio numeric not null default 1 check (tempo_ratio >= 0.5 and tempo_ratio <= 1.5),
  original_volume numeric not null default 0.8 check (original_volume >= 0 and original_volume <= 1),
  drum_volume numeric not null default 0.7 check (drum_volume >= 0 and drum_volume <= 1),
  metronome_volume numeric not null default 0.5 check (metronome_volume >= 0 and metronome_volume <= 1),
  count_in_volume numeric not null default 0.7 check (count_in_volume >= 0 and count_in_volume <= 1),
  original_enabled boolean not null default true,
  drum_enabled boolean not null default true,
  metronome_enabled boolean not null default true,
  count_in text not null default '1' check (count_in in ('0', '1', '2')),
  count_in_every_loop boolean not null default false,
  measures_per_screen integer not null default 4 check (measures_per_screen in (2, 4, 8)),
  last_measure integer not null default 0,
  last_beat numeric not null default 0,
  visual_offset_ms integer not null default 0 check (visual_offset_ms between -200 and 200),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create index songs_owner_updated on public.songs (owner_id, updated_at desc);
create index song_assets_song on public.song_assets (song_id, kind, status);
create index sync_points_song on public.sync_points (song_id);
create index practice_loops_song on public.practice_loops (song_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger songs_touch before update on public.songs
for each row execute function public.touch_updated_at();
create trigger song_assets_touch before update on public.song_assets
for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger practice_settings_touch before update on public.practice_settings
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '연주자')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.song_assets enable row level security;
alter table public.sync_points enable row level security;
alter table public.practice_loops enable row level security;
alter table public.practice_settings enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy songs_all on public.songs for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy song_assets_all on public.song_assets for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
);

create policy sync_points_all on public.sync_points for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
);

create policy practice_loops_all on public.practice_loops for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
);

create policy practice_settings_all on public.practice_settings for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.songs s
    where s.id = song_id and s.owner_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public)
values ('song-files', 'song-files', false)
on conflict (id) do nothing;

create policy song_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'song-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.songs s
    where s.id::text = (storage.foldername(name))[2]
      and s.owner_id = (select auth.uid())
  )
);

create policy song_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'song-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.songs s
    where s.id::text = (storage.foldername(name))[2]
      and s.owner_id = (select auth.uid())
  )
);

create policy song_files_update on storage.objects for update to authenticated
using (
  bucket_id = 'song-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'song-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy song_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'song-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
