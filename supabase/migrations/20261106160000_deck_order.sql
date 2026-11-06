-- Decision 0014: the deck shows aired anime first, and damps scores that rest
-- on very little data, so new users start on titles they're likely to know.
--
-- The dataset gives an average score but no vote count: 34 anime have a
-- perfect 10.00, mostly from tiny samples. The number of sites that list an
-- anime (catalog.external_ids) stands in for how well known it is. The score
-- is pulled toward the catalog average with weight K = 10, by
--   (score × sites + average × K) / (sites + K)
-- and a perfect 10 counts as having no sites behind it, since no well-rated
-- title with many ratings averages exactly 10.
--
-- Computing this per request takes ~2 s, so it's stored in a materialized
-- view. deck_next refreshes it after each successful import, on first use,
-- so the importer doesn't need to know about it.

create materialized view public.deck_order as
with sites as (
  select anime_id, count(*)::int as n
  from catalog.external_ids
  group by anime_id
),
average as (
  select coalesce(avg(arithmetic_geometric_mean), 0) as c
  from catalog.anime_scores
)
select
  a.id as anime_id,
  a.status is distinct from 'upcoming' as aired,
  case
    when s.arithmetic_geometric_mean is null then -1
    else (
      s.arithmetic_geometric_mean * w.n + average.c * 10
    ) / (w.n + 10)
  end as rank
from catalog.anime a
left join catalog.anime_scores s on s.anime_id = a.id
left join sites on sites.anime_id = a.id
cross join average
cross join lateral (
  select case
    when s.arithmetic_geometric_mean >= 9.995 then 0
    else coalesce(sites.n, 0)
  end as n
) w
where a.retired_at is null
  and a.type in ('tv', 'movie', 'ona', 'ova');

create unique index deck_order_anime_idx on public.deck_order (anime_id);
create index deck_order_walk_idx
  on public.deck_order (aired desc, rank desc, anime_id);

comment on materialized view public.deck_order is
  'Private deck order (0014). Never readable through the API: it is derived from the private scores.';

-- Derived from private scores: no API access at all.
revoke all on public.deck_order from public, anon, authenticated;

-- Which import the view reflects.
create table public.deck_order_state (
  id smallint primary key default 1 check (id = 1),
  import_run_id bigint,
  refreshed_at timestamptz not null default now()
);

alter table public.deck_order_state enable row level security;
revoke all on table public.deck_order_state from public, anon, authenticated;

insert into public.deck_order_state (import_run_id)
select max(id) from catalog.import_runs where status = 'succeeded';

-- Refreshes the order when a newer import has succeeded. Serialised with an
-- advisory lock so only one caller refreshes.
create function public.deck_order_refresh_if_stale()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest bigint;
  v_current bigint;
begin
  select max(id) into v_latest from catalog.import_runs where status = 'succeeded';
  select import_run_id into v_current from public.deck_order_state where id = 1;
  if v_latest is not distinct from v_current then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('public.deck_order'));
  -- Someone may have refreshed while we waited for the lock.
  select import_run_id into v_current from public.deck_order_state where id = 1;
  if v_latest is not distinct from v_current then
    return;
  end if;
  refresh materialized view public.deck_order;
  update public.deck_order_state
    set import_run_id = v_latest, refreshed_at = now()
    where id = 1;
end;
$$;

revoke execute on function public.deck_order_refresh_if_stale()
  from public, anon, authenticated;

-- deck_next with the 0014 order. Same eligibility, fields and cursor as
-- before (0010): the cursor is the last anime id returned and says nothing
-- about the score.
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
begin
  if v_user is null then
    raise exception 'Sign in to use the deck.' using errcode = 'insufficient_privilege';
  end if;

  perform public.deck_order_refresh_if_stale();

  if p_after is not null then
    select o.aired, o.rank into v_after_aired, v_after_rank
    from public.deck_order o where o.anime_id = p_after;
  end if;

  return query
  with candidates as (
    select o.anime_id as id, o.aired, o.rank
    from public.deck_order o
    where (
        v_after_aired is null
        or o.aired < v_after_aired
        or (o.aired = v_after_aired and (
              o.rank < v_after_rank
              or (o.rank = v_after_rank and o.anime_id > p_after)))
      )
      -- Not acted on: no status, rating or watchlist. A like alone isn't a verdict.
      and not exists (
        select 1 from public.user_anime ua
        where ua.user_id = v_user and ua.anime_id = o.anime_id
          and (ua.status is not null or ua.rating is not null or ua.watchlisted)
      )
      -- Not skipped or passed in the last 30 days (unless that was undone).
      and not exists (
        select 1 from public.user_anime_events e
        where e.user_id = v_user and e.anime_id = o.anime_id
          and e.kind = 'deck_skipped'
          and e.created_at > now() - interval '30 days'
          and not exists (
            select 1 from public.user_anime_events u
            where u.user_id = v_user and u.kind = 'undone'
              and (u.value ->> 'event_id')::bigint = e.id
          )
      )
    order by o.aired desc, o.rank desc, o.anime_id
    limit v_size
  )
  select
    c.id,
    a.title,
    (select t.title from catalog.anime_titles t
     where t.anime_id = c.id and t.title ~ '[぀-ヿ一-鿿]'
     order by t.kind, t.id limit 1),
    a.type,
    a.year,
    a.season,
    a.episodes,
    a.duration_seconds,
    array(select st.name from catalog.anime_studios ast
          join catalog.studios st on st.id = ast.studio_id
          where ast.anime_id = c.id and ast.role = 'studio'
          order by st.name limit 3),
    array(select tg.name from catalog.anime_tags atg
          join catalog.tags tg on tg.id = atg.tag_id
          where atg.anime_id = c.id
          order by tg.id limit 3),
    a.status = 'upcoming',
    catalog.is_adult(c.id)
  from candidates c
  join catalog.anime a on a.id = c.id
  -- Retired since the last refresh: leave it out.
  where a.retired_at is null
  order by c.aired desc, c.rank desc, c.id;
end;
$$;

-- The old score index is no longer used by the deck.
drop index if exists catalog.anime_scores_deck_idx;
