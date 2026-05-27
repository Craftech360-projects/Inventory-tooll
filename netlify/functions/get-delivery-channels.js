const { select, toCsv, csvResponse, jsonResponse } = require('./supabase-client');

const HEADERS = [
  'DC Number',
  'Event Name',
  'Activity',
  'Event Date',
  'Event Location',
  'Client Name',
  'Client POC',
  'Client Phone',
  'Site POC',
  'Site Phone',
  'Carrier Name',
  'Carrier Phone',
  'Vehicle Number',
  'Dispatch Date',
  'Expected Return',
  'Actual Return',
  'Status',
  'PM Approver',
  'Approval Date',
  'Notes',
  'Created Date',
  'From Address',
  'To Address',
  'Event Executor'
];

exports.handler = async () => {
  try {
    const rows = await select('delivery_channels');
    return csvResponse(toCsv(HEADERS, Array.isArray(rows) ? rows : []));
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
};
