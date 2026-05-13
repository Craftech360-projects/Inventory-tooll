const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

function assertConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
}

function headers(extra = {}) {
  assertConfig();
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function encodeFilterValue(value) {
  return String(value ?? '').replace(/"/g, '\\"');
}

async function supabaseRequest(path, options = {}) {
  assertConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers || {})
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message = typeof body === 'object' && body ? body.message || body.details || JSON.stringify(body) : text;
    throw new Error(message || `Supabase request failed with HTTP ${response.status}`);
  }

  return body;
}

function select(table, options = {}) {
  const params = new URLSearchParams();
  params.set('select', options.select || '*');
  if (options.order) params.set('order', options.order);
  if (options.filters) {
    for (const [column, filter] of Object.entries(options.filters)) {
      params.set(column, filter);
    }
  }
  return supabaseRequest(`${table}?${params.toString()}`);
}

function insert(table, rows) {
  return supabaseRequest(table, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows)
  });
}

function upsert(table, rows, conflictColumn) {
  const params = new URLSearchParams();
  if (conflictColumn) params.set('on_conflict', conflictColumn);
  return supabaseRequest(`${table}?${params.toString()}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows)
  });
}

function update(table, filters, values) {
  const params = new URLSearchParams();
  for (const [column, filter] of Object.entries(filters)) {
    params.set(column, filter);
  }
  return supabaseRequest(`${table}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(values)
  });
}

function remove(table, filters) {
  const params = new URLSearchParams();
  for (const [column, filter] of Object.entries(filters)) {
    params.set(column, filter);
  }
  return supabaseRequest(`${table}?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' }
  });
}

function toCsv(headersList, rows) {
  const escapeCell = (value) => {
    const str = String(value ?? '');
    if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const csvRows = [headersList, ...rows.map(row => headersList.map(header => row[header]))];
  return csvRows.map(row => row.map(escapeCell).join(',')).join('\n');
}

function csvResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/csv',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    body
  };
}

function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}

module.exports = {
  encodeFilterValue,
  select,
  insert,
  upsert,
  update,
  remove,
  toCsv,
  csvResponse,
  jsonResponse
};
