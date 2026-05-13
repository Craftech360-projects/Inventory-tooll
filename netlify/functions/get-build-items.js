const { encodeFilterValue, select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'Build ID',
  'Item ID',
  'Item Name',
  'Category',
  'Qty Used',
  'Date Added'
];

exports.handler = async (event) => {
  try {
    const buildId = event.queryStringParameters?.build;
    const filters = buildId ? { 'Build ID': `eq.${encodeFilterValue(buildId)}` } : undefined;
    const rows = await select('build_items', { filters });
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
