const { insert, select, jsonResponse } = require('./supabase-client');

const CATEGORY_PREFIXES = {
  'IT Assets': 'IT',
  Electronics: 'EC',
  'Event Equipment': 'EV',
  'Mechanical Division': 'MC',
  'Office Assets': 'OA',
  'Dead Stock': 'DS',
  'Rented Equipment': 'RE'
};

function inventoryRow(item) {
  return {
    'Item ID': item.itemId || '',
    'Item Name': item.name || '',
    Category: item.category || '',
    'Sub-Category': item.subCategory || '',
    Quantity: item.quantity ?? 0,
    Status: item.status || 'Available',
    Location: item.location || '',
    Value: item.value ?? '',
    'Added Date': item.addedDate || '',
    Notes: item.notes || '',
    'Return Date': item.returnDate || '',
    'Event/Project': item.eventProject || '',
    'Vendor Name': item.vendorName || '',
    'Vendor Contact': item.vendorContact || '',
    'Rental Cost': item.rentalCost ?? '',
    Deposit: item.deposit ?? ''
  };
}

function normalizeItemId(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function resolveItemId(item) {
  const requestedItemId = normalizeItemId(item.itemId);
  const rows = await select('items');
  const itemIds = new Set((Array.isArray(rows) ? rows : []).map(row => normalizeItemId(row?.['Item ID'])));

  if (requestedItemId && !itemIds.has(requestedItemId)) {
    return requestedItemId;
  }

  const requestedPrefix = requestedItemId.match(/^([A-Za-z]+)-\d+$/)?.[1];
  const prefix = requestedPrefix || CATEGORY_PREFIXES[item.category] || 'ITM';
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idPattern = new RegExp(`^${escapedPrefix}-(\\d+)$`);
  const maxNumber = [...itemIds].reduce((max, itemId) => {
    const match = itemId.match(idPattern);
    return match ? Math.max(max, parseInt(match[1], 10) || 0) : max;
  }, 0);

  return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}

function isDuplicateKeyError(error) {
  return /duplicate key value violates unique constraint/i.test(String(error?.message || ''));
}

async function insertInventoryItem(item) {
  let itemId = item.itemId;
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    itemId = await resolveItemId({ ...item, itemId });

    try {
      await insert('items', inventoryRow({ ...item, itemId }));
      return itemId;
    } catch (error) {
      lastError = error;
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Failed to add inventory item');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const item = JSON.parse(event.body || '{}');
    const itemId = await insertInventoryItem(item);
    return jsonResponse({ success: true, itemId });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
