-- Spec 05 review fixes for tracking integrity.
--
-- 1. Unaired anime can't get a status or rating, even through a direct table
--    write (0011's column grants allow PATCH/INSERT on user_anime; the
--    functions already refuse it, now the table does too).
-- 2. Writes to one user's anime are serialised with a transaction-level
--    advisory lock, so two tabs saving at once can't lose a change, and two
--    undos of the same event can't both succeed.

create function public.user_anime_check_aired()
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
  return new;
end;
$$;

revoke execute on function public.user_anime_check_aired()
  from public, anon, authenticated;

create trigger user_anime_check_aired
  before insert or update of status, rating on public.user_anime
  for each row
  execute function public.user_anime_check_aired();

-- One lock per user and anime, held until the transaction ends.
create function public.tracking_lock(p_user uuid, p_anime_id bigint)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_anime_id::text, 0));
$$;

revoke execute on function public.tracking_lock(uuid, bigint) from public, anon;
grant execute on function public.tracking_lock(uuid, bigint) to authenticated;

-- The current row, read after taking the lock, so the change applied next is
-- based on the latest state.
create or replace function public.tracking_current(p_anime_id bigint)
returns public.user_anime
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  r public.user_anime;
begin
  perform public.tracking_lock(v_user, p_anime_id);
  select * into r from public.user_anime ua
  where ua.user_id = v_user and ua.anime_id = p_anime_id;
  if not found then
    r := row(v_user, p_anime_id, null, null, false, false, now(), now())::public.user_anime;
  end if;
  return r;
end;
$$;

-- deck_undo, with the same lock taken before it checks the event.
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
