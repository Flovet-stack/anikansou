-- Spec 03 follow-up: image links are checked against their source's prefix
-- when they are written. Changing a prefix afterwards would leave old links
-- unchecked, so refuse it while the source still has images.

create function catalog.image_sources_lock_prefix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.url_prefix is distinct from old.url_prefix
     and exists (select 1 from catalog.anime_images i where i.source_id = old.id)
  then
    raise exception
      'Source % still has images: remove or move them before changing url_prefix',
      old.slug;
  end if;
  return new;
end;
$$;

revoke execute on function catalog.image_sources_lock_prefix()
  from public, anon, authenticated;

create trigger image_sources_lock_prefix
  before update of url_prefix on catalog.image_sources
  for each row execute function catalog.image_sources_lock_prefix();
