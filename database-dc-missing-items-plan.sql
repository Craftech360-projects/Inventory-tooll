-- Partial returns / missing items on delivery channels.
-- Run this once in the Supabase SQL Editor.
--
-- Problem: check-in was all-or-nothing per line. Ticking "4 x Dell Laptop"
-- meant all 4 came back, so a DC where only 3 returned still closed and the
-- missing unit vanished from the system.
--
-- Fix: track how many units of each DC line have actually come back in a new
-- "Returned Qty" column. Missing = "Quantity" - "Returned Qty". A DC can only
-- reach Closed when every line is fully returned; until then it sits in
-- "Partially Returned" and is reported as missing.

alter table public.dc_items
  add column if not exists "Returned Qty" integer not null default 0;

-- Backfill: lines on DCs that were already closed under the old all-or-nothing
-- model were treated as fully returned.
update public.dc_items as di
  set "Returned Qty" = di."Quantity"
  from public.delivery_channels as dc
  where dc."DC Number" = di."DC Number"
    and dc."Status" = 'Closed'
    and di."Returned Qty" = 0;

-- Keep it sane if anything already has a stray value.
update public.dc_items
  set "Returned Qty" = greatest(0, least("Returned Qty", "Quantity"));
