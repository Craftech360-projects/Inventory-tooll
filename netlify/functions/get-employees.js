const { select, jsonResponse } = require('./supabase-client');

function normalizeAssets(employee) {
  const assets = Array.isArray(employee.asset_assignments) ? employee.asset_assignments : [];
  return assets.map(asset => ({
    id: asset.id || '',
    empId: employee.employee_id || '',
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
    empId: employee.employee_id || '',
    name: employee.name || '',
    department: employee.department || '',
    role: employee.title || '',
    joinDate: employee.date_of_hiring || '',
    phone: onboard.phone || '',
    email: employee.email || '',
    createdAt: employee.created_at || '',
    manager: employee.manager || '',
    location: employee.location || '',
    assets: normalizeAssets(employee)
  };
}

exports.handler = async () => {
  try {
    const rows = await select('employees', { filters: { type: 'eq.Employee' } });
    const employees = (Array.isArray(rows) ? rows : []).map(normalizeEmployee);
    const assets = employees.flatMap(employee => employee.assets);
    return jsonResponse({ success: true, employees, assets });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
