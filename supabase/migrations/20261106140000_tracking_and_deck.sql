-- Spec 05: tracking data (decision 0011) and the swipe deck (decisions 0009, 0010).
--
-- user_anime holds each user's current state per anime; user_anime_events is
-- the append-only history. Every write goes through one of the functions
-- below, which change the state and record exactly one event together.

create type public.watch_status as enum ('watched', 'watching', 'on_hold', 'dropped');

create type public.tracking_event_kind as enum (
  'status_set', 'status_cleared',
  'rated', 'rating_cleared',
  'liked', 'unliked',
  'watchlist_added', 'watchlist_removed',
  'deck_skipped',
  'undone'
);

-- ---------------------------------------------------------------------------
-- Current state
-- ---------------------------------------------------------------------------

create table public.user_anime (
  user_id uuid not null references auth.users (id) on delete cascade,
  anime_id bigint not null references catalog.anime (id),
  status public.watch_status,
  -- Half stars: 1 = ½ star … 10 = 5 stars (brief).
  rating smallint check (rating between 1 and 10),
  liked boolean not null default false,
  watchlisted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

create index user_anime_anime_idx on public.user_anime (anime_id);

comment on table public.user_anime is
  'Each user''s current tracking state per anime. A row with nothing set is deleted (0011).';

-- ---------------------------------------------------------------------------
-- History
-- ---------------------------------------------------------------------------

create table public.user_anime_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  anime_id bigint not null references catalog.anime (id),
  kind public.tracking_event_kind not null,
  -- {"before": state, "after": state}, plus {"via": …} for deck skips and
  -- {"event_id": …} for undos. State = status, rating, liked, watchlisted.
  value jsonb not null default '{}',
  source text not null default 'deck' check (source in ('deck')),
  created_at timestamptz not null default now()
);

create index user_anime_events_user_created_idx
  on public.user_anime_events (user_id, created_at desc);
create index user_anime_events_skips_idx
  on public.user_anime_events (user_id, anime_id, created_at)
  where kind = 'deck_skipped';
create index user_anime_events_undone_idx
  on public.user_anime_events (user_id, ((value ->> 'event_id')::bigint))
  where kind = 'undone';

comment on table public.user_anime_events is
  'Append-only history of tracking changes (0011). Undo adds an `undone` event; nothing is rewritten.';

-- ---------------------------------------------------------------------------
-- Access (0011): users read and write only their own rows; events are
-- insert-only. Column privileges limit what clients can write.
-- ---------------------------------------------------------------------------

alter table public.user_anime enable row level security;
alter table public.user_anime_events enable row level security;

revoke all on table public.user_anime from anon, authenticated;
revoke all on table public.user_anime_events from anon, authenticated;

grant select, delete on table public.user_anime to authenticated;
grant insert (user_id, anime_id, status, rating, liked, watchlisted)
  on table public.user_anime to authenticated;
grant update (status, rating, liked, watchlisted, updated_at)
  on table public.user_anime to authenticated;

grant select on table public.user_anime_events to authenticated;
grant insert (user_id, anime_id, kind, value, source)
  on table public.user_anime_events to authenticated;

create policy "Users read their own tracking"
  on public.user_anime for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users add their own tracking"
  on public.user_anime for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users change their own tracking"
  on public.user_anime for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users remove their own tracking"
  on public.user_anime for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read their own history"
  on public.user_anime_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users add to their own history"
  on public.user_anime_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create function public.user_anime_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.user_anime_touch_updated_at()
  from public, anon, authenticated;

create trigger user_anime_touch_updated_at
  before update on public.user_anime
  for each row
  execute function public.user_anime_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Writes. Each function runs as the caller (RLS applies), records exactly one
-- event and deletes the row when nothing is left set. They refuse a status or
-- rating for an anime that hasn't aired yet (0009, 0010).
-- ---------------------------------------------------------------------------

-- The state of one user's anime, as stored in events.
create function public.tracking_state(p_row public.user_anime)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', p_row.status,
    'rating', p_row.rating,
    'liked', coalesce(p_row.liked, false),
    'watchlisted', coalesce(p_row.watchlisted, false)
  );
