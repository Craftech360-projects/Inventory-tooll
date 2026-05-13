const { encodeFilterValue, remove, jsonResponse } = require('./supabase-client');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.itemId) throw new Error('Missing itemId');
    await remove('items', { 'Item ID': `eq.${encodeFilterValue(body.itemId)}` });
    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
