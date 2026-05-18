const { select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'PR Number',
  'Item Name',
  'Description',
  'Quantity',
  'Project',
  'Department',
  'Requested By',
  'Priority',
  'Needed By',
  'Vendor',
  'Status',
  'Created Date',
  'Approved By',
  'Approved Date',
  'Ordered Date',
  'Received Date',
  'Notes',
  'Quote Amount',
  'Quote Notes',
  'Quoted By',
  'Tracking ID',
  'Order ID',
  'Invoice Number',
  'Final Amount',
  'PI Number',
  'PI Date'
];

exports.handler = async () => {
  try {
    const rows = await select('purchase_requests');
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
