const { select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'Build ID',
  'Product Name',
  'Description',
  'Target Category',
  'Status',
  'Created By',
  'Created Date',
  'Completed Date',
  'Result Item ID',
  'Est Value',
  'Component Count'
];

exports.handler = async () => {
  try {
    const rows = await select('builds');
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
