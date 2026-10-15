-- Inventory-only employee management. Run this entire file in Supabase SQL Editor.
-- Transactional and rerunnable: never updates/deletes public.employees, never
-- overwrites an inventory employee, and never overwrites an existing assignment.
-- Full original rows are retained in source_record; legacy assignment JSON is
-- retained too. Back up employees and employee_assets before applying.
begin;

create table if not exists public.inventory_employees (
  employee_id text primary key,
  name text not null default '',
  department text not null default '',
  role text not null default '',
  join_date text not null default '',
  email text not null default '',
  phone text not null default '',
  manager text not null default '',
  location text not null default '',
  legacy_assets jsonb not null default '[]'::jsonb,
  source_record jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_employee_id_nonempty check (btrim(employee_id) <> '')
);
alter table public.inventory_employees enable row level security;
revoke all on public.inventory_employees from anon, authenticated;
grant select, insert, update on public.inventory_employees to service_role;

create table if not exists public.employee_assets (
  id text primary key, employee_id text not null, item_id text, item_name text,
  serial_no text, assigned_date date, returned_date date,
  status text not null default 'Active', notes text,
  created_at timestamptz not null default now()
);
alter table public.employee_assets enable row level security;
grant select, insert, update on public.employee_assets to service_role;
create index if not exists employee_assets_employee_id_idx on public.employee_assets (employee_id);
create index if not exists employee_assets_item_id_idx on public.employee_assets (item_id);

-- Temporary helpers exist only in this SQL session. Date parsing catches invalid
-- calendar dates as well as invalid formats; the unmodified value remains in JSON.
create or replace function pg_temp.inventory_text(doc jsonb, variadic keys text[])
returns text language plpgsql as $$
declare k text; v jsonb;
begin
  foreach k in array keys loop
    v := doc -> k;
    if jsonb_typeof(v) in ('string', 'number', 'boolean') and doc ->> k <> '' then
      return doc ->> k;
    end if;
  end loop;
  return '';
end $$;

create or replace function pg_temp.inventory_date(value text)
returns date language plpgsql as $$
begin
  if value ~ '^\d{4}-\d{2}-\d{2}$' then return value::date; end if;
  return null;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;

-- Lock only against concurrent source writes during this snapshot. No source DML.
lock table public.employees in share mode;
lock table public.employee_assets in share row exclusive mode;
create temporary table inventory_employee_copy on commit drop as
select
  coalesce(nullif(pg_temp.inventory_text(j, 'employee_id', 'emp_id', 'employeeId', 'employee_code', 'emp_code'), ''),
           nullif(pg_temp.inventory_text(j, 'id'), '')) as employee_id,
  pg_temp.inventory_text(j, 'name', 'full_name', 'employee_name', 'fullName', 'display_name') as name,
  pg_temp.inventory_text(j, 'department', 'dept', 'department_name') as department,
  pg_temp.inventory_text(j, 'title', 'role', 'designation', 'job_title', 'position') as role,
  pg_temp.inventory_text(j, 'date_of_hiring', 'joining_date', 'join_date', 'hire_date', 'date_of_joining', 'doj') as join_date,
  pg_temp.inventory_text(j, 'email', 'work_email', 'official_email', 'email_id') as email,
  coalesce(nullif(pg_temp.inventory_text(j, 'phone', 'mobile', 'contact_number', 'phone_number'), ''),
           pg_temp.inventory_text(j -> 'onboard', 'phone', 'mobile', 'contact_number')) as phone,
  pg_temp.inventory_text(j, 'manager', 'reporting_to', 'reports_to') as manager,
  pg_temp.inventory_text(j, 'location', 'office', 'work_location') as location,
  case when jsonb_typeof(coalesce(nullif(j->'asset_assignments', 'null'::jsonb), nullif(j->'assets', 'null'::jsonb), j->'assigned_assets')) = 'array'
       then coalesce(nullif(j->'asset_assignments', 'null'::jsonb), nullif(j->'assets', 'null'::jsonb), j->'assigned_assets')
       else '[]'::jsonb end as legacy_assets,
  j as source_record
from (select to_jsonb(e) as j from public.employees e) source;

