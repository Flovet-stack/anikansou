-- Spec 05 fix: in 20261106140000_tracking_and_deck.sql, the event kind chosen
-- with CASE is typed `text`, so these functions couldn't find tracking_apply
-- (which takes public.tracking_event_kind). Cast it. Bodies are otherwise
-- unchanged.

create or replace function public.set_status(p_anime_id bigint, p_status public.watch_status)
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
    (case when p_status is null then 'status_cleared' else 'status_set' end)::public.tracking_event_kind
  );
end;
$$;

create or replace function public.set_rating(p_anime_id bigint, p_rating smallint)
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
    (case when p_rating is null then 'rating_cleared' else 'rated' end)::public.tracking_event_kind
  );
end;
$$;

create or replace function public.set_watchlist(p_anime_id bigint, p_on boolean)
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
    (case when coalesce(p_on, false) then 'watchlist_added' else 'watchlist_removed' end)::public.tracking_event_kind
  );
end;
$$;

create or replace function public.set_like(p_anime_id bigint, p_liked boolean)
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
    (case when coalesce(p_liked, false) then 'liked' else 'unliked' end)::public.tracking_event_kind
  );
end;
$$;

create or replace function public.deck_seen(
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
    (case when p_rating is null then 'status_set' else 'rated' end)::public.tracking_event_kind
  );
end;
$$;
