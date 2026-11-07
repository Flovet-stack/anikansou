-- Spec 06 / decision 0015: a rating needs Watched.
--
-- 1. set_status: any status other than Watched (including clearing it) also
--    clears the rating, in the same single event, so a rating never outlives
--    Watched. deck_undo restores both from the event's "before" state.
-- 2. set_rating: a rating is refused unless the title is Watched. Replaces
--    0009's "a rating with no status sets Watched".
-- 3. deck_seen: a rating only goes with Watched.
-- 4. The table refuses new writes that put a rating on a title that isn't
--    Watched, even through a direct write (0011's column grants allow
--    PATCH). Rows that already exist are left as they are.

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
    p_anime_id, p_status,
    case when p_status = 'watched' then c.rating else null end,
    c.liked, c.watchlisted,
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
  if p_rating is not null and c.status is distinct from 'watched' then
    raise exception 'Mark it watched to rate it.' using errcode = 'check_violation';
  end if;
  return public.tracking_apply(
    p_anime_id, c.status, p_rating, c.liked, c.watchlisted,
    (case when p_rating is null then 'rating_cleared' else 'rated' end)::public.tracking_event_kind
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
  v_status public.watch_status := coalesce(p_status, 'watched');
begin
  if p_rating is not null and (p_rating < 1 or p_rating > 10) then
    raise exception 'A rating is between 1 and 10 (half stars).' using errcode = 'check_violation';
  end if;
  if p_rating is not null and v_status <> 'watched' then
    raise exception 'Mark it watched to rate it.' using errcode = 'check_violation';
  end if;
  return public.tracking_apply(
    p_anime_id, v_status, p_rating, c.liked, c.watchlisted,
    (case when p_rating is null then 'status_set' else 'rated' end)::public.tracking_event_kind
  );
end;
$$;

-- Extends the trigger function from 20261106180000_tracking_integrity.sql
-- (same trigger, same events) with the Watched rule. Only new or changed
-- ratings and statuses are checked, so older rows stay editable.
create or replace function public.user_anime_check_aired()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.status is not null or new.rating is not null)
     and exists (
       select 1 from catalog.anime a
       where a.id = new.anime_id and a.status = 'upcoming'
     )
  then
    raise exception 'This anime hasn''t aired yet, so it can''t be rated or given a status.'
      using errcode = 'check_violation';
  end if;
  if new.rating is not null
     and new.status is distinct from 'watched'
     and (tg_op = 'INSERT'
          or new.rating is distinct from old.rating
          or new.status is distinct from old.status)
  then
    raise exception 'Mark it watched to rate it.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
