const { select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'Item ID',
  'Item Name',
  'Category',
  'Sub-Category',
  'Quantity',
  'Status',
  'Location',
  'Value',
  'Added Date',
  'Notes',
  'Return Date',
  'Event/Project',
  'Vendor Name',
  'Vendor Contact',
  'Rental Cost',
  'Deposit',
  'In Use Qty'
];

exports.handler = async () => {
  try {
    const rows = await select('items');
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
