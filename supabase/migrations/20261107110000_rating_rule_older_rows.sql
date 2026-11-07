-- Spec 06 review fix for 20261107100000_rating_needs_watched.sql: rows saved
-- before that rule (a rating with Watching, On hold or Dropped, possible from
-- spec 05's touch status row) must stay editable and undoable.
--
-- 1. tracking_apply saves with INSERT ... ON CONFLICT DO UPDATE, and Postgres
--    fires BEFORE INSERT row triggers before it finds the conflict. So the
--    INSERT pass now skips the Watched rule when the row already exists; the
--    UPDATE pass that follows checks only what actually changes.
-- 2. deck_undo puts back an earlier state exactly, even one from before the
--    rule. It marks its transaction, and the trigger lets that restore
--    through. The mark is transaction-local and set only inside deck_undo;
--    the API can't set it.

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
     and coalesce(current_setting('anikansou.restoring', true), '') <> 'on'
     and (
       (tg_op = 'INSERT' and not exists (
          select 1 from public.user_anime ua
          where ua.user_id = new.user_id and ua.anime_id = new.anime_id
        ))
       or (tg_op = 'UPDATE' and (new.rating is distinct from old.rating
                                 or new.status is distinct from old.status))
     )
  then
    raise exception 'Mark it watched to rate it.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- deck_undo from 20261106180000_tracking_integrity.sql, unchanged except that
-- it marks the restore for the trigger above.
create or replace function public.deck_undo(p_event_id bigint)
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
  v_result jsonb;
begin
  select * into e from public.user_anime_events
  where id = p_event_id and user_id = v_user;
  if not found then
    raise exception 'Nothing to undo.' using errcode = 'no_data_found';
  end if;

  perform public.tracking_lock(v_user, e.anime_id);

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
  perform set_config('anikansou.restoring', 'on', true);
  v_result := public.tracking_apply(
    e.anime_id,
    nullif(b ->> 'status', '')::public.watch_status,
    nullif(b ->> 'rating', '')::smallint,
    coalesce((b ->> 'liked')::boolean, false),
    coalesce((b ->> 'watchlisted')::boolean, false),
    'undone',
    jsonb_build_object('event_id', e.id)
  );
  perform set_config('anikansou.restoring', '', true);
  return v_result;
end;
$$;
