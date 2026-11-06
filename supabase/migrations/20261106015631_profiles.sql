-- Spec 02: accounts. One public profile per auth user, created on sign-up.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until the user finishes the username step. Stored lowercase, so the
  -- plain unique index below is also case-insensitive.
  username text,
  display_name text,
  created_at timestamptz not null default now(),

  constraint profiles_username_format
    check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  -- Keep in sync with RESERVED_USERNAMES in src/features/profiles/schemas.ts.
  constraint profiles_username_not_reserved
    check (username <> all (array[
      'admin', 'anime', 'api', 'auth', 'help', 'login', 'settings',
      'signup', 'support', 'u', 'user', 'users'
    ])),
  constraint profiles_display_name_length
    check (
      char_length(display_name) between 1 and 50
      and display_name !~ '^\s|\s$'
    )
);

create unique index profiles_username_key on public.profiles (username);

comment on table public.profiles is
  'Public profile per auth user. Every column is public; email stays in auth.users.';

-- Access. RLS can't restrict columns, so column privileges do that part:
-- clients may read every column and update only username and display_name.
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant update (username, display_name) on table public.profiles to authenticated;

create policy "Profiles are readable by everyone"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A username is set once. Renames come in a later spec, with redirects.
create function public.profiles_username_set_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'A username cannot be changed once it is set.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_username_set_once()
  from public, anon, authenticated;

create trigger profiles_username_set_once
  before update on public.profiles
  for each row
  execute function public.profiles_username_set_once();

-- Creates the profile when an auth user is created. It must never fail, so the
-- display name from provider metadata (or whatever a sign-up sends in
-- options.data) is trimmed, cut to 50 characters and emptied to null first.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_name text := coalesce(
    nullif(regexp_replace(new.raw_user_meta_data ->> 'full_name', '^\s+|\s+$', '', 'g'), ''),
    nullif(regexp_replace(new.raw_user_meta_data ->> 'name', '^\s+|\s+$', '', 'g'), '')
  );
  clean_name text := nullif(regexp_replace(left(raw_name, 50), '\s+$', ''), '');
begin
  insert into public.profiles (id, display_name)
  values (new.id, clean_name);
  return new;
end;
$$;

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
