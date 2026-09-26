-- Generation 2026 security hardening migration
-- IMPORTANT: run after Supabase Auth is enabled and an admin user exists.
-- Replace the UUID below with the admin user's auth.users.id.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on public.admin_users from anon, authenticated;

grant select on public.admin_users to authenticated;

drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Public pages expose only safe participant fields through a dedicated view.
-- Payment numbers, payment receipt, and other private fields are excluded.
drop view if exists public.public_page_participants;
create view public.public_page_participants
as
select
  pg.page_number,
  pg.status as page_status,
  p.id,
  p.name,
  p.city,
  p.image_url,
  p.instagram_username,
  p.facebook_url,
  p.tiktok_url,
  p.whatsapp,
  p.future_vision_choice,
  p.prediction_era,
  p.future_vision,
  p.future_message
from public.pages pg
left join public.participants p on pg.participant_id = p.id
where pg.status in ('pending', 'reserved');

-- Only approved participants are visible through the public view.
-- The view deliberately omits payment fields and is read-only.
-- The Frontend must query this view instead of participants directly.

grant select on public.public_page_participants to anon, authenticated;

-- Keep public page state readable. Do not expose bookings publicly.
drop policy if exists public_read_pages on public.pages;
create policy public_read_pages
on public.pages
for select
to anon, authenticated
using (true);

drop policy if exists public_read_approved_participants on public.participants;
create policy public_read_approved_participants
on public.participants
for select
to authenticated
using (public.is_admin());

-- No direct table writes or booking reads from the public client.
revoke select, insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.pages from anon, authenticated;
revoke insert, update, delete on public.participants from anon, authenticated;

-- RLS policies filter authenticated users; grants allow the policy check to run.
grant select on public.bookings to authenticated;
grant select on public.participants to authenticated;

-- The public client may create a booking only through the atomic function.
revoke all on function public.reserve_page(integer, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.reserve_page(integer, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text) to anon, authenticated;

-- Administrative mutations are Auth/Admin-only. The anon role cannot call them.
revoke all on function public.approve_booking(uuid) from public, anon, authenticated;
grant execute on function public.approve_booking(uuid) to authenticated;

revoke all on function public.delete_booking(uuid) from public, anon, authenticated;
grant execute on function public.delete_booking(uuid) to authenticated;

revoke all on function public.delete_page_admin(integer) from public, anon, authenticated;
grant execute on function public.delete_page_admin(integer) to authenticated;

-- Defense in depth: functions must reject non-admin authenticated users.
create or replace function public.approve_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_booking public.bookings;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  update public.bookings
  set status = 'approved'
  where id = p_booking_id and status in ('pending', 'contacted')
  returning * into approved_booking;

  if approved_booking.id is null then
    raise exception 'BOOKING_NOT_APPROVABLE' using errcode = 'P0001';
  end if;

  update public.pages
  set status = 'reserved', approved_at = now(), participant_id = approved_booking.participant_id
  where page_number = approved_booking.page_number;

  return approved_booking;
end;
$$;

create or replace function public.delete_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_page_number integer;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select page_number into booking_page_number
  from public.bookings
  where id = p_booking_id
  for update;

  if booking_page_number is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.pages
  set status = 'available', participant_id = null, reserved_at = null, approved_at = null
  where page_number = booking_page_number;

  delete from public.bookings where id = p_booking_id;
end;
$$;

create or replace function public.delete_page_admin(target_page_number integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if target_page_number not between 1 and 1000 then
    raise exception 'PAGE_OUT_OF_RANGE' using errcode = '22023';
  end if;

  delete from public.bookings
  where page_number = target_page_number;

  delete from public.page_votes
  where page_number = target_page_number;

  delete from public.pages
  where page_number = target_page_number;
end;
$$;

revoke all on function public.approve_booking(uuid) from public, anon;
grant execute on function public.approve_booking(uuid) to authenticated;
revoke all on function public.delete_booking(uuid) from public, anon;
grant execute on function public.delete_booking(uuid) to authenticated;
revoke all on function public.delete_page_admin(integer) from public, anon;
grant execute on function public.delete_page_admin(integer) to authenticated;

-- Admin-only booking access.
drop policy if exists admin_read_bookings on public.bookings;
create policy admin_read_bookings
on public.bookings
for select
to authenticated
using (public.is_admin());

-- Admin-only access to all participant fields, including payment fields.
drop policy if exists admin_read_participants on public.participants;
create policy admin_read_participants
on public.participants
for select
to authenticated
using (public.is_admin());

commit;

insert into public.admin_users (user_id)
values ('952b0411-c291-44d7-97f7-4560b76d3610')
on conflict (user_id) do nothing;
