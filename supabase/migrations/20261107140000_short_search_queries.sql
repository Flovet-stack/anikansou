-- Decision 0019 (amends 0018): short search queries match the start of a
-- title, and signed-out callers get no tracking state.
--
-- 1. A btree on anime_titles.search_text with text_pattern_ops, so a prefix
--    match (`no` -> "No Game No Life") is an index range, not a scan of the
--    ~100,000 titles that contain the particle "no" (550 ms before).
-- 2. search_anime: queries with fewer than 4 letters or digits match titles
--    and synonyms that start with them; longer ones keep word similarity.
--    Signed out, status, rating, liked and watchlisted are all null.
-- Ranking, limits, grants and the returned columns are unchanged.

create index anime_titles_search_prefix_idx
  on catalog.anime_titles (search_text text_pattern_ops);

create or replace function public.search_anime(
  p_query text,
  p_offset int default 0,
  p_limit int default 24
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
  -- The importer's search_text form: NFKC, lowercase, single spaces.
  v_query text := btrim(regexp_replace(lower(normalize(coalesce(p_query, ''), nfkc)), '\s+', ' ', 'g'));
  -- Letters and digits only: what decides a short query (0019).
  v_letters int := char_length(regexp_replace(v_query, '[[:space:][:punct:]]', '', 'g'));
  v_short boolean;
begin
  -- At least 2 characters that aren't spaces or punctuation: "!!" or "a"
  -- would match everything or nothing useful.
  if v_letters < 2 then
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

  return query
  with hits as (
    -- Every matching title row.
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
      where v_short
        and s.search_text operator(pg_catalog.~>=~) v_query
        and s.search_text operator(pg_catalog.~<~) (v_query || chr(1114111))
        and starts_with(s.search_text, v_query)
      union all
      -- Longer queries: word similarity on the trigram index (0018). `<%`
      -- uses pg_trgm's default threshold (0.6); the second test keeps 0.6 as
      -- the floor even if that default is ever lowered.
      select l.anime_id, l.title, l.kind, l.search_text
      from catalog.anime_titles l
      where not v_short
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
  ranked as (
    select
      b.*,
      a.title as shown_title,
      row_number() over (
        order by
          b.main_exact desc,
          b.any_exact desc,
          b.sim desc,
          (b.kind = 'main') desc,
          sc.arithmetic_geometric_mean desc nulls last,
          a.id
      ) as pos,
      count(*) over () as matches
    from best b
    join catalog.anime a on a.id = b.anime_id
    left join catalog.anime_scores sc on sc.anime_id = a.id
    where a.retired_at is null
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
