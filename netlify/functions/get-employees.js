const { select, jsonResponse } = require('./supabase-client');

// The employees table is shared with HR tooling rather than created by this
// app, so its column names vary between deployments. Read each field through
// the names it is known by instead of pinning one spelling -- a mismatch here
// silently filters every row out and the screen just looks empty.
const FIELD_ALIASES = {
  empId: ['employee_id', 'emp_id', 'employeeId', 'employee_code', 'emp_code'],
  name: ['name', 'full_name', 'employee_name', 'fullName', 'display_name'],
  department: ['department', 'dept', 'department_name'],
  role: ['title', 'role', 'designation', 'job_title', 'position'],
  joinDate: ['date_of_hiring', 'joining_date', 'join_date', 'hire_date', 'date_of_joining', 'doj'],
  email: ['email', 'work_email', 'official_email', 'email_id'],
  phone: ['phone', 'mobile', 'contact_number', 'phone_number'],
  manager: ['manager', 'reporting_to', 'reports_to'],
  location: ['location', 'office', 'work_location'],
  assets: ['asset_assignments', 'assets', 'assigned_assets']
};

function scalar(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value);
}

function pick(row, field) {
  for (const key of FIELD_ALIASES[field]) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return '';
}

// Phone often lives inside a nested onboarding blob rather than a column.
function pickPhone(row) {
  const direct = scalar(pick(row, 'phone'));
  if (direct) return direct;

  const onboard = row.onboard && typeof row.onboard === 'object' ? row.onboard : {};
  return scalar(onboard.phone || onboard.mobile || onboard.contact_number);
}

function normalizeAssets(row, empId) {
  const raw = pick(row, 'assets');
  const assets = Array.isArray(raw) ? raw : [];
  return assets.map(asset => ({
    id: asset.id || '',
    empId,
    itemId: asset.itemId || asset.item_id || '',
    itemName: asset.itemName || asset.item_name || '',
    serialNo: asset.serialNo || asset.serial_no || '',
    assignedDate: asset.assignedDate || asset.assigned_date || '',
    returnedDate: asset.returnedDate || asset.returned_date || '',
    status: asset.status || 'Active',
    notes: asset.notes || ''
  }));
}

function normalizeEmployee(row) {
  const empId = scalar(pick(row, 'empId')) || scalar(row.id);
  return {
    id: row.id,
    empId,
    name: scalar(pick(row, 'name')),
    department: scalar(pick(row, 'department')),
    role: scalar(pick(row, 'role')),
    joinDate: scalar(pick(row, 'joinDate')),
    phone: pickPhone(row),
    email: scalar(pick(row, 'email')),
    createdAt: scalar(row.created_at),
    manager: scalar(pick(row, 'manager')),
    location: scalar(pick(row, 'location')),
    assets: normalizeAssets(row, empId)
  };
}

// Anything with an identifier is worth showing; a row with neither an employee
// id nor a name is not a person this screen can render.
function isUsableEmployee(employee) {
  return Boolean(employee.empId || employee.name);
}

async function selectPage(from, pageSize, ordered) {
  const options = { range: { from, to: from + pageSize - 1 } };
  if (ordered) options.order = 'name.asc';
  return select('employees', options);
}

async function selectAllEmployees() {
  const pageSize = 1000;
  const rows = [];
  // Sorting by a column the table doesn't have is a request error, not an
  // empty result, so fall back to unordered and sort in JS afterwards.
  let ordered = true;

  for (let from = 0; ; from += pageSize) {
    let page;
    try {
      page = await selectPage(from, pageSize, ordered);
    } catch (error) {
      if (!ordered) throw error;
      ordered = false;
      page = await selectPage(from, pageSize, ordered);
    }

    const pageRows = Array.isArray(page) ? page : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return rows;
}

async function selectAllAssignments() {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const page = await select('employee_assets', { range: { from, to: from + pageSize - 1 } });
    const pageRows = Array.isArray(page) ? page : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}

// Assignments are written to employee_assets (the HR-owned employees table
// rejects our writes). Assignments still sitting in the old per-employee JSON
// column are merged in by id, so nothing disappears if the one-time copy in
// database-employee-assets-plan.sql hasn't been run yet. A row in the new
// table wins over its legacy copy, since only the new table gets updated.
async function mergeAssignments(employees) {
  let tableRows = [];
  try {
    tableRows = await selectAllAssignments();
  } catch (error) {
    console.error('employee_assets unavailable, using legacy assignments only:', error.message);
  }

  const byEmployee = new Map(employees.map(employee => [employee.empId, employee]));
  for (const row of tableRows) {
    const employee = byEmployee.get(String(row.employee_id ?? ''));
    if (!employee) continue;
    const asset = normalizeAssets({ asset_assignments: [row] }, employee.empId)[0];
    employee.assets = [...employee.assets.filter(existing => existing.id !== asset.id), asset];
  }
}

exports.handler = async () => {
  try {
    const rows = await selectAllEmployees();
    const employees = rows
      .map(normalizeEmployee)
      .filter(isUsableEmployee)
      .sort((a, b) => String(a.name || a.empId).localeCompare(String(b.name || b.empId)));
    await mergeAssignments(employees);
    const assets = employees.flatMap(employee => employee.assets);

    // Rows that all got discarded means the column names didn't line up. Say
    // which columns the table actually has so the mismatch is diagnosable
    // instead of looking like an empty employee list.
    const unmappedColumns = rows.length > 0 && employees.length === 0
      ? Object.keys(rows[0])
      : undefined;

    return jsonResponse({ success: true, employees, assets, totalRows: rows.length, unmappedColumns });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
