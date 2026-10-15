// Run with: node --env-file=.env scripts/backup-employees.cjs
// Saves private data outside the web root and never writes to Supabase.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { select } = require('../netlify/functions/supabase-client');

async function main() {
  const tables = {};
  for (const table of ['employees', 'employee_assets']) {
    tables[table] = [];
    for (let from = 0; ; from += 1000) {
      const page = await select(table, { order: 'id.asc', range: { from, to: from + 999 } });
      tables[table].push(...page);
      if (page.length < 1000) break;
    }
  }
  const directory = path.join(os.homedir(), '.codex', 'backups', 'inventory-employees');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const body = JSON.stringify({ savedAt: new Date().toISOString(), tables }, null, 2);
  fs.writeFileSync(file, body, { flag: 'wx', mode: 0o600 });
  if (fs.readFileSync(file, 'utf8') !== body) throw new Error('Backup verification failed');
  console.log(JSON.stringify({ file, employees: tables.employees.length, assignments: tables.employee_assets.length,
    sha256: createHash('sha256').update(body).digest('hex') }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
