-- Vendor master data plan for Supabase.
-- Run this in Supabase SQL Editor before using the Vendors screen.

create table if not exists public.vendors (
  "Vendor Name" text primary key,
  "Vendor Contact Number" text not null,
  "Email" text,
  "Vendor Address" text,
  "GSTIN" text,
  "PAN" text,
  "Created Date" date default current_date
);

create index if not exists vendors_contact_number_idx
  on public.vendors ("Vendor Contact Number");

create index if not exists vendors_gstin_idx
  on public.vendors ("GSTIN");

create index if not exists vendors_pan_idx
  on public.vendors ("PAN");

-- The Vendors screen no longer collects PAN; the column above is left in
-- place (unused) rather than dropped, so no existing data is lost.
-- Run this block once to add the City and Category fields the form now has:
alter table public.vendors
  add column if not exists "City" text;

alter table public.vendors
  add column if not exists "Category" text;

create index if not exists vendors_category_idx
  on public.vendors ("Category");

-- Run this block once to add the POC (point of contact) name the form now has:
alter table public.vendors
  add column if not exists "POC Name" text;

-- Run this block once to add the Sub-Category the form now has. Category and
-- Sub-Category are free text (the form offers presets plus a Custom option),
-- so no check constraint or enum here on purpose.
alter table public.vendors
  add column if not exists "Sub-Category" text;

create index if not exists vendors_sub_category_idx
  on public.vendors ("Sub-Category");

-- Current app tables continue storing the selected vendor name/contact in
-- items and purchase_requests. For stricter reporting later, add a vendor key
-- column to those tables and backfill it from the selected vendor name:
--
-- alter table public.items
--   add column if not exists vendor_name text references public.vendors ("Vendor Name");
--
-- alter table public.purchase_requests
--   add column if not exists vendor_name text references public.vendors ("Vendor Name");
