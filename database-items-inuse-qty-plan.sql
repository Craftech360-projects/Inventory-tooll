-- Per-unit availability tracking for items.
-- Run this once in the Supabase SQL Editor.
--
-- Problem: the "items" table only stored one Status per row (Available /
-- In Use / ...), so checking out 1 of 2 units of an item flipped the whole
-- row to "In Use" and hid the other unit's availability.
--
-- Fix: track how many units of an item are currently checked out in a new
-- "In Use Qty" column. Available Qty is derived as Quantity - "In Use Qty".

alter table public.items
  add column if not exists "In Use Qty" integer not null default 0;

-- Backfill: items previously marked "In Use" had their entire quantity
-- treated as checked out under the old single-status model.
update public.items
  set "In Use Qty" = "Quantity"
  where "Status" = 'In Use' and "In Use Qty" = 0;

-- Keep it sane if anything already has a stray value.
update public.items
  set "In Use Qty" = greatest(0, least("In Use Qty", "Quantity"));
