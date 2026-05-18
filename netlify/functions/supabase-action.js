const {
  encodeFilterValue,
  select,
  insert,
  update,
  remove,
  jsonResponse
} = require('./supabase-client');

const CATEGORY_PREFIXES = {
  'Event Equipment': 'EV',
  Electronics: 'EC',
  'Electronic Components': 'EC',
  'IT Assets': 'IT',
  'Office Assets': 'OF',
  'Office Asset': 'OF',
  'Mechanical Division': 'MD',
  'Dead Stock': 'DS',
  'Rented Equipment': 'RE'
};

function filterEq(value) {
  return `eq.${encodeFilterValue(value)}`;
}

function normalizeLookupValue(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function inventoryRow(data) {
  return {
    'Item ID': data.itemId || '',
    'Item Name': data.name || data.itemName || '',
    Category: data.category || '',
    'Sub-Category': data.subCategory || '',
    Quantity: data.quantity ?? 0,
    Status: data.status || 'Available',
    Location: data.location || '',
    Value: data.value ?? '',
    'Added Date': data.addedDate || '',
    Notes: data.notes || '',
    'Return Date': data.returnDate || '',
    'Event/Project': data.eventProject || '',
    'Vendor Name': data.vendorName || '',
    'Vendor Contact': data.vendorContact || '',
    'Rental Cost': data.rentalCost ?? '',
    Deposit: data.deposit ?? ''
  };
}

function dcRow(data, existing = {}) {
  return {
    'DC Number': data.dcNumber || existing['DC Number'] || '',
    'Event Name': data.eventName || '',
    Activity: data.activity || '',
    'Event Date': data.eventDate || '',
    'Event Location': data.eventLocation || '',
    'Client Name': data.clientName || '',
    'Client POC': data.clientPOC || '',
    'Client Phone': data.clientPhone || '',
    'Site POC': data.sitePOC || '',
    'Site Phone': data.sitePhone || '',
    'Carrier Name': data.carrierName || '',
    'Carrier Phone': data.carrierPhone || '',
    'Vehicle Number': data.vehicleNumber || '',
    'Dispatch Date': data.dispatchDate || existing['Dispatch Date'] || '',
    'Expected Return': data.expectedReturn || '',
    'Actual Return': data.actualReturn || existing['Actual Return'] || '',
    Status: existing.Status || data.status || 'Draft',
    'PM Approver': existing['PM Approver'] || data.pmApprover || '',
    'Approval Date': existing['Approval Date'] || data.approvalDate || '',
    Notes: data.notes || '',
    'Created Date': existing['Created Date'] || data.createdDate || '',
    'From Address': data.fromAddress || '',
    'To Address': data.toAddress || ''
  };
}

function dcItemRows(dcNumber, items = []) {
  return items.map(item => ({
    'DC Number': dcNumber,
    'Item ID': item.itemId || '',
    'Item Name': item.name || item.itemName || '',
    Category: item.category || '',
    Quantity: item.qty ?? item.quantity ?? 1,
    'Return Condition': item.returnCondition || '',
    'Return Notes': item.notes || item.returnNotes || ''
  }));
}

function prRow(pr) {
  return {
    'PR Number': pr.prNumber || '',
    'Item Name': pr.itemName || '',
    Description: pr.description || '',
    Quantity: pr.quantity ?? 1,
    Project: pr.project || '',
    Department: pr.department || '',
    'Requested By': pr.requestedBy || '',
    Priority: pr.priority || 'Medium',
    'Needed By': pr.neededBy || '',
    Vendor: pr.vendor || '',
    Status: pr.status || 'Request',
    'Created Date': pr.createdDate || '',
    'Approved By': pr.approvedBy || '',
    'Approved Date': pr.approvedDate || '',
    'Ordered Date': pr.orderedDate || '',
    'Received Date': pr.receivedDate || '',
    Notes: pr.notes || '',
    'Quote Amount': pr.quoteAmount || '',
    'Quote Notes': pr.quoteNotes || '',
    'Quoted By': pr.quotedBy || '',
    'Tracking ID': pr.trackingId || '',
    'Order ID': pr.orderId || '',
    'Invoice Number': pr.invoiceNumber || '',
    'Final Amount': pr.finalAmount || '',
    'PI Number': pr.piNumber || '',
    'PI Date': pr.piDate || ''
  };
}

function vendorRow(vendor) {
  return {
    'Vendor Name': vendor.name || vendor.vendorName || '',
    'Vendor Contact Number': vendor.contactNumber || vendor.vendorContactNumber || '',
    Email: vendor.email || '',
    'Vendor Address': vendor.address || vendor.vendorAddress || '',
    GSTIN: vendor.gstin || '',
    PAN: vendor.pan || '',
    'Created Date': vendor.createdDate || new Date().toISOString().slice(0, 10)
  };
}

function dailyLogRow(data) {
  return {
    'Log ID': data.logId || '',
    'Item ID': data.itemId || '',
    'Item Name': data.itemName || '',
    'Team Member': data.teamMember || '',
    Purpose: data.purpose || '',
    'Request Date': data.requestDate || '',
    'Expected Return': data.expectedReturn || '',
    Status: data.status || 'Requested',
    'Handed Over By': data.handedOverBy || '',
    'Handover Date': data.handoverDate || '',
    'Return Date': data.returnDate || '',
    Notes: data.notes || ''
  };
}

function normalizeEmployeeAssets(employee) {
  return Array.isArray(employee?.asset_assignments) ? employee.asset_assignments : [];
}

async function getEmployeeByEmployeeId(employeeId) {
  const rows = await select('employees', { filters: { employee_id: filterEq(employeeId) } });
  return Array.isArray(rows) ? rows[0] : null;
}

async function findInventoryRowsByItemId(itemId) {
  const normalizedItemId = normalizeLookupValue(itemId);
  if (!normalizedItemId) return [];

  const exactRows = await select('items', { filters: { 'Item ID': filterEq(normalizedItemId) } });
  const exactMatches = (Array.isArray(exactRows) ? exactRows : []).filter(row =>
    normalizeLookupValue(row?.['Item ID']) === normalizedItemId
  );

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const allRows = await select('items');
  return (Array.isArray(allRows) ? allRows : []).filter(row =>
    normalizeLookupValue(row?.['Item ID']) === normalizedItemId
  );
}

async function deleteInventoryItemByItemId(itemId) {
  const normalizedItemId = normalizeLookupValue(itemId);
  if (!normalizedItemId) {
    throw new Error('Missing itemId for delete');
  }

  const matchingRows = await findInventoryRowsByItemId(normalizedItemId);
  if (matchingRows.length === 0) {
    throw new Error(`Item not found: ${normalizedItemId}`);
  }

  const rawItemIds = [...new Set(
    matchingRows
      .map(row => String(row?.['Item ID'] ?? ''))
      .filter(Boolean)
  )];

  let deletedCount = 0;
  for (const rawItemId of rawItemIds) {
    const deletedRows = await remove('items', { 'Item ID': filterEq(rawItemId) });
    deletedCount += Array.isArray(deletedRows) ? deletedRows.length : 0;
  }

  const remainingRows = await findInventoryRowsByItemId(normalizedItemId);
  if (remainingRows.length > 0) {
    throw new Error(`Delete did not remove item ${normalizedItemId}`);
  }

  return {
    success: true,
    deletedCount: deletedCount || matchingRows.length,
    itemId: normalizedItemId
  };
}

function buildRow(data, existing = {}) {
  return {
    'Build ID': data.buildId || existing['Build ID'] || '',
    'Product Name': data.productName || '',
    Description: data.description || '',
    'Target Category': data.targetCategory || 'Event Equipment',
    Status: existing.Status || data.status || 'In Progress',
    'Created By': data.createdBy || '',
    'Created Date': existing['Created Date'] || data.createdDate || '',
    'Completed Date': existing['Completed Date'] || data.completedDate || '',
    'Result Item ID': existing['Result Item ID'] || data.resultItemId || '',
    'Est Value': data.estValue ?? '',
    'Component Count': data.componentCount ?? 0
  };
}

function buildItemRows(buildId, items = [], dateAdded = '') {
  return items.map(item => ({
    'Build ID': buildId,
    'Item ID': item.itemId || '',
    'Item Name': item.name || item.itemName || '',
    Category: item.category || '',
    'Qty Used': item.qty ?? item.quantity ?? 1,
    'Date Added': dateAdded
  }));
}

async function updateById(table, keyColumn, keyValue, values) {
  return update(table, { [keyColumn]: filterEq(keyValue) }, values);
}

async function upsertById(table, keyColumn, row) {
  const keyValue = row[keyColumn];
  const existing = await select(table, { filters: { [keyColumn]: filterEq(keyValue) } });
  if (Array.isArray(existing) && existing.length > 0) {
    return updateById(table, keyColumn, keyValue, row);
  }
  return insert(table, row);
}

async function adjustItemQuantity(itemId, delta) {
  const rows = await select('items', { filters: { 'Item ID': filterEq(itemId) } });
  const item = Array.isArray(rows) ? rows[0] : null;
  if (!item) return;
  const current = parseInt(item.Quantity, 10) || 0;
  await updateById('items', 'Item ID', itemId, { Quantity: Math.max(0, current + delta) });
}

async function generateResultItemId(category) {
  const prefix = CATEGORY_PREFIXES[category] || 'ITM';
  const rows = await select('items', { filters: { Category: filterEq(category) } });
  const maxNumber = (Array.isArray(rows) ? rows : []).reduce((max, row) => {
    const match = String(row['Item ID'] || '').match(/-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10) || 0) : max;
  }, 0);
  return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}

