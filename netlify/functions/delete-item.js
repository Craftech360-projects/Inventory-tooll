const { encodeFilterValue, select, remove, jsonResponse } = require('./supabase-client');

function filterEq(value) {
  return `eq.${encodeFilterValue(value)}`;
}

function normalizeLookupValue(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const normalizedItemId = normalizeLookupValue(body.itemId);
    if (!normalizedItemId) throw new Error('Missing itemId');

    const exactRows = await select('items', { filters: { 'Item ID': filterEq(normalizedItemId) } });
    let matchingRows = (Array.isArray(exactRows) ? exactRows : []).filter(row =>
      normalizeLookupValue(row?.['Item ID']) === normalizedItemId
    );

    if (matchingRows.length === 0) {
      const allRows = await select('items');
      matchingRows = (Array.isArray(allRows) ? allRows : []).filter(row =>
        normalizeLookupValue(row?.['Item ID']) === normalizedItemId
      );
    }

    if (matchingRows.length === 0) {
      throw new Error(`Item not found: ${normalizedItemId}`);
    }

    const rawItemIds = [...new Set(
      matchingRows
        .map(row => String(row?.['Item ID'] ?? ''))
        .filter(Boolean)
    )];

    let deletedCount = 0;
    for (const rawItemId of rawItemIds) {
      const deletedRows = await remove('items', { 'Item ID': filterEq(rawItemId) });
      deletedCount += Array.isArray(deletedRows) ? deletedRows.length : 0;
    }

    return jsonResponse({ success: true, itemId: normalizedItemId, deletedCount: deletedCount || matchingRows.length });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
};
