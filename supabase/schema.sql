create extension if not exists pgcrypto with schema extensions;

create type public.room_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  occasion text,
  location text,
  date_label text,
  invite_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  cover_photo_id uuid,
  created_by uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.room_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null unique,
  thumbnail_storage_key text not null unique,
  original_file_name text not null,
  content_type text not null,
  thumbnail_content_type text not null default 'image/webp',
  file_size bigint not null check (file_size > 0),
  thumbnail_file_size bigint not null check (thumbnail_file_size > 0),
  width integer,
  height integer,
  thumbnail_width integer,
  thumbnail_height integer,
  caption text,
  created_at timestamptz not null default now()
);

alter table public.rooms
  add constraint rooms_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.photos(id) on delete set null;

create table public.photo_favorites (
  photo_id uuid not null references public.photos(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

create table public.photobook_drafts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  cover_photo_id uuid references public.photos(id) on delete set null,
  cover_title text not null default 'ClaY. by tharun',
  cover_subtitle text,
  cover_font text not null default 'editorial-serif'
    check (cover_font in ('editorial-serif', 'modern-sans', 'minimal-light', 'cinematic-condensed', 'soft-script')),
  cover_text_color text not null default 'ivory'
    check (cover_text_color in ('ivory', 'ink', 'clay', 'sage', 'rose')),
  cover_text_position text not null default 'bottom-center'
    check (cover_text_position in ('top-left', 'top-center', 'center', 'bottom-left', 'bottom-center')),
  cover_overlay_style text not null default 'soft'
    check (cover_overlay_style in ('none', 'soft', 'deep', 'film')),
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id)
);

create table public.photobook_pages (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.photobook_drafts(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  page_number integer not null check (page_number >= 3),
  page_type text not null default 'photo' check (page_type in ('photo')),
  layout_type text not null check (layout_type in ('single', 'split', 'trio', 'grid')),
  photo_ids uuid[] not null default '{}',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, page_number)
);

create table public.photobook_draft_photos (
  draft_id uuid not null references public.photobook_drafts(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  position integer not null,
  primary key (draft_id, photo_id),
  unique (draft_id, position)
);

alter table public.photobook_drafts
  drop constraint if exists photobook_drafts_cover_text_color_check,
  add constraint photobook_drafts_cover_text_color_check
  check (
    cover_text_color in ('ivory', 'ink', 'clay', 'sage', 'rose')
    or cover_text_color ~ '^#[0-9A-Fa-f]{6}$'
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      new.email
    ),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = case
          when public.profiles.display_name is null
            or btrim(public.profiles.display_name) = ''
            or public.profiles.display_name = public.profiles.email
            or public.profiles.display_name ~* '^\S+@\S+\.\S+$'
          then excluded.display_name
          else public.profiles.display_name
        end;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.ensure_current_user_profile()
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  current_email text;
  current_name text;
begin
  if auth.uid() is null then
    return false;
  end if;

  current_email := auth.jwt() ->> 'email';
  current_name := coalesce(
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'display_name'), ''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(split_part(current_email, '@', 1), ''),
    current_email,
    'ClaY member'
  );

  insert into public.profiles (id, display_name, email)
  values (auth.uid(), current_name, current_email)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        display_name = case
          when public.profiles.display_name is null
            or btrim(public.profiles.display_name) = ''
            or public.profiles.display_name = public.profiles.email
            or public.profiles.display_name ~* '^\S+@\S+\.\S+$'
          then excluded.display_name
          else public.profiles.display_name
        end,
        updated_at = now();

  return exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
  );
end;
$$;

grant execute on function public.ensure_current_user_profile() to authenticated;

