// Read-only check: node --env-file=.env scripts/verify-employee-migration.cjs <backup.json>
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const { select } = require('../netlify/functions/supabase-client');
const { loadDirectory } = require('../netlify/functions/lib/employee-store');
const { normalizeEmployee } = require('../netlify/functions/lib/employee-records');

async function all(table, order) {
  const result = [];
  for (let from = 0; ; from += 1000) {
    const page = await select(table, { order, range: {from, to: from + 999} });
    result.push(...page);
    if (page.length < 1000) return result;
  }
}
async function main() {
  if (!process.argv[2]) throw new Error('Supply the private backup JSON path');
  const backup = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).tables;
  const original = await all('employees', 'id.asc');
  // Never print a diff containing private employee information.
  assert.ok(isDeepStrictEqual(original, backup.employees), 'Source employees differ from backup; investigate before deployment');
  const assignments = await all('employee_assets', 'id.asc');
  const ids = new Set(assignments.map(row => row.id));
  assert.ok(backup.employee_assets.every(row => ids.has(row.id)), 'An existing assignment ID is missing');
  assert.ok(backup.employee_assets.every(row => isDeepStrictEqual(row, assignments.find(current => current.id === row.id))),
    'An existing assignment differs from backup; investigate activity before deployment');
  const directory = await loadDirectory();
  if (directory.migrationRequired) {
    console.log(JSON.stringify({ sourceEmployeesUnchanged: true, employees: original.length,
      existingAssignmentsPresent: backup.employee_assets.length, migrationRequired: true }));
    return;
  }
  const inventory = await all('inventory_employees', 'employee_id.asc');
  for (const row of backup.employees) {
    const expected = normalizeEmployee(row);
    const copy = inventory.find(employee => employee.employee_id === expected.empId);
    assert.ok(copy, 'A backed-up employee ID is missing from inventory');
    assert.ok(isDeepStrictEqual(copy.source_record, row), 'Original employee snapshot was not preserved');
    assert.ok(directory.employees.some(employee => employee.empId === expected.empId), 'Employee missing from API response');
  }
  console.log(JSON.stringify({ sourceEmployeesUnchanged: true, employeesVerified: original.length,
    existingAssignmentsPresent: backup.employee_assets.length, migrationRequired: false }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
