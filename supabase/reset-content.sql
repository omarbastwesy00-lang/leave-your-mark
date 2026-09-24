-- One-time cleanup for the existing Supabase project.
-- Run this in Supabase SQL Editor to remove old/demo content and reopen every page.
begin;

delete from public.bookings;
delete from public.participants;

update public.pages
set status = 'available',
    participant_id = null,
    reserved_at = null,
    approved_at = null,
    updated_at = now();

commit;