create or replace function public.create_room_for_current_user(
  room_name text,
  room_occasion text default null,
  room_location text default null,
  room_date_label text default null,
  room_invite_token text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  new_room_id uuid;
  safe_invite_token text;
begin
  if auth.uid() is null then
    raise exception 'create_room_for_current_user requires an authenticated user'
      using errcode = '28000';
  end if;

  if nullif(btrim(room_name), '') is null then
    raise exception 'Room name is required'
      using errcode = '23514';
  end if;

  perform public.ensure_current_user_profile();

  safe_invite_token := coalesce(
    nullif(room_invite_token, ''),
    encode(extensions.gen_random_bytes(8), 'hex')
  );

  insert into public.rooms (
    name,
    occasion,
    location,
    date_label,
    invite_token,
    created_by
  )
  values (
    btrim(room_name),
    nullif(btrim(room_occasion), ''),
    nullif(btrim(room_location), ''),
    nullif(btrim(room_date_label), ''),
    safe_invite_token,
    auth.uid()
  )
  returning id into new_room_id;

  insert into public.room_members (room_id, user_id, role)
  values (new_room_id, auth.uid(), 'owner')
  on conflict (room_id, user_id) do update
    set role = 'owner';

  return new_room_id;
end;
$$;

grant execute on function public.create_room_for_current_user(text, text, text, text, text) to authenticated;

create or replace function public.add_room_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (room_id, user_id) do nothing;

  return new;
end;
$$;

create trigger on_room_created
  after insert on public.rooms
  for each row execute procedure public.add_room_owner();

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_members
    join public.rooms on rooms.id = room_members.room_id
    where room_members.room_id = target_room_id
      and room_members.user_id = auth.uid()
      and rooms.deleted_at is null
  );
$$;

create or replace function public.is_room_owner(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.rooms
    where rooms.id = target_room_id
      and rooms.created_by = auth.uid()
      and rooms.deleted_at is null
  );
$$;

create or replace function public.can_edit_photobook(target_draft_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.photobook_drafts
    join public.rooms on rooms.id = photobook_drafts.room_id
    where photobook_drafts.id = target_draft_id
      and (
        photobook_drafts.created_by = auth.uid()
        or rooms.created_by = auth.uid()
      )
  );
$$;

create view public.room_members_with_profiles
with (security_invoker = true) as
select
  room_members.id,
  room_members.room_id,
  room_members.user_id,
  room_members.role,
  room_members.joined_at,
  profiles.display_name,
  profiles.email,
  profiles.avatar_url,
  count(photos.id)::integer as photo_count,
  (
    array_agg(photos.thumbnail_storage_key order by photos.created_at desc)
    filter (where photos.thumbnail_storage_key is not null)
  )[1] as latest_thumbnail_storage_key
from public.room_members
left join public.profiles on profiles.id = room_members.user_id
left join public.photos
  on photos.room_id = room_members.room_id
  and photos.uploader_id = room_members.user_id
group by
  room_members.id,
  room_members.room_id,
  room_members.user_id,
  room_members.role,
  room_members.joined_at,
  profiles.display_name,
  profiles.email,
  profiles.avatar_url;

create view public.room_summaries
with (security_invoker = true) as
select
  rooms.id,
  rooms.name,
  rooms.occasion,
  rooms.location,
  rooms.date_label,
  rooms.invite_token,
  rooms.cover_photo_id,
  cover_photo.storage_key as cover_photo_storage_key,
  rooms.created_at,
  room_members.user_id,
  room_members.role,
  count(distinct all_members.id)::integer as member_count,
  count(distinct photos.id)::integer as photo_count
from public.rooms
join public.room_members on room_members.room_id = rooms.id
left join public.room_members all_members on all_members.room_id = rooms.id
left join public.photos on photos.room_id = rooms.id
left join public.photos cover_photo on cover_photo.id = rooms.cover_photo_id
where rooms.deleted_at is null
group by rooms.id, cover_photo.storage_key, room_members.user_id, room_members.role;

