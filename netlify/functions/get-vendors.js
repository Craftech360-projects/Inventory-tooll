const { select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'Vendor Name',
  'Vendor Contact Number',
  'Email',
  'Vendor Address',
  'GSTIN',
  'City',
  'Category',
  'POC Name',
  'Created Date',
  'Sub-Category'
];

exports.handler = async () => {
  try {
    const rows = await select('vendors');
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