async function handleAction(action, data) {
  if (action === 'add') {
    await insert('items', inventoryRow(data));
    return { success: true, itemId: data.itemId };
  }

  if (action === 'update') {
    await updateById('items', 'Item ID', data.itemId, inventoryRow(data));
    return { success: true, itemId: data.itemId };
  }

  if (action === 'delete') {
    return deleteInventoryItemByItemId(data.itemId);
  }

  if (action === 'upsertVendor') {
    const row = vendorRow(data);
    if (!row['Vendor Name']) throw new Error('Missing vendor name');
    if (!row['Vendor Contact Number']) throw new Error('Missing vendor contact number');
    await upsertById('vendors', 'Vendor Name', row);
    return { success: true, vendorName: row['Vendor Name'] };
  }

  if (action === 'deleteVendor') {
    const vendorName = data.name || data.vendorName || '';
    if (!vendorName) throw new Error('Missing vendor name');
    await remove('vendors', { 'Vendor Name': filterEq(vendorName) });
    return { success: true, vendorName };
  }

  if (action === 'updateItemsStatus') {
    for (const itemId of data.itemIds || []) {
      await updateById('items', 'Item ID', itemId, { Status: data.status || 'Available' });
    }
    return { success: true };
  }

  if (action === 'createDC' || action === 'updateDC') {
    const existingRows = await select('delivery_channels', { filters: { 'DC Number': filterEq(data.dcNumber) } });
    const existing = Array.isArray(existingRows) ? existingRows[0] : {};
    await upsertById('delivery_channels', 'DC Number', dcRow(data, existing));
    await remove('dc_items', { 'DC Number': filterEq(data.dcNumber) });
    const items = dcItemRows(data.dcNumber, data.items);
    if (items.length > 0) await insert('dc_items', items);
    return { success: true, dcNumber: data.dcNumber };
  }

  if (action === 'updateDCItems') {
    await remove('dc_items', { 'DC Number': filterEq(data.dcNumber) });
    const items = dcItemRows(data.dcNumber, data.items);
    if (items.length > 0) await insert('dc_items', items);
    return { success: true };
  }

  if (action === 'updateDCStatus') {
    await updateById('delivery_channels', 'DC Number', data.dcNumber, { Status: data.status });
    return { success: true };
  }

  if (action === 'approveDC') {
    await updateById('delivery_channels', 'DC Number', data.dcNumber, {
      Status: 'Approved',
      'PM Approver': data.approver || '',
      'Approval Date': data.date || ''
    });
    return { success: true };
  }

  if (action === 'dispatchDC') {
    await updateById('delivery_channels', 'DC Number', data.dcNumber, {
      Status: 'Dispatched',
      'Dispatch Date': data.dispatchDate || ''
    });
    return { success: true };
  }

  if (action === 'closeDC') {
    await updateById('delivery_channels', 'DC Number', data.dcNumber, {
      Status: 'Closed',
      'Actual Return': data.actualReturn || ''
    });
    return { success: true };
  }

  if (action === 'createPR') {
    const pr = data.data || data;
    await insert('purchase_requests', prRow(pr));
    return { success: true, prNumber: pr.prNumber };
  }

  if (action === 'updatePR') {
    const updates = data.updates || {};
    const row = {};
    const map = {
      status: 'Status',
      approvedBy: 'Approved By',
      approvedDate: 'Approved Date',
      orderedDate: 'Ordered Date',
      receivedDate: 'Received Date',
      quoteAmount: 'Quote Amount',
      quoteNotes: 'Quote Notes',
      quotedBy: 'Quoted By',
      vendor: 'Vendor',
      trackingId: 'Tracking ID',
      orderId: 'Order ID',
      invoiceNumber: 'Invoice Number',
      finalAmount: 'Final Amount',
      piNumber: 'PI Number',
      piDate: 'PI Date',
      notes: 'Notes'
    };
    for (const [key, column] of Object.entries(map)) {
      if (updates[key] !== undefined) row[column] = updates[key];
    }
    await updateById('purchase_requests', 'PR Number', data.prNumber, row);
    return { success: true };
  }

  if (action === 'createDailyLog') {
    await insert('daily_logs', dailyLogRow(data));
    return { success: true, logId: data.logId };
  }

  if (action === 'updateDailyLog') {
    const row = {};
    if (data.status) row.Status = data.status;
    if (data.handedOverBy) row['Handed Over By'] = data.handedOverBy;
    if (data.handoverDate) row['Handover Date'] = data.handoverDate;
    if (data.returnDate) row['Return Date'] = data.returnDate;
    await updateById('daily_logs', 'Log ID', data.logId, row);
    return { success: true };
  }

  if (action === 'assignAsset') {
    const employee = await getEmployeeByEmployeeId(data.empId);
    if (!employee) throw new Error('Employee not found');

    const assets = normalizeEmployeeAssets(employee);
    const assignment = {
      id: data.id || `EA-${Date.now()}`,
      itemId: data.itemId || '',
      itemName: data.itemName || '',
      serialNo: data.serialNo || '',
      assignedDate: data.assignedDate || '',
      returnedDate: '',
      status: 'Active',
      notes: data.notes || ''
    };

    await update('employees', { employee_id: filterEq(data.empId) }, {
      asset_assignments: [...assets, assignment]
    });

    if (assignment.itemId) {
      await updateById('items', 'Item ID', assignment.itemId, { Status: 'In Use' });
    }

    return { success: true, id: assignment.id };
  }

  if (action === 'returnAsset') {
    const employees = await select('employees');
    const employee = (Array.isArray(employees) ? employees : []).find(row =>
      normalizeEmployeeAssets(row).some(asset => asset.id === data.id)
    );
    if (!employee) throw new Error('Asset assignment not found');

    let returnedItemId = '';
    const assets = normalizeEmployeeAssets(employee).map(asset => {
      if (asset.id !== data.id) return asset;
      returnedItemId = asset.itemId || '';
      return {
        ...asset,
        returnedDate: data.returnedDate || new Date().toISOString().slice(0, 10),
        status: 'Returned'
      };
    });

    await update('employees', { employee_id: filterEq(employee.employee_id) }, {
      asset_assignments: assets
    });

    if (returnedItemId) {
      await updateById('items', 'Item ID', returnedItemId, { Status: 'Available' });
    }

    return { success: true };
  }

  if (action === 'createBuild' || action === 'updateBuild') {
    const existingRows = await select('builds', { filters: { 'Build ID': filterEq(data.buildId) } });
    const existing = Array.isArray(existingRows) ? existingRows[0] : {};
    await upsertById('builds', 'Build ID', buildRow(data, existing));
    await remove('build_items', { 'Build ID': filterEq(data.buildId) });
    const items = buildItemRows(data.buildId, data.items, data.createdDate);
    if (items.length > 0) await insert('build_items', items);
    if (action === 'createBuild') {
      for (const item of data.items || []) {
        await adjustItemQuantity(item.itemId, -(parseInt(item.qty, 10) || 1));
      }
    }
    return { success: true, buildId: data.buildId };
  }

  if (action === 'completeBuild') {
    const resultItemId = await generateResultItemId(data.targetCategory || 'Event Equipment');
    await insert('items', {
      'Item ID': resultItemId,
      'Item Name': data.productName || '',
      Category: data.targetCategory || 'Event Equipment',
      'Sub-Category': 'Built Product',
      Quantity: 1,
      Status: 'Available',
      Location: '',
      Value: data.estValue ?? '',
      'Added Date': data.completedDate || '',
      Notes: data.description || '',
      'Return Date': '',
      'Event/Project': '',
      'Vendor Name': '',
      'Vendor Contact': '',
      'Rental Cost': '',
      Deposit: ''
    });
    await updateById('builds', 'Build ID', data.buildId, {
      Status: 'Completed',
      'Completed Date': data.completedDate || '',
      'Result Item ID': resultItemId
    });
    return { success: true, resultItemId };
  }

  if (action === 'cancelBuild') {
    const items = await select('build_items', { filters: { 'Build ID': filterEq(data.buildId) } });
    for (const item of items || []) {
      await adjustItemQuantity(item['Item ID'], parseInt(item['Qty Used'], 10) || 1);
    }
    await updateById('builds', 'Build ID', data.buildId, { Status: 'Cancelled' });
    return { success: true };
  }

  throw new Error(`Unsupported action: ${action}`);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse({ success: true });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const action = event.queryStringParameters?.action || body.action;
    if (!action) throw new Error('Missing action');

    const result = await handleAction(action, body);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
