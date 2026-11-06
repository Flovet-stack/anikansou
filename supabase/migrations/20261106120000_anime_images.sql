-- Poster sources (spec 03, decision 0008).
--
-- Each anime can have poster images from several sources. Sources are ranked
-- and can be switched off; readers get active images from enabled sources,
-- best first, and the UI falls back to the generated poster. The catalog
-- import never reads or writes these tables.

-- ---------------------------------------------------------------------------
-- Sources
-- ---------------------------------------------------------------------------

create table catalog.image_sources (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  -- Links for this source must start with this prefix. Null: the source keeps
  -- its files in our Storage bucket `posters`, so rows carry a storage_path.
  url_prefix text check (url_prefix is null or url_prefix ~ '^https://[^/]+/'),
  -- Lower is better. Unique, so the order is never ambiguous.
  priority integer not null unique,
  is_enabled boolean not null default false,
  attribution text not null default '',
  created_at timestamptz not null default now()
);

insert into catalog.image_sources
  (slug, name, url_prefix, priority, is_enabled, attribution)
values
  ('inhouse', 'AniKansou', null, 10, true, ''),
  ('tmdb', 'TMDB', 'https://image.tmdb.org/t/p/', 20, true,
   'This product uses the TMDB API but is not endorsed or certified by TMDB.'),
  -- Off until AniList gives written permission (decision 0008).
  ('anilist', 'AniList', 'https://s4.anilist.co/', 30, false, 'Images: AniList.');

-- ---------------------------------------------------------------------------
-- Images
-- ---------------------------------------------------------------------------

create table catalog.anime_images (
  id bigint generated always as identity primary key,
  anime_id bigint not null references catalog.anime (id) on delete cascade,
  kind text not null default 'poster' check (kind in ('poster')),
  source_id bigint not null references catalog.image_sources (id),
  url text check (url is null or url !~ '\s'),
  storage_path text check (
    storage_path is null
    or (
      storage_path <> ''
      and storage_path !~ '^/'
      and storage_path !~ '(^|/)\.\.(/|$)'
      and storage_path !~ '\s'
    )
  ),
  -- Where the image came from at its source, e.g. `tv/12345` for TMDB.
  external_ref text,
  width integer check (width > 0),
  height integer check (height > 0),
  status text not null default 'active' check (status in ('active', 'broken')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anime_images_one_location
    check ((url is null) <> (storage_path is null)),
  constraint anime_images_one_per_source unique (anime_id, kind, source_id)
);

create index anime_images_source_id_idx on catalog.anime_images (source_id);

-- Links must sit under their source's prefix, so no other host can be shown
-- by mistake. Storage sources take a path instead. Also keeps updated_at.
create function catalog.anime_images_check_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  prefix text;
begin
  select s.url_prefix into prefix
  from catalog.image_sources s
  where s.id = new.source_id;
  if not found then
    raise exception 'Unknown image source %', new.source_id;
  end if;

  if prefix is null then
    if new.storage_path is null then
      raise exception 'This source keeps images in Storage: set storage_path, not url';
    end if;
  elsif new.url is null or left(new.url, length(prefix)) <> prefix then
    raise exception 'Image links for this source must start with %', prefix;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function catalog.anime_images_check_source()
  from public, anon, authenticated;

create trigger anime_images_check_source
  before insert or update on catalog.anime_images
  for each row execute function catalog.anime_images_check_source();

-- ---------------------------------------------------------------------------
-- What readers use
-- ---------------------------------------------------------------------------

create view catalog.poster_candidates
with (security_invoker = true) as
select
  i.anime_id,
  s.slug as source,
  s.priority,
  i.url,
  i.storage_path,
  i.width,
  i.height
from catalog.anime_images i
join catalog.image_sources s on s.id = i.source_id
where i.kind = 'poster'
  and i.status = 'active'
  and s.is_enabled;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table catalog.image_sources enable row level security;
alter table catalog.anime_images enable row level security;

revoke all on catalog.image_sources, catalog.anime_images, catalog.poster_candidates
  from public, anon, authenticated;
grant select on catalog.image_sources, catalog.anime_images, catalog.poster_candidates
  to anon, authenticated;

create policy "Image sources are readable by everyone" on catalog.image_sources
  for select to anon, authenticated using (true);

-- Switching a source off hides its images here too, not only in the view.
create policy "Active images from enabled sources are readable by everyone"
  on catalog.anime_images
  for select to anon, authenticated
  using (
    status = 'active'
    and exists (
      select 1 from catalog.image_sources s
      where s.id = source_id and s.is_enabled
    )
  );
