-- Spec 05 tuning, after checking the deck on the live catalog.
--
-- 1. Adult tags. "pornography" (334 anime, 27 of them hentai), "borderline
--    porn" (179, 11) and "erotic game" (152, 11) are used as story themes or
--    sources, so they flagged mainstream titles like Hunter x Hunter (2011)
--    and Kusuriya no Hitorigoto as 18+. Only tags that reliably mean explicit
--    content stay: hentai, erotica (911 of 1,031 also hentai), 18 restricted
--    and plot with porn.
--
-- 2. Speed. One query covering both "no cursor" and "after this cursor" was
--    planned generically and took ~250 ms for a user with 2,000 tracked
--    titles. Two plain queries walk the deck_order index and stay fast.

create or replace function catalog.is_adult(p_anime_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from catalog.anime_tags at
    join catalog.tags t on t.id = at.tag_id
    where at.anime_id = p_anime_id
      and t.name in ('hentai', 'erotica', '18 restricted', 'plot with porn')
  );
$$;

-- Whether the user has already dealt with an anime (0010): a status, rating
-- or watchlist, or a skip in the last 30 days that wasn't undone.
create function public.deck_excluded(p_user uuid, p_anime_id bigint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_anime ua
    where ua.user_id = p_user and ua.anime_id = p_anime_id
      and (ua.status is not null or ua.rating is not null or ua.watchlisted)
  ) or exists (
    select 1 from public.user_anime_events e
    where e.user_id = p_user and e.anime_id = p_anime_id
      and e.kind = 'deck_skipped'
      and e.created_at > now() - interval '30 days'
      and not exists (
        select 1 from public.user_anime_events u
        where u.user_id = p_user and u.kind = 'undone'
          and (u.value ->> 'event_id')::bigint = e.id
      )
  );
$$;

revoke execute on function public.deck_excluded(uuid, bigint) from public, anon, authenticated;

create or replace function public.deck_next(p_after bigint default null, p_page_size int default 10)
returns table (
  anime_id bigint,
  title text,
  native_title text,
  type catalog.anime_type,
  year smallint,
  season catalog.season,
  episodes integer,
  duration_seconds integer,
  studios text[],
  tags text[],
  is_upcoming boolean,
  is_adult boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_size int := least(greatest(coalesce(p_page_size, 10), 1), 20);
  v_after_aired boolean;
  v_after_rank double precision;
  v_ids bigint[];
begin
  if v_user is null then
    raise exception 'Sign in to use the deck.' using errcode = 'insufficient_privilege';
  end if;

  perform public.deck_order_refresh_if_stale();

  if p_after is not null then
    select o.aired, o.rank into v_after_aired, v_after_rank
    from public.deck_order o where o.anime_id = p_after;
  end if;

  if v_after_aired is null then
    -- First page (or an unknown cursor): from the top of the order.
    select array_agg(x.anime_id order by x.aired desc, x.rank desc, x.anime_id)
    into v_ids
    from (
      select o.anime_id, o.aired, o.rank
      from public.deck_order o
      where not public.deck_excluded(v_user, o.anime_id)
      order by o.aired desc, o.rank desc, o.anime_id
      limit v_size
    ) x;
  else
    -- After the cursor: the rest of its section (aired or unaired), then the
    -- sections after it. Two index ranges instead of one OR, so a cursor deep
    -- in the deck stays as fast as one near the top.
    select array_agg(x.anime_id order by x.aired desc, x.rank desc, x.anime_id)
    into v_ids
    from (
      select y.anime_id, y.aired, y.rank
      from (
        (select o.anime_id, o.aired, o.rank
         from public.deck_order o
         where o.aired = v_after_aired
           and o.rank <= v_after_rank
           and not (o.rank = v_after_rank and o.anime_id <= p_after)
           and not public.deck_excluded(v_user, o.anime_id)
         order by o.aired desc, o.rank desc, o.anime_id
         limit v_size)
        union all
        (select o.anime_id, o.aired, o.rank
         from public.deck_order o
         where o.aired < v_after_aired
           and not public.deck_excluded(v_user, o.anime_id)
         order by o.aired desc, o.rank desc, o.anime_id
         limit v_size)
      ) y
      order by y.aired desc, y.rank desc, y.anime_id
      limit v_size
    ) x;
  end if;

  return query
  select
    a.id,
    a.title,
    (select t.title from catalog.anime_titles t
     where t.anime_id = a.id and t.title ~ '[぀-ヿ一-鿿]'
     order by t.kind, t.id limit 1),
    a.type,
    a.year,
    a.season,
    a.episodes,
    a.duration_seconds,
    array(select st.name from catalog.anime_studios ast
          join catalog.studios st on st.id = ast.studio_id
          where ast.anime_id = a.id and ast.role = 'studio'
          order by st.name limit 3),
    array(select tg.name from catalog.anime_tags atg
          join catalog.tags tg on tg.id = atg.tag_id
          where atg.anime_id = a.id
          order by tg.id limit 3),
    a.status = 'upcoming',
    catalog.is_adult(a.id)
  from unnest(coalesce(v_ids, '{}')) with ordinality as page(id, position)
  join catalog.anime a on a.id = page.id
  -- Retired since the last refresh: leave it out.
  where a.retired_at is null
  order by page.position;
end;
$$;
