const { select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'Log ID',
  'Item ID',
  'Item Name',
  'Team Member',
  'Purpose',
  'Request Date',
  'Expected Return',
  'Status',
  'Handed Over By',
  'Handover Date',
  'Return Date',
  'Notes'
];

exports.handler = async () => {
  try {
    const rows = await select('daily_logs');
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