create view public.room_photos_with_uploaders
with (security_invoker = true) as
select
  photos.id,
  photos.room_id,
  photos.uploader_id,
  photos.storage_key,
  photos.thumbnail_storage_key,
  photos.original_file_name,
  photos.content_type,
  photos.thumbnail_content_type,
  photos.file_size,
  photos.thumbnail_file_size,
  photos.width,
  photos.height,
  photos.thumbnail_width,
  photos.thumbnail_height,
  photos.caption,
  photos.created_at,
  profiles.display_name as uploader_display_name,
  profiles.email as uploader_email,
  count(photo_favorites.user_id)::integer as favorite_count,
  exists (
    select 1
    from public.photo_favorites current_user_favorites
    where current_user_favorites.photo_id = photos.id
      and current_user_favorites.user_id = auth.uid()
  ) as is_favorited
from public.photos
left join public.profiles on profiles.id = photos.uploader_id
left join public.photo_favorites on photo_favorites.photo_id = photos.id
group by photos.id, profiles.display_name, profiles.email;

grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update on table public.rooms to authenticated;
grant select, insert, update on table public.room_members to authenticated;
grant select, insert on table public.photos to authenticated;
grant select, insert, delete on table public.photo_favorites to authenticated;
grant select on table public.room_members_with_profiles to authenticated;
grant select on table public.room_photos_with_uploaders to authenticated;
grant select on table public.room_summaries to authenticated;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.photos enable row level security;
alter table public.photo_favorites enable row level security;
alter table public.photobook_drafts enable row level security;
alter table public.photobook_pages enable row level security;
alter table public.photobook_draft_photos enable row level security;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Members can read their rooms"
  on public.rooms for select
  to authenticated
  using (public.is_room_member(id));

create policy "Authenticated users can create rooms"
  on public.rooms for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Owners can update rooms"
  on public.rooms for update
  to authenticated
  using (public.is_room_owner(id))
  with check (
    public.is_room_owner(id)
    and (
      cover_photo_id is null
      or exists (
        select 1 from public.photos
        where photos.id = rooms.cover_photo_id
          and photos.room_id = rooms.id
      )
    )
  );

create policy "Room members can read memberships"
  on public.room_members for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "Room creators can add themselves as owner"
  on public.room_members for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and role = 'owner'
    and exists (
      select 1 from public.rooms
      where rooms.id = room_members.room_id
        and rooms.created_by = auth.uid()
    )
  );

create policy "Room members can view photos"
  on public.photos for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "Room members can upload photos"
  on public.photos for insert
  to authenticated
  with check (
    auth.uid() = uploader_id
    and public.is_room_member(room_id)
  );

create policy "Room members can view photo favorites"
  on public.photo_favorites for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "Room members can favorite photos"
  on public.photo_favorites for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_room_member(room_id)
    and exists (
      select 1 from public.photos
      where photos.id = photo_favorites.photo_id
        and photos.room_id = photo_favorites.room_id
    )
  );

create policy "Users can remove their own favorites"
  on public.photo_favorites for delete
  to authenticated
  using (
    auth.uid() = user_id
    and public.is_room_member(room_id)
  );

create policy "Room members can view photobook drafts"
  on public.photobook_drafts for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "Room members can create photobook drafts"
  on public.photobook_drafts for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and public.is_room_member(room_id)
  );

create policy "Only host can update photobook cover settings"
  on public.photobook_drafts for update
  to authenticated
  using (public.is_room_owner(room_id))
  with check (
    public.is_room_owner(room_id)
    and (
      cover_photo_id is null
      or exists (
        select 1 from public.photos
        where photos.id = photobook_drafts.cover_photo_id
          and photos.room_id = photobook_drafts.room_id
      )
    )
  );

create policy "Room members can view photobook pages"
  on public.photobook_pages for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "Host or creator can create photobook pages"
  on public.photobook_pages for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and public.can_edit_photobook(draft_id)
    and public.is_room_member(room_id)
  );

create policy "Host or creator can update photobook pages"
  on public.photobook_pages for update
  to authenticated
  using (public.can_edit_photobook(draft_id))
  with check (
    public.can_edit_photobook(draft_id)
    and public.is_room_member(room_id)
  );

create or replace function public.get_invite_preview(token text)
returns table (
  name text,
  occasion text,
  location text,
  date_label text
)
language sql
security definer
set search_path = public
as $$
  select rooms.name, rooms.occasion, rooms.location, rooms.date_label
  from public.rooms
  where rooms.invite_token = token
    and rooms.deleted_at is null
  limit 1;