$$;

-- Applies a new state (null fields keep their meaning: null status/rating =
-- unset) and records one event. Internal: not callable through the API.
create function public.tracking_apply(
  p_anime_id bigint,
  p_status public.watch_status,
  p_rating smallint,
  p_liked boolean,
  p_watchlisted boolean,
  p_kind public.tracking_event_kind,
  p_extra jsonb default '{}'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_before public.user_anime;
  v_after public.user_anime;
  v_anime_status catalog.anime_status;
  v_retired timestamptz;
  v_event bigint;
begin
  if v_user is null then
    raise exception 'Sign in to track anime.' using errcode = 'insufficient_privilege';
  end if;

  select a.status, a.retired_at into v_anime_status, v_retired
  from catalog.anime a where a.id = p_anime_id;
  if not found or v_retired is not null then
    raise exception 'This anime is no longer in the catalog.' using errcode = 'no_data_found';
  end if;
  if v_anime_status = 'upcoming' and (p_status is not null or p_rating is not null) then
    raise exception 'This anime hasn''t aired yet, so it can''t be rated or given a status.'
      using errcode = 'check_violation';
  end if;

  select * into v_before from public.user_anime
  where user_id = v_user and anime_id = p_anime_id;

  if p_status is null and p_rating is null
     and not coalesce(p_liked, false) and not coalesce(p_watchlisted, false) then
    delete from public.user_anime where user_id = v_user and anime_id = p_anime_id;
    v_after := null;
  else
    insert into public.user_anime as ua
      (user_id, anime_id, status, rating, liked, watchlisted)
    values (v_user, p_anime_id, p_status, p_rating,
            coalesce(p_liked, false), coalesce(p_watchlisted, false))
    on conflict (user_id, anime_id) do update
      set status = excluded.status,
          rating = excluded.rating,
          liked = excluded.liked,
          watchlisted = excluded.watchlisted
    returning ua.* into v_after;
  end if;

  insert into public.user_anime_events (user_id, anime_id, kind, value)
  values (
    v_user, p_anime_id, p_kind,
    jsonb_build_object(
      'before', public.tracking_state(v_before),
      'after', public.tracking_state(v_after)
    ) || coalesce(p_extra, '{}')
  )
  returning id into v_event;

  return jsonb_build_object('event_id', v_event, 'state', public.tracking_state(v_after));
end;
$$;

revoke execute on function public.tracking_apply(
  bigint, public.watch_status, smallint, boolean, boolean,
  public.tracking_event_kind, jsonb
) from public, anon, authenticated;

-- The current row, or an empty one.
create function public.tracking_current(p_anime_id bigint)
returns public.user_anime
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select ua from public.user_anime ua
     where ua.user_id = (select auth.uid()) and ua.anime_id = p_anime_id),
    row((select auth.uid()), p_anime_id, null, null, false, false, now(), now())::public.user_anime
  );
$$;

revoke execute on function public.tracking_current(bigint)
  from public, anon, authenticated;

create function public.set_status(p_anime_id bigint, p_status public.watch_status)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.user_anime := public.tracking_current(p_anime_id);
begin
  return public.tracking_apply(
    p_anime_id, p_status, c.rating, c.liked, c.watchlisted,
    case when p_status is null then 'status_cleared' else 'status_set' end
  );
end;
$$;