do $$ begin
  if exists (select 1 from inventory_employee_copy where employee_id is null or btrim(employee_id) = '') then
    raise exception 'Employee missing an ID: migration cancelled, source data unchanged';
  end if;
  if exists (select employee_id from inventory_employee_copy group by employee_id having count(*) > 1) then
    raise exception 'Duplicate employee IDs: migration cancelled, source data unchanged';
  end if;
end $$;

insert into public.inventory_employees
  (employee_id, name, department, role, join_date, email, phone, manager, location, legacy_assets, source_record)
select employee_id, name, department, role, join_date, email, phone, manager, location, legacy_assets, source_record
from inventory_employee_copy
on conflict (employee_id) do nothing;

create temporary table inventory_assignment_copy on commit drop as
select coalesce(nullif(a->>'id', ''), 'EA-LEGACY-' || e.employee_id || '-' || ord) as id,
  e.employee_id,
  coalesce(a->>'itemId', a->>'item_id', '') as item_id,
  coalesce(a->>'itemName', a->>'item_name', '') as item_name,
  coalesce(a->>'serialNo', a->>'serial_no', '') as serial_no,
  pg_temp.inventory_date(coalesce(a->>'assignedDate', a->>'assigned_date')) as assigned_date,
  pg_temp.inventory_date(coalesce(a->>'returnedDate', a->>'returned_date')) as returned_date,
  coalesce(nullif(a->>'status', ''), 'Active') as status,
  coalesce(a->>'notes', '') as notes
from public.inventory_employees e
cross join lateral jsonb_array_elements(e.legacy_assets) with ordinality as t(a, ord);

do $$ begin
  if exists (select id from inventory_assignment_copy group by id having count(*) > 1) then
    raise exception 'Duplicate legacy assignment IDs: migration cancelled, source data unchanged';
  end if;
  if exists (select 1 from inventory_assignment_copy c join public.employee_assets a using (id)
             where c.employee_id <> a.employee_id) then
    raise exception 'Assignment ID belongs to a different employee: migration cancelled';
  end if;
end $$;

insert into public.employee_assets
  (id, employee_id, item_id, item_name, serial_no, assigned_date, returned_date, status, notes)
select id, employee_id, item_id, item_name, serial_no, assigned_date, returned_date, status, notes
from inventory_assignment_copy on conflict (id) do nothing;

-- Database guards protect archive/assign races, permanent deletion, and ID links.
create or replace function public.inventory_employee_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Employees must be archived, not permanently deleted';
  end if;
  if new.employee_id is distinct from old.employee_id then
    raise exception 'Employee ID cannot be changed';
  end if;
  if new.archived_at is not null and old.archived_at is null and exists (
    select 1 from public.employee_assets where employee_id = old.employee_id and status = 'Active'
  ) then
    raise exception 'Return all active assets before deleting this employee';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists inventory_employee_guard on public.inventory_employees;
create trigger inventory_employee_guard before update or delete on public.inventory_employees
for each row execute function public.inventory_employee_guard();

create or replace function public.inventory_assignment_employee_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare archived timestamptz;
begin
  -- Historical assignments are left intact; only new/re-activated assets need an active employee.
  if new.status = 'Active' then
    select archived_at into archived from public.inventory_employees
      where employee_id = new.employee_id for update;
    if not found then raise exception 'Inventory employee not found'; end if;
    if archived is not null then raise exception 'Restore this employee before assigning assets'; end if;
  end if;
  return new;
end $$;
drop trigger if exists inventory_assignment_employee_guard on public.employee_assets;
create trigger inventory_assignment_employee_guard before insert or update on public.employee_assets
for each row execute function public.inventory_assignment_employee_guard();

do $$ begin
  if exists (select 1 from inventory_employee_copy c left join public.inventory_employees e using (employee_id)
             where e.employee_id is null) then raise exception 'Employee copy verification failed'; end if;
  if exists (select 1 from inventory_assignment_copy c left join public.employee_assets a using (id)
             where a.id is null) then raise exception 'Assignment copy verification failed'; end if;
end $$;
commit;

-- Compare these counts with your backup. Extra inventory-created employees are expected on reruns.
select (select count(*) from public.employees) as original_employees,
       (select count(*) from public.inventory_employees) as inventory_employees,
       (select count(*) from public.employee_assets) as assignments;
