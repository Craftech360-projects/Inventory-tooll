const { select, insert, update } = require('../supabase-client');
const { normalizeEmployee, normalizeAssets } = require('./employee-records');
const TABLE = 'inventory_employees';
const MIGRATION_MESSAGE = 'Employee management needs database-inventory-employees-plan.sql applied in Supabase first. Existing records have not been changed.';
// Quote filter values so punctuation in an existing employee ID stays literal.
const eq = value => `eq."${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function isMissingTable(error) {
  return /inventory_employees/.test(error.message) && /schema cache|does not exist|could not find/i.test(error.message);
}

async function allRows(table, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await select(table, { order, range: { from, to: from + 999 } });
    if (!Array.isArray(page)) throw new Error(`Invalid response reading ${table}`);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function loadDirectory() {
  let rows;
  let migrationRequired = false;
  try {
    rows = await allRows(TABLE, 'employee_id.asc');
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    migrationRequired = true;
    rows = await allRows('employees', 'id.asc');
  }
  const employees = rows.map(row => normalizeEmployee(migrationRequired ? row : {
    ...row, asset_assignments: row.legacy_assets
  })).filter(employee => employee.empId || employee.name);
  const assignments = await allRows('employee_assets', 'id.asc');
  const byEmployee = new Map(employees.map(employee => [employee.empId, employee]));
  for (const row of assignments) {
    const employee = byEmployee.get(String(row.employee_id ?? ''));
    if (!employee) continue;
    const asset = normalizeAssets({ asset_assignments: [row] }, employee.empId)[0];
    employee.assets = [...employee.assets.filter(existing => existing.id !== asset.id), asset];
  }
  employees.sort((a, b) => String(a.name || a.empId).localeCompare(String(b.name || b.empId)));
  return { employees, assets: employees.flatMap(employee => employee.assets), totalRows: rows.length,
    migrationRequired, migrationMessage: migrationRequired ? MIGRATION_MESSAGE : undefined };
}

async function getInventoryEmployee(empId) {
  try {
    const rows = await select(TABLE, { filters: { employee_id: eq(empId) } });
    return rows[0] || null;
  } catch (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_MESSAGE);
    throw error;
  }
}

const fieldMap = { name: 'name', department: 'department', role: 'role', joinDate: 'join_date',
  email: 'email', phone: 'phone', manager: 'manager', location: 'location' };

function employeeValues(data, creating) {
  const row = {};
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] === undefined && !creating) continue;
    if (data[key] != null && typeof data[key] !== 'string') throw new Error(`Invalid ${key}`);
    const value = (data[key] || '').trim();
    if (value.length > 500) throw new Error(`${key} must be 500 characters or fewer`);
    row[column] = value;
  }
  if (row.name !== undefined && !row.name) throw new Error('Employee name is required');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error('Enter a valid email address');
  if (row.join_date && (!/^\d{4}-\d{2}-\d{2}$/.test(row.join_date) ||
      !Number.isFinite(Date.parse(row.join_date)) || new Date(row.join_date).toISOString().slice(0, 10) !== row.join_date)) {
    throw new Error('Enter a valid joining date (YYYY-MM-DD)');
  }
  return row;
}

async function employeeAction(action, data) {
  if (typeof data.empId !== 'string' || !data.empId.trim()) throw new Error('Employee ID is required');
  const empId = action === 'createEmployee' ? data.empId.trim() : data.empId;
  if (empId.length > 200) throw new Error('Employee ID must be 200 characters or fewer');
  const existing = await getInventoryEmployee(empId);
  if (action === 'createEmployee') {
    if (existing) throw new Error('Employee ID already exists (including archived employees)');
    await insert(TABLE, { employee_id: empId, ...employeeValues(data, true) });
  } else {
    if (!existing) throw new Error('Employee not found');
    let changes;
    if (action === 'updateEmployee') {
      if (data.employeeId !== undefined && data.employeeId !== empId) throw new Error('Employee ID cannot be changed');
      changes = employeeValues(data, false);
      if (!Object.keys(changes).length) throw new Error('No employee changes supplied');
    } else if (action === 'archiveEmployee') {
      const directory = await loadDirectory();
      if (directory.assets.some(asset => asset.empId === empId && asset.status === 'Active')) {
        throw new Error('Return all active assets before deleting this employee');
      }
      changes = { archived_at: existing.archived_at || new Date().toISOString() };
    } else if (action === 'restoreEmployee') {
      changes = { archived_at: null };
    } else {
      throw new Error('Unsupported employee action');
    }
    const updated = await update(TABLE, { employee_id: eq(empId) }, changes);
    if (!updated.length) throw new Error('Employee not found');
  }
  return { success: true, empId };
}

module.exports = { loadDirectory, getInventoryEmployee, employeeAction };
