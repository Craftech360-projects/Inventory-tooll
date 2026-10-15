// Shared normalization for the legacy directory and inventory-owned records.
const FIELD_ALIASES = {
  empId: ['employee_id', 'emp_id', 'employeeId', 'employee_code', 'emp_code'],
  name: ['name', 'full_name', 'employee_name', 'fullName', 'display_name'],
  department: ['department', 'dept', 'department_name'],
  role: ['title', 'role', 'designation', 'job_title', 'position'],
  joinDate: ['join_date', 'date_of_hiring', 'joining_date', 'hire_date', 'date_of_joining', 'doj'],
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
  return assets.map((asset, index) => ({
    id: asset.id || `EA-LEGACY-${empId}-${index + 1}`,
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
    archivedAt: scalar(row.archived_at),
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


module.exports = { normalizeEmployee, normalizeAssets };
