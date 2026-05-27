const { select, jsonResponse } = require('./supabase-client');

function normalizeAssets(employee) {
  const assets = Array.isArray(employee.asset_assignments) ? employee.asset_assignments : [];
  return assets.map(asset => ({
    id: asset.id || '',
    empId: String(employee.employee_id || ''),
    itemId: asset.itemId || '',
    itemName: asset.itemName || '',
    serialNo: asset.serialNo || '',
    assignedDate: asset.assignedDate || '',
    returnedDate: asset.returnedDate || '',
    status: asset.status || 'Active',
    notes: asset.notes || ''
  }));
}

function normalizeEmployee(employee) {
  const onboard = employee.onboard && typeof employee.onboard === 'object' ? employee.onboard : {};
  return {
    id: employee.id,
    empId: String(employee.employee_id || ''),
    name: String(employee.name || ''),
    department: String(employee.department || ''),
    role: String(employee.title || ''),
    joinDate: employee.date_of_hiring || '',
    phone: onboard.phone || '',
    email: employee.email || '',
    createdAt: employee.created_at || '',
    manager: employee.manager || '',
    location: employee.location || '',
    assets: normalizeAssets(employee)
  };
}

function isUsableEmployee(employee) {
  return Boolean(employee?.employee_id);
}

async function selectAllEmployees() {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const page = await select('employees', {
      order: 'name.asc',
      range: { from, to: from + pageSize - 1 }
    });
    const pageRows = Array.isArray(page) ? page : [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }

  return rows;
}

exports.handler = async () => {
  try {
    const rows = await selectAllEmployees();
    const employees = rows
      .filter(isUsableEmployee)
      .map(normalizeEmployee)
      .sort((a, b) => String(a.name || a.empId).localeCompare(String(b.name || b.empId)));
    const assets = employees.flatMap(employee => employee.assets);
    return jsonResponse({ success: true, employees, assets, totalRows: rows.length });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
