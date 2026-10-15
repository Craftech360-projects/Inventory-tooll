const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migration = fs.readFileSync(path.join(__dirname, '../../database-inventory-employees-plan.sql'), 'utf8');
const identifier = name => '"' + name.replaceAll('"', '""') + '"';

async function seedTable(db, table, rows, emptySchema) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const types = keys.map(key => {
    const value = rows.map(row => row[key]).find(value => value != null);
    return value != null && typeof value === 'object' ? 'jsonb' : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'numeric' : 'text';
  });
  await db.exec(`create table ${identifier(table)} (${keys.length ? keys.map((key, i) => `${identifier(key)} ${types[i]}`).join(',') : emptySchema})`);
  if (rows.length) {
    const columns = keys.map(identifier).join(',');
    const definitions = keys.map((key, i) => `${identifier(key)} ${types[i]}`).join(',');
    await db.query(`insert into ${identifier(table)} (${columns}) select ${columns} from jsonb_to_recordset($1::jsonb) as r(${definitions})`, [JSON.stringify(rows)]);
  }
}

async function makeDb(employees = [], assignments = []) {
  const db = await PGlite.create();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await seedTable(db, 'employees', employees, 'id text, employee_id text, name text, asset_assignments jsonb');
  await db.exec(`create table employee_assets (
    id text primary key, employee_id text not null, item_id text, item_name text, serial_no text,
    assigned_date date, returned_date date, status text not null default 'Active', notes text,
    created_at timestamptz not null default now());
    create table items ("Item ID" text primary key, "Quantity" integer, "In Use Qty" integer, "Status" text);`);
  for (const row of assignments) {
    const keys = Object.keys(row);
    await db.query(`insert into employee_assets (${keys.map(identifier)}) values (${keys.map((_, i) => '$' + (i + 1))})`, Object.values(row));
  }
  return db;
}

// Local REST adapter exercises the real server handlers/client against PostgreSQL.
// Every request is intercepted; tests cannot reach production.
function restFetch(db) {
  return async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname !== 'inventory-test.invalid') throw new Error('Tests may only access the isolated database');
    const table = url.pathname.split('/').pop();
    if (!['employees', 'employee_assets', 'inventory_employees', 'items'].includes(table)) throw new Error('Unexpected table');
    const method = options.method || 'GET';
    if (table === 'employees' && method !== 'GET') throw new Error('Source employees must never be mutated');
    try {
      const values = [];
      const filters = [];
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit'].includes(key)) continue;
        if (!value.startsWith('eq.')) throw new Error('Unsupported test filter');
        const literal = value.slice(3);
        values.push(literal.startsWith('"') ? JSON.parse(literal) : literal.replaceAll('\\"', '"'));
        filters.push(`${identifier(key)} = $${values.length}`);
      }
      const where = filters.length ? ' where ' + filters.join(' and ') : '';
      let result;
      if (method === 'GET') {
        let sql = `select * from ${identifier(table)}${where}`;
        if (url.searchParams.get('order')) {
          const [column, direction] = url.searchParams.get('order').split('.');
          sql += ` order by ${identifier(column)} ${direction === 'desc' ? 'desc' : 'asc'}`;
        }
        const range = options.headers?.Range?.split('-').map(Number);
        if (range) sql += ` limit ${range[1] - range[0] + 1} offset ${range[0]}`;
        else if (url.searchParams.get('limit')) sql += ` limit ${Number(url.searchParams.get('limit'))}`;
        result = await db.query(sql, values);
      } else if (method === 'POST') {
        const row = JSON.parse(options.body);
        const keys = Object.keys(row);
        result = await db.query(`insert into ${identifier(table)} (${keys.map(identifier)}) values (${keys.map((_, i) => '$' + (i + 1))}) returning *`, Object.values(row));
      } else if (method === 'PATCH') {
        const row = JSON.parse(options.body);
        const fields = Object.entries(row).map(([key, value]) => { values.push(value); return `${identifier(key)} = $${values.length}`; });
        result = await db.query(`update ${identifier(table)} set ${fields.join(',')}${where} returning *`, values);
      } else throw new Error('Unexpected test method');
      return new Response(JSON.stringify(result.rows), { status: 200 });
    } catch (error) {
      return new Response(JSON.stringify({ message: error.message }), { status: 400 });
    }
  };
}

module.exports = { makeDb, restFetch, migration };
