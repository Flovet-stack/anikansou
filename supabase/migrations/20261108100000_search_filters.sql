-- Spec 10 / decision 0020: search filters on Discover.
--
-- 1. catalog.genre_tag_names: the curated genre list, label key -> the raw
--    tags it covers. Adding a genre is a one-line migration. No API access.
-- 2. search_anime gains optional type, genre, year range, season, status and
--    sort arguments, and the query becomes optional when a filter is on.
--    The old arguments keep their names and positions, so callers of the old
--    signature keep working until the app ships.
--
-- Same security model as 0018: security definer because ranking reads the
-- private score, which is never returned; the caller's own state is filtered
-- by auth.uid() explicitly. Matching on the query is unchanged (0018, 0019).
-- No table or index changes.

create function catalog.genre_tag_names(p_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_key
    when 'action' then array['action']
    when 'adventure' then array['adventure']
    when 'comedy' then array['comedy']
    when 'drama' then array['drama']
    when 'fantasy' then array['fantasy']
    when 'historical' then array['historical']
    when 'horror' then array['horror']
    when 'isekai' then array['isekai']
    when 'mecha' then array['mecha']
    when 'military' then array['military']
    when 'music' then array['music']
    when 'mystery' then array['mystery']
    when 'psychological' then array['psychological']
    when 'romance' then array['romance']
    when 'school' then array['school', 'school life']
    when 'sci-fi' then array['sci-fi', 'science fiction', 'sci fi', 'science-fiction']
    when 'slice-of-life' then array['slice of life', 'slice-of-life']
    when 'sports' then array['sports']
    when 'supernatural' then array['supernatural']
    when 'thriller' then array['thriller']
    when 'shounen' then array['shounen']
    when 'shoujo' then array['shoujo']
    when 'seinen' then array['seinen']
    when 'josei' then array['josei']
  end;
$$;

revoke execute on function catalog.genre_tag_names(text) from public, anon, authenticated;

drop function public.search_anime(text, int, int);

create function public.search_anime(
  p_query text default null,
  p_offset int default 0,
  p_limit int default 24,
  p_types text[] default null,
  p_genres text[] default null,
  p_year_from int default null,
  p_year_to int default null,
  p_season text default null,
  p_status text default null,
  p_sort text default 'best'
)
returns table (
  anime_id bigint,
  title text,
  native_title text,
  type catalog.anime_type,
  year smallint,
  episodes integer,
  duration_seconds integer,
  is_upcoming boolean,
  is_adult boolean,
  -- The title that matched, when it isn't the shown one ("Also known as").
  matched_title text,
  status public.watch_status,
  rating smallint,
  liked boolean,
  watchlisted boolean,
  -- How many anime matched, capped at 201 ("200+ results").
  total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_offset int := coalesce(p_offset, 0);
  v_limit int := coalesce(p_limit, 24);
  v_sort text := coalesce(p_sort, 'best');
  -- The importer's search_text form: NFKC, lowercase, single spaces.
  v_query text := btrim(regexp_replace(lower(normalize(coalesce(p_query, ''), nfkc)), '\s+', ' ', 'g'));
  -- Letters and digits only: what decides a short query (0019).
  v_letters int := char_length(regexp_replace(v_query, '[[:space:][:punct:]]', '', 'g'));
  v_has_query boolean := v_query <> '';
  v_short boolean;
  v_types catalog.anime_type[];
  v_season catalog.season;
  v_status catalog.anime_status;
  v_genre text;
  v_names text[];
  v_tag_ids bigint[];
  -- Anime with every chosen genre; null when no genre is chosen.
  v_genre_anime bigint[];
  v_has_filter boolean;
begin
  if p_types is not null and cardinality(p_types) > 0 then
    if not p_types <@ array['tv', 'movie', 'ova', 'ona', 'special'] then
      raise exception 'Unknown type.' using errcode = 'invalid_parameter_value';
    end if;
    v_types := p_types::catalog.anime_type[];
  end if;
  if p_season is not null then
    if p_season not in ('winter', 'spring', 'summer', 'fall') then
      raise exception 'Unknown season: %', p_season using errcode = 'invalid_parameter_value';
    end if;
    if p_year_from is null or p_year_from is distinct from p_year_to then
      raise exception 'A season needs a single year.' using errcode = 'invalid_parameter_value';
    end if;
    v_season := p_season::catalog.season;
  end if;
  if p_status is not null then
    if p_status not in ('finished', 'ongoing', 'upcoming') then
      raise exception 'Unknown status: %', p_status using errcode = 'invalid_parameter_value';
    end if;
    v_status := p_status::catalog.anime_status;
  end if;
  if v_sort not in ('best', 'newest', 'oldest', 'title') then
    raise exception 'Unknown sort: %', v_sort using errcode = 'invalid_parameter_value';
  end if;

  v_has_filter := v_types is not null
    or (p_genres is not null and cardinality(p_genres) > 0)
    or p_year_from is not null or p_year_to is not null
    or v_status is not null;

  -- At least 2 characters that aren't spaces or punctuation, unless a filter
  -- is on and the field is empty: "!!" or "a" alone match nothing useful.
  if v_letters < 2 and (v_has_query or not v_has_filter) then
    raise exception 'Type at least 2 characters to search.' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(v_query) > 100 then
    raise exception 'A search is at most 100 characters.' using errcode = 'invalid_parameter_value';
  end if;
  if v_limit < 1 or v_limit > 24 then
    raise exception 'A page is 1 to 24 titles.' using errcode = 'invalid_parameter_value';
  end if;
  if v_offset < 0 or v_offset >= 200 then
    raise exception 'Search shows the first 200 results only.' using errcode = 'invalid_parameter_value';
  end if;
  -- Under 4 letters or digits, a query matches the start of a title (0019).
  v_short := v_letters < 4;

  -- Genres match all: tag ids first, then intersect, which is what keeps two
  -- large genres fast (0020's probe: 39 ms against 389 ms by tag name).
  if p_genres is not null and cardinality(p_genres) > 0 then
    foreach v_genre in array p_genres loop
      v_names := catalog.genre_tag_names(v_genre);
      if v_names is null then
        raise exception 'Unknown genre: %', v_genre using errcode = 'invalid_parameter_value';
      end if;
      select coalesce(array_agg(t.id), '{}') into v_tag_ids
      from catalog.tags t where t.name = any(v_names);

      if v_genre_anime is null then
        select coalesce(array_agg(distinct x.anime_id), '{}') into v_genre_anime
        from catalog.anime_tags x where x.tag_id = any(v_tag_ids);
      else
        select coalesce(array_agg(m.anime_id), '{}') into v_genre_anime
        from (
          select x.anime_id from catalog.anime_tags x where x.tag_id = any(v_tag_ids)
          intersect
          select unnest(v_genre_anime)
        ) m;
      end if;
    end loop;
  end if;

  return query
  with genre_anime as materialized (
    select unnest(v_genre_anime) as anime_id
  ),
  hits as (
    -- Every title row matching the query.
    select
      t.anime_id,
      t.title,
      t.kind,
      t.search_text = v_query as exact,
      extensions.word_similarity(v_query, t.search_text) as sim
    from (
      -- Short queries: titles that start with the query, through the prefix
      -- index. A byte range, so the index works in generic plans too;
      -- starts_with makes the match exact.
      select s.anime_id, s.title, s.kind, s.search_text
      from catalog.anime_titles s
      where v_has_query and v_short
        and s.search_text operator(pg_catalog.~>=~) v_query
        and s.search_text operator(pg_catalog.~<~) (v_query || chr(1114111))
        and starts_with(s.search_text, v_query)
      union all
      -- Longer queries: word similarity on the trigram index (0018). `<%`
      -- uses pg_trgm's default threshold (0.6); the second test keeps 0.6 as
      -- the floor even if that default is ever lowered.
      select l.anime_id, l.title, l.kind, l.search_text
      from catalog.anime_titles l
      where v_has_query and not v_short
        and v_query operator(extensions.<%) l.search_text
        and extensions.word_similarity(v_query, l.search_text) >= 0.6
    ) t
  ),
  best as (
    -- One row per anime: its best-matching title, main title first on ties.
    select distinct on (h.anime_id)
      h.anime_id, h.title as hit_title, h.kind, h.sim,
      bool_or(h.exact and h.kind = 'main') over w as main_exact,
      bool_or(h.exact) over w as any_exact
    from hits h
    window w as (partition by h.anime_id)
    order by h.anime_id, h.sim desc, (h.kind = 'main') desc, h.exact desc
  ),
  pool as (
    -- With a query: what matched. Without one: the whole catalog.
    select b.anime_id, b.hit_title, b.kind, b.sim, b.main_exact, b.any_exact
    from best b
    union all
    select c.id, null::text, null::catalog.title_kind, null::real, false, false
    from catalog.anime c
    where not v_has_query
  ),
  ranked as (
    select
      p.anime_id,
      p.hit_title,
      a.title as shown_title,
      row_number() over (
        order by
          case when v_sort = 'newest' then a.year end desc nulls last,
          case when v_sort = 'newest' then a.season end desc nulls last,
          case when v_sort = 'oldest' then a.year end asc nulls last,
          case when v_sort = 'oldest' then a.season end asc nulls last,
          case when v_sort = 'title' then lower(a.title) end asc,
          -- Browsing without a query: aired titles first, as in the deck.
          case when v_sort = 'best' and not v_has_query then a.status is distinct from 'upcoming' end desc,
          case when v_sort = 'best' then p.main_exact end desc,
          case when v_sort = 'best' then p.any_exact end desc,
          case when v_sort = 'best' then p.sim end desc nulls last,
          case when v_sort = 'best' then p.kind = 'main' end desc nulls last,
          case when v_sort = 'best' then sc.arithmetic_geometric_mean end desc nulls last,
          a.id
      ) as pos,
      count(*) over () as matches
    from pool p
    join catalog.anime a on a.id = p.anime_id
    left join catalog.anime_scores sc on sc.anime_id = a.id
    where a.retired_at is null
      and (v_types is null or a.type = any(v_types))
      and (v_genre_anime is null or a.id in (select g.anime_id from genre_anime g))
      and (p_year_from is null or a.year >= p_year_from)
      and (p_year_to is null or a.year <= p_year_to)
      and (v_season is null or a.season = v_season)
      and (v_status is null or a.status = v_status)
  )
  select
    a.id,
    a.title,
    (select nt.title from catalog.anime_titles nt
     where nt.anime_id = a.id and nt.title ~ '[぀-ヿ一-鿿]'
     order by nt.kind, nt.id limit 1),
    a.type,
    a.year,
    a.episodes,
    a.duration_seconds,
    a.status = 'upcoming',
    catalog.is_adult(a.id),
    case when r.hit_title <> r.shown_title then r.hit_title end,
    ua.status,
    ua.rating,
    -- Signed out: no state at all, not "not liked" (spec 09 #2).
    case when v_user is not null then coalesce(ua.liked, false) end,
    case when v_user is not null then coalesce(ua.watchlisted, false) end,
    least(r.matches, 201)::int
  from ranked r
  join catalog.anime a on a.id = r.anime_id
  left join public.user_anime ua
    on v_user is not null and ua.user_id = v_user and ua.anime_id = a.id
  where r.pos > v_offset
    and r.pos <= least(v_offset + v_limit, 200)
  order by r.pos;
end;
$$;

revoke execute on function public.search_anime(text, int, int, text[], text[], int, int, text, text, text) from public;
grant execute on function public.search_anime(text, int, int, text[], text[], int, int, text, text, text) to anon, authenticated;
