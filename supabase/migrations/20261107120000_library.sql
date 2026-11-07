-- Spec 07 / decision 0016: the Library.
--
-- 1. library_page: one page of a shelf for the caller, in one of four sorts,
--    with a keyset cursor so pages never repeat or skip a title, even when
--    many share a rating, year or title. Ties break on anime id.
-- 2. library_counts: how many titles are on each shelf, for the tabs.
-- 3. library_remove: "Remove from library" clears a title's status, rating,
--    like and watchlist as one event, so one Undo (deck_undo) restores it.
--
-- All three run as the caller (security invoker), so 0011's RLS limits them to
-- the caller's own rows. Retired titles are left out; their tracking rows stay.
-- No aggregate score is read or returned (brief).

create function public.library_page(
  p_shelf text,
  p_sort text default 'updated',
  p_cursor jsonb default null,
  p_page_size int default 48
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
  status public.watch_status,
  rating smallint,
  liked boolean,
  watchlisted boolean,
  -- Pass the last row's cursor back to get the next page.
  cursor jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_size int := coalesce(p_page_size, 48);
  v_status public.watch_status;
  -- The cursor: the sort key of the last row and its anime id.
  v_id bigint;
  v_ts timestamptz;
  v_num int;
  v_text text;
begin
  if v_user is null then
    raise exception 'Sign in to see your library.' using errcode = 'insufficient_privilege';
  end if;
  if p_shelf is null or p_shelf not in ('watched', 'watching', 'on_hold', 'dropped', 'watchlist', 'liked') then
    raise exception 'Unknown shelf: %', p_shelf using errcode = 'invalid_parameter_value';
  end if;
  if p_sort is null or p_sort not in ('updated', 'rating', 'title', 'year') then
    raise exception 'Unknown sort: %', p_sort using errcode = 'invalid_parameter_value';
  end if;
  if v_size < 1 or v_size > 48 then
    raise exception 'A page is 1 to 48 titles.' using errcode = 'invalid_parameter_value';
  end if;
  if p_shelf in ('watched', 'watching', 'on_hold', 'dropped') then
    v_status := p_shelf::public.watch_status;
  end if;

  if p_cursor is not null then
    if jsonb_typeof(p_cursor) <> 'object'
       or p_cursor ->> 'sort' is distinct from p_sort
       or jsonb_typeof(p_cursor -> 'id') <> 'number' then
      raise exception 'That page link is out of date.' using errcode = 'invalid_parameter_value';
    end if;
    v_id := (p_cursor ->> 'id')::bigint;
    case p_sort
      when 'updated' then v_ts := (p_cursor ->> 'key')::timestamptz;
      when 'rating', 'year' then v_num := (p_cursor ->> 'key')::int;
      else v_text := p_cursor ->> 'key';
    end case;
  end if;

  return query
  with shelf as (
    select
      ua.anime_id, ua.status, ua.rating, ua.liked, ua.watchlisted, ua.updated_at,
      a.title, a.type, a.year, a.episodes, a.duration_seconds,
      a.status = 'upcoming' as is_upcoming,
      -- Sort keys. Unrated and undated titles sort last.
      coalesce(ua.rating, 0)::int as rating_key,
      coalesce(a.year, -1)::int as year_key,
      lower(a.title) as title_key
    from public.user_anime ua
    join catalog.anime a on a.id = ua.anime_id
    where ua.user_id = v_user
      and a.retired_at is null
      and case p_shelf
            when 'watchlist' then ua.watchlisted
            when 'liked' then ua.liked
            else ua.status = v_status
          end
  ),
  page as (
    select s.*
    from shelf s
    where p_cursor is null
       or case p_sort
            when 'updated' then
              s.updated_at < v_ts or (s.updated_at = v_ts and s.anime_id > v_id)
            when 'rating' then
              s.rating_key < v_num or (s.rating_key = v_num and s.anime_id > v_id)
            when 'year' then
              s.year_key < v_num or (s.year_key = v_num and s.anime_id > v_id)
            else
              s.title_key > v_text or (s.title_key = v_text and s.anime_id > v_id)
          end
    order by
      case when p_sort = 'updated' then s.updated_at end desc,
      case when p_sort = 'rating' then s.rating_key end desc,
      case when p_sort = 'year' then s.year_key end desc,
      case when p_sort = 'title' then s.title_key end asc,
      s.anime_id asc
    limit v_size
  )
  select
    p.anime_id,
    p.title,
    (select t.title from catalog.anime_titles t
     where t.anime_id = p.anime_id and t.title ~ '[぀-ヿ一-鿿]'
     order by t.kind, t.id limit 1),
    p.type,
    p.year,
    p.episodes,
    p.duration_seconds,
    p.is_upcoming,
    p.status,
    p.rating,
    p.liked,
    p.watchlisted,
    jsonb_build_object(
      'sort', p_sort,
      'id', p.anime_id,
      'key', case p_sort
               when 'updated' then to_jsonb(p.updated_at)
               when 'rating' then to_jsonb(p.rating_key)
               when 'year' then to_jsonb(p.year_key)
               else to_jsonb(p.title_key)
             end
    )
  from page p
  order by
    case when p_sort = 'updated' then p.updated_at end desc,
    case when p_sort = 'rating' then p.rating_key end desc,
    case when p_sort = 'year' then p.year_key end desc,
    case when p_sort = 'title' then p.title_key end asc,
    p.anime_id asc;
end;
$$;

revoke execute on function public.library_page(text, text, jsonb, int) from public, anon;
grant execute on function public.library_page(text, text, jsonb, int) to authenticated;

-- One row per shelf, zero included, for the caller only.
create function public.library_counts()
returns table (shelf text, count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select ua.status, ua.liked, ua.watchlisted
    from public.user_anime ua
    join catalog.anime a on a.id = ua.anime_id
    where ua.user_id = (select auth.uid())
      and a.retired_at is null
  )
  select 'watched', count(*) filter (where status = 'watched') from mine
  union all
  select 'watching', count(*) filter (where status = 'watching') from mine
  union all
  select 'on_hold', count(*) filter (where status = 'on_hold') from mine
  union all
  select 'dropped', count(*) filter (where status = 'dropped') from mine
  union all
  select 'watchlist', count(*) filter (where watchlisted) from mine
  union all
  select 'liked', count(*) filter (where liked) from mine;
$$;

revoke execute on function public.library_counts() from public, anon;
grant execute on function public.library_counts() to authenticated;

-- "Remove from library": status, rating, like and watchlist cleared as one
-- event (kind status_cleared, marked "removed"), which deck_undo reverses.
create function public.library_remove(p_anime_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Takes the per-title lock, like the other writes.
  perform public.tracking_current(p_anime_id);
  return public.tracking_apply(
    p_anime_id, null, null, false, false,
    'status_cleared'::public.tracking_event_kind,
    jsonb_build_object('removed', true)
  );
end;
$$;

revoke execute on function public.library_remove(bigint) from public, anon;
grant execute on function public.library_remove(bigint) to authenticated;
