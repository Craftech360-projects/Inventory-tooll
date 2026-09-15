-- Employee asset assignments plan for Supabase.
-- Run this in Supabase SQL Editor before deploying the matching app change.
--
-- Why: the employees table is shared with the HR tool, and a trigger there
-- rejects any non-HR change except extra_fields ("Only HR may change employee
-- fields other than extra_fields"). The inventory app used to write asset
-- assignments into employees.asset_assignments, so assigning/returning failed.
-- Assignments now live in a table this app owns. Nothing here alters the
-- employees table or its trigger; the old column is only read, never changed.
--
-- Safe to run more than once.

create table if not exists public.employee_assets (
  id text primary key,
  employee_id text not null,
  item_id text,
  item_name text,
  serial_no text,
  assigned_date date,
  returned_date date,
  status text not null default 'Active',
  notes text,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: the anon key (and so the browser) can't read or
-- write this table. The Netlify functions use SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS, so the app is unaffected. Only this table is changed.
alter table public.employee_assets enable row level security;

create index if not exists employee_assets_employee_id_idx
  on public.employee_assets (employee_id);

create index if not exists employee_assets_item_id_idx
  on public.employee_assets (item_id);

-- One-time copy of existing assignments out of employees.asset_assignments.
-- Skipped entirely if that column doesn't exist in this deployment. Rows
-- already copied are left alone (on conflict do nothing), and dates that
-- aren't YYYY-MM-DD are stored as null instead of aborting the copy.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'asset_assignments'
  ) then
    insert into public.employee_assets
      (id, employee_id, item_id, item_name, serial_no, assigned_date, returned_date, status, notes)
    select
      coalesce(nullif(a->>'id', ''), 'EA-LEGACY-' || e.employee_id || '-' || ord),
      e.employee_id,
      coalesce(a->>'itemId', a->>'item_id', ''),
      coalesce(a->>'itemName', a->>'item_name', ''),
      coalesce(a->>'serialNo', a->>'serial_no', ''),
      case when coalesce(a->>'assignedDate', a->>'assigned_date') ~ '^\d{4}-\d{2}-\d{2}$'
           then coalesce(a->>'assignedDate', a->>'assigned_date')::date end,
      case when coalesce(a->>'returnedDate', a->>'returned_date') ~ '^\d{4}-\d{2}-\d{2}$'
           then coalesce(a->>'returnedDate', a->>'returned_date')::date end,
      coalesce(nullif(a->>'status', ''), 'Active'),
      coalesce(a->>'notes', '')
    from public.employees e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(to_jsonb(e.asset_assignments)) = 'array'
           then to_jsonb(e.asset_assignments) else '[]'::jsonb end
    ) with ordinality as t(a, ord)
    where e.employee_id is not null
    on conflict (id) do nothing;
  end if;
end $$;

-- Check the copy:
-- select employee_id, count(*) from public.employee_assets group by employee_id;
