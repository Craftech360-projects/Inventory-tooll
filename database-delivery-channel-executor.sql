alter table public.delivery_channels
add column if not exists "Event Executor" text;
