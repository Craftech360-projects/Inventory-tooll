const { insert, jsonResponse } = require('./supabase-client');

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const item = JSON.parse(event.body || '{}');
    await insert('items', inventoryRow(item));
    return jsonResponse({ success: true, itemId: item.itemId });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
