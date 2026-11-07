-- Spec 09 / decision 0018: title search.
--
-- search_anime: a page of anime whose main title or any synonym matches the
-- query, in any script, ranked as 0018 says. Matching uses word similarity
-- (`<%`) on the trigram index spec 01 already built on
-- catalog.anime_titles.search_text, so no table or index changes.
--
-- Security definer, because ranking reads the private aggregated score
-- (catalog.anime_scores, service-only). The score and every similarity value
-- stay inside: neither is returned (brief, 0018). Because RLS doesn't apply
-- here, the caller's own tracking state is filtered by auth.uid() explicitly;
-- signed-out callers (anon) get none.

create function public.search_anime(
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
begin
  -- At least 2 characters that aren't spaces or ASCII punctuation: "!!" or
  -- "a" would match everything or nothing useful.
  if char_length(regexp_replace(v_query, '[[:space:][:punct:]]', '', 'g')) < 2 then
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

  return query
  with hits as (
    -- Every matching title row, through the trigram index.
    select
      t.anime_id,
      t.title,
      t.kind,
      t.search_text = v_query as exact,
      extensions.word_similarity(v_query, t.search_text) as sim
    from catalog.anime_titles t
    -- `<%` uses the index at pg_trgm's default threshold (0.6). The second
    -- test keeps 0.6 as the floor even if that default is ever lowered.
    where v_query operator(extensions.<%) t.search_text
      and extensions.word_similarity(v_query, t.search_text) >= 0.6
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
    coalesce(ua.liked, false),
    coalesce(ua.watchlisted, false),
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

revoke execute on function public.search_anime(text, int, int) from public;
grant execute on function public.search_anime(text, int, int) to anon, authenticated;
