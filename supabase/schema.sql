create table if not exists rsvp (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('신랑측', '신부측')),
  attend text not null check (attend in ('참석', '미참석')),
  name text not null check (char_length(name) between 1 and 20),
  count int not null check (count between 1 and 20),
  meal text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

alter table rsvp add column if not exists phone text;

alter table rsvp drop constraint if exists rsvp_meal_check;
update rsvp set meal = '식사함' where meal = '식사';
alter table rsvp drop constraint if exists rsvp_meal_allowed;
alter table rsvp add constraint rsvp_meal_allowed check (meal in ('식사함', '식사안함', '미정'));

alter table rsvp drop constraint if exists rsvp_phone_format;
alter table rsvp add constraint rsvp_phone_format check (phone ~ '^[0-9-]{9,13}$');

alter table rsvp drop constraint if exists rsvp_phone_required_for_attendees;
alter table rsvp alter column phone set not null;

alter table rsvp enable row level security;

drop policy if exists rsvp_insert_only on rsvp;
create policy rsvp_insert_only on rsvp
  for insert to anon
  with check (now() < '2027-01-24T00:00:00+09:00');

create index if not exists rsvp_created_at_idx on rsvp (created_at desc);

create table if not exists admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

revoke execute on function is_admin() from anon, public;
grant execute on function is_admin() to authenticated;

drop policy if exists rsvp_admin_select on rsvp;
create policy rsvp_admin_select on rsvp
  for select to authenticated
  using (is_admin());

drop policy if exists rsvp_admin_delete on rsvp;
create policy rsvp_admin_delete on rsvp
  for delete to authenticated
  using (is_admin());

create extension if not exists pgcrypto with schema extensions;

create table if not exists guestbook (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  message text not null check (char_length(message) between 1 and 300),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists guestbook_created_at_idx on guestbook (created_at desc, id desc);

alter table guestbook enable row level security;

revoke all on guestbook from anon, authenticated;
grant select (id, name, message, created_at) on guestbook to anon, authenticated;

grant delete on guestbook to authenticated;

drop policy if exists guestbook_public_select on guestbook;
create policy guestbook_public_select on guestbook
  for select to anon, authenticated
  using (true);

create or replace function create_guestbook_entry(entry_name text, entry_message text, entry_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if char_length(entry_password) < 4 then
    raise exception '비밀번호는 4자 이상이어야 합니다' using errcode = '22023';
  end if;

  insert into guestbook (name, message, password_hash)
  values (entry_name, entry_message, crypt(entry_password, gen_salt('bf')))
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function delete_guestbook_entry(entry_id uuid, entry_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored text;
begin
  select password_hash into stored from guestbook where id = entry_id;

  if stored is null or stored <> crypt(entry_password, stored) then
    return false;
  end if;

  delete from guestbook where id = entry_id;
  return true;
end;
$$;

revoke execute on function create_guestbook_entry(text, text, text) from anon, public;
grant execute on function create_guestbook_entry(text, text, text) to anon, authenticated;

revoke execute on function delete_guestbook_entry(uuid, text) from anon, public;
grant execute on function delete_guestbook_entry(uuid, text) to anon, authenticated;

drop policy if exists guestbook_admin_delete on guestbook;
create policy guestbook_admin_delete on guestbook
  for delete to authenticated
  using (is_admin());
