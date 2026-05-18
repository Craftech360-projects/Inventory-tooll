-- Add Performa Invoice fields to purchase requests.
-- Run this in Supabase SQL Editor before creating PRs with PI details.

alter table public.purchase_requests
  add column if not exists "PI Number" text,
  add column if not exists "PI Date" date;

create index if not exists purchase_requests_pi_number_idx
  on public.purchase_requests ("PI Number");
