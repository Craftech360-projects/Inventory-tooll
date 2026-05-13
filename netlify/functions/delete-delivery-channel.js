const { encodeFilterValue, remove, jsonResponse } = require('./supabase-client');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { dcNumber } = JSON.parse(event.body || '{}');
    if (!dcNumber) throw new Error('Missing dcNumber');

    const filter = `eq.${encodeFilterValue(dcNumber)}`;
    await remove('dc_items', { 'DC Number': filter });
    await remove('delivery_channels', { 'DC Number': filter });

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