create function public.set_rating(p_anime_id bigint, p_rating smallint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.user_anime := public.tracking_current(p_anime_id);
begin
  if p_rating is not null and (p_rating < 1 or p_rating > 10) then
    raise exception 'A rating is between 1 and 10 (half stars).' using errcode = 'check_violation';
  end if;
  return public.tracking_apply(
    p_anime_id,
    -- A rating with no status means "watched" (0009).
    case when p_rating is not null and c.status is null then 'watched'::public.watch_status else c.status end,
    p_rating, c.liked, c.watchlisted,
    case when p_rating is null then 'rating_cleared' else 'rated' end
  );
end;
$$;

create function public.set_watchlist(p_anime_id bigint, p_on boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.user_anime := public.tracking_current(p_anime_id);
begin
  return public.tracking_apply(
    p_anime_id, c.status, c.rating, c.liked, coalesce(p_on, false),
    case when coalesce(p_on, false) then 'watchlist_added' else 'watchlist_removed' end
  );
end;
$$;

create function public.set_like(p_anime_id bigint, p_liked boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.user_anime := public.tracking_current(p_anime_id);
begin
  return public.tracking_apply(
    p_anime_id, c.status, c.rating, coalesce(p_liked, false), c.watchlisted,
    case when coalesce(p_liked, false) then 'liked' else 'unliked' end
  );
end;
$$;

-- Touch "Seen it": a status (Watched by default) and an optional rating, as one event.
create function public.deck_seen(
  p_anime_id bigint,
  p_status public.watch_status,
  p_rating smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.user_anime := public.tracking_current(p_anime_id);
begin
  if p_rating is not null and (p_rating < 1 or p_rating > 10) then
    raise exception 'A rating is between 1 and 10 (half stars).' using errcode = 'check_violation';
  end if;
  return public.tracking_apply(
    p_anime_id, coalesce(p_status, 'watched'), p_rating, c.liked, c.watchlisted,
    case when p_rating is null then 'status_set' else 'rated' end
  );
end;
$$;

-- "Not seen" on touch, or moving past an anime on the web: no state change,
-- but the deck leaves it out for 30 days.
create function public.deck_skip(p_anime_id bigint, p_via text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.user_anime := public.tracking_current(p_anime_id);
begin
  if p_via not in ('not_seen', 'passed') then
    raise exception 'Unknown skip: %', p_via using errcode = 'invalid_parameter_value';
  end if;
  return public.tracking_apply(
    p_anime_id, c.status, c.rating, c.liked, c.watchlisted,
    'deck_skipped', jsonb_build_object('via', p_via)
  );
end;
$$;

-- Reverses one of the caller's events. Only the latest live event for that
-- anime can be undone, so undo always restores exactly what was there.
create function public.deck_undo(p_event_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  e public.user_anime_events;
  v_latest bigint;
  b jsonb;
begin
  select * into e from public.user_anime_events
  where id = p_event_id and user_id = v_user;
  if not found then
    raise exception 'Nothing to undo.' using errcode = 'no_data_found';
  end if;
  if e.kind = 'undone' or exists (
    select 1 from public.user_anime_events u
    where u.user_id = v_user and u.kind = 'undone'
      and (u.value ->> 'event_id')::bigint = e.id
  ) then
    raise exception 'That was already undone.' using errcode = 'check_violation';
  end if;

  select max(x.id) into v_latest
  from public.user_anime_events x
  where x.user_id = v_user and x.anime_id = e.anime_id and x.kind <> 'undone'
    and not exists (
      select 1 from public.user_anime_events u
      where u.user_id = v_user and u.kind = 'undone'
        and (u.value ->> 'event_id')::bigint = x.id
    );
  if v_latest <> e.id then
    raise exception 'Undo the newer changes to this anime first.' using errcode = 'check_violation';
  end if;

  b := e.value -> 'before';
  return public.tracking_apply(
    e.anime_id,
    nullif(b ->> 'status', '')::public.watch_status,
    nullif(b ->> 'rating', '')::smallint,
    coalesce((b ->> 'liked')::boolean, false),
    coalesce((b ->> 'watchlisted')::boolean, false),
    'undone',
    jsonb_build_object('event_id', e.id)
  );
end;
$$;

revoke execute on function public.set_status(bigint, public.watch_status) from public, anon;
revoke execute on function public.set_rating(bigint, smallint) from public, anon;
revoke execute on function public.set_watchlist(bigint, boolean) from public, anon;
revoke execute on function public.set_like(bigint, boolean) from public, anon;
revoke execute on function public.deck_seen(bigint, public.watch_status, smallint) from public, anon;
revoke execute on function public.deck_skip(bigint, text) from public, anon;
revoke execute on function public.deck_undo(bigint) from public, anon;
grant execute on function public.set_status(bigint, public.watch_status) to authenticated;
grant execute on function public.set_rating(bigint, smallint) to authenticated;
grant execute on function public.set_watchlist(bigint, boolean) to authenticated;
grant execute on function public.set_like(bigint, boolean) to authenticated;
grant execute on function public.deck_seen(bigint, public.watch_status, smallint) to authenticated;
grant execute on function public.deck_skip(bigint, text) to authenticated;
grant execute on function public.deck_undo(bigint) to authenticated;

-- The helpers run inside the functions above, as the caller.
grant execute on function public.tracking_apply(
  bigint, public.watch_status, smallint, boolean, boolean,
  public.tracking_event_kind, jsonb
) to authenticated;
grant execute on function public.tracking_current(bigint) to authenticated;
grant execute on function public.tracking_state(public.user_anime) to authenticated;

-- ---------------------------------------------------------------------------
-- The deck (0010)
-- ---------------------------------------------------------------------------

-- Walks the catalog in score order without a sort on every call.
create index anime_scores_deck_idx
  on catalog.anime_scores (arithmetic_geometric_mean desc, anime_id);

-- Tags that mark explicit adult content, checked against the live catalog on
-- 2026-11-06. Broader tags (ecchi, nudity, "adult cast", sex, yaoi/yuri…)
-- describe content or audience, not explicit material, so they're left out.
create function catalog.is_adult(p_anime_id bigint)
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
      and t.name in (
        'hentai', 'erotica', 'pornography', 'borderline porn',
        'erotic game', '18 restricted', 'plot with porn'
      )
  );
$$;

revoke execute on function catalog.is_adult(bigint) from public, anon, authenticated;

-- The next cards for the signed-in user, best-known first. Reads the private
-- scores to order the deck but never returns them (brief, 0010). The cursor is
-- the last anime id returned: it says nothing about the score.
create function public.deck_next(p_after bigint default null, p_page_size int default 10)
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
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_size int := least(greatest(coalesce(p_page_size, 10), 1), 20);
  -- Unscored anime come after every scored one: they sort as -1.
  v_after_score double precision;
begin
  if v_user is null then
    raise exception 'Sign in to use the deck.' using errcode = 'insufficient_privilege';
  end if;

  if p_after is not null then
    select coalesce(s.arithmetic_geometric_mean, -1) into v_after_score
    from catalog.anime a
    left join catalog.anime_scores s on s.anime_id = a.id
    where a.id = p_after;
  end if;

  return query
  with candidates as (
    select a.id, coalesce(s.arithmetic_geometric_mean, -1) as score
    from catalog.anime a
    left join catalog.anime_scores s on s.anime_id = a.id
    where a.retired_at is null
      and a.type in ('tv', 'movie', 'ona', 'ova')
      and (
        v_after_score is null
        or coalesce(s.arithmetic_geometric_mean, -1) < v_after_score
        or (coalesce(s.arithmetic_geometric_mean, -1) = v_after_score and a.id > p_after)
      )
      -- Not acted on: no status, rating or watchlist. A like alone isn't a verdict.
      and not exists (
        select 1 from public.user_anime ua
        where ua.user_id = v_user and ua.anime_id = a.id
          and (ua.status is not null or ua.rating is not null or ua.watchlisted)
      )
      -- Not skipped or passed in the last 30 days (unless that was undone).
      and not exists (
        select 1 from public.user_anime_events e
        where e.user_id = v_user and e.anime_id = a.id
          and e.kind = 'deck_skipped'
          and e.created_at > now() - interval '30 days'
          and not exists (
            select 1 from public.user_anime_events u
            where u.user_id = v_user and u.kind = 'undone'
              and (u.value ->> 'event_id')::bigint = e.id
          )
      )
    order by score desc, a.id
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
  order by c.score desc, c.id;
end;
$$;

revoke execute on function public.deck_next(bigint, int) from public, anon;
grant execute on function public.deck_next(bigint, int) to authenticated;
