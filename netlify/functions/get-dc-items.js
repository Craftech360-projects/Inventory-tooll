const { encodeFilterValue, select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'DC Number',
  'Item ID',
  'Item Name',
  'Category',
  'Quantity',
  'Return Condition',
  'Return Notes'
];

exports.handler = async (event) => {
  try {
    const dcNumber = event.queryStringParameters?.dc;
    const filters = dcNumber ? { 'DC Number': `eq.${encodeFilterValue(dcNumber)}` } : undefined;
    const rows = await select('dc_items', { filters });
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