$$;

drop function if exists public.join_room_by_invite(text);

create or replace function public.join_room_by_invite(
  invite_code text,
  display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  safe_display_name text;
begin
  if auth.uid() is null then
    raise exception 'join_room_by_invite requires an authenticated user'
      using errcode = '28000';
  end if;

  if nullif(btrim(invite_code), '') is null then
    raise exception 'Invite code is required'
      using errcode = '22023';
  end if;

  select id into target_room_id
  from public.rooms
  where invite_token = btrim(invite_code)
    and deleted_at is null;

  if target_room_id is null then
    raise exception 'Invite not found'
      using errcode = 'P0002';
  end if;

  perform public.ensure_current_user_profile();

  safe_display_name := nullif(btrim(display_name), '');

  if safe_display_name is not null
    and safe_display_name !~* '^\S+@\S+\.\S+$'
  then
    update public.profiles
    set display_name = safe_display_name,
        updated_at = now()
    where id = auth.uid();
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (target_room_id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'room_id', target_room_id
  );
end;
$$;

create or replace function public.delete_photo_for_current_user(target_photo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  target_uploader_id uuid;
begin
  if auth.uid() is null then
    raise exception 'delete_photo_for_current_user requires an authenticated user'
      using errcode = '28000';
  end if;

  select photos.room_id, photos.uploader_id
    into target_room_id, target_uploader_id
  from public.photos
  join public.rooms on rooms.id = photos.room_id
  where photos.id = target_photo_id
    and rooms.deleted_at is null;

  if target_room_id is null then
    raise exception 'Photo not found'
      using errcode = 'P0002';
  end if;

  if target_uploader_id <> auth.uid()
    and not exists (
      select 1
      from public.rooms
      where rooms.id = target_room_id
        and rooms.created_by = auth.uid()
        and rooms.deleted_at is null
    )
  then
    raise exception 'Only the uploader or room host can delete this photo.'
      using errcode = '42501';
  end if;

  update public.rooms
    set cover_photo_id = null
  where cover_photo_id = target_photo_id;

  update public.photobook_drafts
    set cover_photo_id = null,
        updated_at = now()
  where cover_photo_id = target_photo_id;

  update public.photobook_pages
    set photo_ids = array_remove(photo_ids, target_photo_id),
        updated_at = now()
  where target_photo_id = any(photo_ids);

  delete from public.photo_favorites
  where photo_id = target_photo_id;

  delete from public.photobook_draft_photos
  where photo_id = target_photo_id;

  delete from public.photos
  where id = target_photo_id;

  return true;
end;
$$;

create or replace function public.delete_room_for_current_user(target_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'delete_room_for_current_user requires an authenticated user'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.rooms
    where id = target_room_id
      and created_by = auth.uid()
  ) then
    raise exception 'Only the room host can delete this room, or the room is already deleted.'
      using errcode = '42501';
  end if;

  delete from public.photo_favorites
  where room_id = target_room_id
     or photo_id in (
       select id from public.photos where room_id = target_room_id
     );

  delete from public.photobook_draft_photos
  where draft_id in (
    select id from public.photobook_drafts where room_id = target_room_id
  )
     or photo_id in (
       select id from public.photos where room_id = target_room_id
     );

  delete from public.photobook_pages
  where room_id = target_room_id
     or draft_id in (
       select id from public.photobook_drafts where room_id = target_room_id
     );

  delete from public.photobook_drafts
  where room_id = target_room_id;

  delete from public.photos
  where room_id = target_room_id;

  delete from public.room_members
  where room_id = target_room_id;

  delete from public.rooms
  where id = target_room_id
    and created_by = auth.uid();

  return true;
end;
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.is_room_owner(uuid) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.join_room_by_invite(text, text) to authenticated;
grant execute on function public.delete_photo_for_current_user(uuid) to authenticated;
grant execute on function public.delete_room_for_current_user(uuid) to authenticated;
