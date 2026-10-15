// Read-only deployment check. Never prints employee data or credentials.
async function main() {
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: 'count=exact'
  };
  for (const table of ['employees', 'employee_assets', 'inventory_employees']) {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers });
    const body = await response.json();
    console.log(JSON.stringify({ table, status: response.status, count: response.headers.get('content-range'),
      columns: response.ok ? Object.keys(body[0] || {}) : undefined,
      error: response.ok ? undefined : body.message }));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
