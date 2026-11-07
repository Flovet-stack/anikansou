-- AniList covers for titles on screen (spec 08, decision 0017).
--
-- The server looks up covers for the titles a page is about to show and
-- records them here through one function, so no service-role key is needed.
-- Titles AniList has no cover for are remembered for 30 days, so they aren't
-- asked about again on every view.

-- ---------------------------------------------------------------------------
-- Switch AniList on (0017 replaces items 5 and 6 of 0008)
-- ---------------------------------------------------------------------------

update catalog.image_sources
set is_enabled = true,
    attribution = 'Cover images: AniList.'
where slug = 'anilist';

-- ---------------------------------------------------------------------------
-- "Looked up, no cover"
-- ---------------------------------------------------------------------------

create table catalog.anime_image_misses (
  anime_id bigint not null references catalog.anime (id) on delete cascade,
  kind text not null default 'poster' check (kind in ('poster')),
  source_id bigint not null references catalog.image_sources (id),
  checked_at timestamptz not null default now(),
  primary key (anime_id, kind, source_id)
);

create index anime_image_misses_source_id_idx
  on catalog.anime_image_misses (source_id);

alter table catalog.anime_image_misses enable row level security;

revoke all on catalog.anime_image_misses from public, anon, authenticated;
grant select on catalog.anime_image_misses to anon, authenticated;

create policy "Image misses are readable by everyone"
  on catalog.anime_image_misses
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Recording lookups
-- ---------------------------------------------------------------------------

-- Takes up to 50 `{anime_id, url}` items; a null url means AniList has no
-- cover. Any signed-in user can call this, so it accepts nothing but AniList
-- anime cover links, writes only AniList's rows, and skips anime that don't
-- exist or are retired. Returns how many anime it recorded.
create function catalog.record_anilist_covers(p_covers jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source bigint;
  v_count integer;
begin
  if jsonb_typeof(p_covers) is distinct from 'array' then
    raise exception 'Expected a JSON array of {anime_id, url}';
  end if;
  if jsonb_array_length(p_covers) > 50 then
    raise exception 'At most 50 covers per call, got %',
      jsonb_array_length(p_covers);
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_covers) e
    where jsonb_typeof(e) is distinct from 'object'
       or jsonb_typeof(e -> 'anime_id') is distinct from 'number'
       or (e ->> 'anime_id') !~ '^[1-9][0-9]{0,17}$'
       or coalesce(jsonb_typeof(e -> 'url'), 'null') not in ('string', 'null')
  ) then
    raise exception 'Each item needs a whole-number anime_id and a url (text or null)';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_covers) e
    where jsonb_typeof(e -> 'url') = 'string'
      and (
        length(e ->> 'url') > 300
        or (e ->> 'url') ~ '\.\.'
        or (e ->> 'url') !~ '^https://s4\.anilist\.co/file/anilistcdn/media/anime/cover/[A-Za-z0-9._/-]+$'
      )
  ) then
    raise exception
      'Cover links must start with https://s4.anilist.co/file/anilistcdn/media/anime/cover/';
  end if;

  select s.id into v_source
  from catalog.image_sources s
  where s.slug = 'anilist';
  if not found then
    raise exception 'The anilist image source is missing';
  end if;

  with items as (
    -- One item per anime; existing, non-retired anime only.
    select distinct on (a.id) a.id as anime_id, e ->> 'url' as url
    from jsonb_array_elements(p_covers) e
    join catalog.anime a
      on a.id = (e ->> 'anime_id')::bigint
     and a.retired_at is null
    order by a.id
  ),
  covers as (
    insert into catalog.anime_images (anime_id, kind, source_id, url)
    select i.anime_id, 'poster', v_source, i.url
    from items i
    where i.url is not null
    on conflict on constraint anime_images_one_per_source do update
      set url = excluded.url,
          -- A new link gets another chance; the same link keeps its status.
          status = case
            when catalog.anime_images.url = excluded.url
              then catalog.anime_images.status
            else 'active'
          end
    returning 1
  ),
  found as (
    delete from catalog.anime_image_misses m
    using items i
    where m.anime_id = i.anime_id
      and m.kind = 'poster'
      and m.source_id = v_source
      and i.url is not null
    returning 1
  ),
  misses as (
    insert into catalog.anime_image_misses (anime_id, kind, source_id, checked_at)
    select i.anime_id, 'poster', v_source, now()
    from items i
    where i.url is null
    on conflict (anime_id, kind, source_id) do update
      set checked_at = excluded.checked_at
    returning 1
  )
  select count(*) into v_count from items;

  return v_count;
end;
$$;

revoke execute on function catalog.record_anilist_covers(jsonb)
  from public, anon;
grant execute on function catalog.record_anilist_covers(jsonb)
  to authenticated;
