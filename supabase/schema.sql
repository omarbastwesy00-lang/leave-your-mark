-- Generation 2026 database schema for Supabase/Postgres
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.page_status as enum ('available', 'pending', 'reserved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum ('pending', 'contacted', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.pages (
  page_number integer primary key check (page_number between 1 and 1000),
  status public.page_status not null default 'available',
  participant_id uuid,
  reserved_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  city text not null default '',
  image_url text,
  instagram_username text not null default '',
  facebook_url text not null default '',
  tiktok_url text not null default '',
  whatsapp text not null,
  future_vision_choice text not null default '',
  prediction_era text not null default 'next' check (prediction_era in ('next', 'beforeTechnology')),
  future_vision text not null,
  future_message text,
  payment_sender text not null default '',
  payment_recipient text not null default '',
  payment_receipt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.participants add column if not exists future_vision_choice text not null default '';
alter table public.participants add column if not exists payment_sender text not null default '';
alter table public.participants add column if not exists payment_recipient text not null default '';
alter table public.participants add column if not exists payment_receipt text;
alter table public.participants add column if not exists prediction_era text not null default 'next';
alter table public.participants add column if not exists facebook_url text not null default '';
alter table public.participants add column if not exists tiktok_url text not null default '';
update public.participants set city = 'كفر الشيخ' where city is distinct from 'كفر الشيخ';
alter table public.participants alter column city set default 'كفر الشيخ';
alter table public.participants drop constraint if exists participants_city_kafr_sheikh_check;
alter table public.participants add constraint participants_city_kafr_sheikh_check check (city = 'كفر الشيخ');

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  page_number integer not null references public.pages(page_number),
  participant_id uuid not null references public.participants(id) on delete cascade,
  status public.booking_status not null default 'pending',
  page_price integer not null default 0 check (page_price >= 0),
  payment_reference text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings add column if not exists page_price integer not null default 0;

create table if not exists public.page_votes (
  page_number integer primary key references public.pages(page_number) on delete cascade,
  agree_count integer not null default 0 check (agree_count >= 0),
  disagree_count integer not null default 0 check (disagree_count >= 0),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter publication supabase_realtime add table public.page_votes;
exception when duplicate_object then null;
end $$;

create or replace function public.cast_page_vote(p_page_number integer, p_choice text)
returns table (page_number integer, agree_count integer, disagree_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_page_number not between 1 and 1000 or p_choice not in ('agree', 'disagree') then
    raise exception 'INVALID_VOTE' using errcode = '22023';
  end if;

  insert into public.page_votes (page_number, agree_count, disagree_count)
  values (p_page_number, case when p_choice = 'agree' then 1 else 0 end, case when p_choice = 'disagree' then 1 else 0 end)
  on conflict (page_number) do update
  set agree_count = page_votes.agree_count + case when p_choice = 'agree' then 1 else 0 end,
      disagree_count = page_votes.disagree_count + case when p_choice = 'disagree' then 1 else 0 end,
      updated_at = now();

  return query select page_votes.page_number, page_votes.agree_count, page_votes.disagree_count
  from public.page_votes where page_votes.page_number = p_page_number;
end;
$$;

alter table public.pages
  drop constraint if exists pages_participant_id_fkey;

alter table public.pages
  add constraint pages_participant_id_fkey
  foreign key (participant_id) references public.participants(id) on delete set null;

create unique index if not exists one_active_booking_per_page
  on public.bookings(page_number)
  where status in ('pending', 'contacted', 'approved');

create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_participant_idx on public.bookings(participant_id);

do $$ begin
  alter publication supabase_realtime add table public.pages;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null;
end $$;

insert into public.pages (page_number)
select page_number
from generate_series(1, 1000) as page_number
on conflict (page_number) do nothing;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pages_touch_updated_at on public.pages;
create trigger pages_touch_updated_at
before update on public.pages
for each row execute function public.touch_updated_at();

drop trigger if exists participants_touch_updated_at on public.participants;
create trigger participants_touch_updated_at
before update on public.participants
for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

-- Atomic reservation: the page row is locked before checking availability.
-- Concurrent requests for the same page serialize; only one can reserve it.
drop function if exists public.reserve_page(integer, text, text, text, text, text, text, text);
drop function if exists public.reserve_page(integer, text, text, text, text, text, text, text, text, text, text, text);
drop function if exists public.reserve_page(integer, text, text, text, text, text, text, text, text, text, text, text, text, integer);
drop function if exists public.reserve_page(integer, text, text, text, text, text, text, text, text, text, text, text, text, integer, text);
drop function if exists public.reserve_page(integer, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text);
create or replace function public.reserve_page(
  p_page_number integer,
  p_name text,
  p_city text,
  p_instagram_username text,
  p_whatsapp text,
  p_future_vision text,
  p_future_message text default null,
  p_image_url text default null,
  p_future_vision_choice text default '',
  p_payment_sender text default '',
  p_payment_recipient text default '',
  p_payment_receipt text default null,
  p_prediction_era text default 'next',
  p_page_price integer default 0,
  p_facebook_url text default '',
  p_tiktok_url text default ''
)
returns table (booking_id uuid, page_number integer, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_page public.pages%rowtype;
  new_participant_id uuid;
  new_booking_id uuid;
begin
  if p_page_number not between 1 and 1000 then
    raise exception 'PAGE_OUT_OF_RANGE' using errcode = '22023';
  end if;

  if coalesce(p_page_price, 0) < 0 then
    raise exception 'INVALID_PAGE_PRICE' using errcode = '22023';
  end if;

    if nullif(trim(coalesce(p_payment_sender, '')), '') is null
      or nullif(trim(coalesce(p_payment_recipient, '')), '') is null then
    raise exception 'PAYMENT_DETAILS_REQUIRED' using errcode = '22023';
  end if;

  select * into locked_page
  from public.pages
  where public.pages.page_number = p_page_number
  for update;

  if locked_page.status <> 'available' then
    raise exception 'PAGE_NOT_AVAILABLE' using errcode = '23505';
  end if;

  insert into public.participants (name, city, image_url, instagram_username, facebook_url, tiktok_url, whatsapp, future_vision_choice, future_vision, future_message, payment_sender, payment_recipient, payment_receipt, prediction_era)
  values (trim(p_name), 'كفر الشيخ', trim(coalesce(p_image_url, '')), trim(coalesce(p_instagram_username, '')), trim(coalesce(p_facebook_url, '')), trim(coalesce(p_tiktok_url, '')), trim(p_whatsapp), trim(coalesce(p_future_vision_choice, '')), trim(p_future_vision), nullif(trim(coalesce(p_future_message, '')), ''), trim(coalesce(p_payment_sender, '')), trim(coalesce(p_payment_recipient, '')), p_payment_receipt, case when p_prediction_era in ('next', 'beforeTechnology') then p_prediction_era else 'next' end)
  returning id into new_participant_id;

  insert into public.bookings (page_number, participant_id, status, page_price)
  values (p_page_number, new_participant_id, 'pending', coalesce(p_page_price, 0))
  returning id into new_booking_id;

  update public.pages
  set status = 'pending', participant_id = new_participant_id, reserved_at = now()
  where pages.page_number = p_page_number;

  return query select new_booking_id, p_page_number, new_participant_id;
end;
$$;

-- Admin-only approval operation. Keep the service role or authenticated admin
-- policy around this function when the admin login is moved to Supabase Auth.
create or replace function public.approve_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_booking public.bookings;
begin
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

alter table public.pages enable row level security;
alter table public.participants enable row level security;
alter table public.bookings enable row level security;
alter table public.page_votes enable row level security;

-- Public users can read the page state and approved page participants.
drop policy if exists public_read_pages on public.pages;
create policy public_read_pages on public.pages for select using (true);

drop policy if exists public_read_approved_participants on public.participants;
create policy public_read_approved_participants on public.participants for select using (
  exists (
    select 1 from public.pages
    where pages.participant_id = participants.id
      and pages.status = 'reserved'
  )
);

-- The current admin screen uses the public anon client and its client-side password.
-- Expose booking management only until Supabase Auth/RLS replaces that password flow.
drop policy if exists admin_read_bookings on public.bookings;
create policy admin_read_bookings on public.bookings for select using (true);

drop policy if exists admin_read_participants on public.participants;
create policy admin_read_participants on public.participants for select using (true);

drop policy if exists public_read_page_votes on public.page_votes;
create policy public_read_page_votes on public.page_votes for select using (true);

drop policy if exists admin_read_participants on public.participants;
create policy admin_read_participants on public.participants for select using (true);

-- Public booking uses reserve_page() only. No direct anonymous inserts/updates
-- are allowed, preventing clients from bypassing the atomic reservation.
revoke insert, update, delete on public.pages from anon, authenticated;
revoke insert, update, delete on public.participants from anon, authenticated;
revoke insert, update, delete on public.bookings from anon, authenticated;
grant select on public.pages to anon, authenticated;
grant select on public.participants to anon, authenticated;
grant select on public.bookings to anon, authenticated;
grant select on public.page_votes to anon, authenticated;
grant execute on function public.reserve_page(integer, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text) to anon, authenticated;
grant execute on function public.approve_booking(uuid) to anon, authenticated;
grant execute on function public.delete_booking(uuid) to anon, authenticated;
grant execute on function public.cast_page_vote(integer, text) to anon, authenticated;
