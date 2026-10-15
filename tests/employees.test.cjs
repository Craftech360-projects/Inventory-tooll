const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { makeDb, restFetch, migration } = require('./helpers/employee-db.cjs');
process.env.SUPABASE_URL = 'https://inventory-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-key';
const actions = require('../netlify/functions/supabase-action');
const directory = require('../netlify/functions/get-employees');
const { normalizeEmployee } = require('../netlify/functions/lib/employee-records');

async function action(name, payload, method = 'POST') {
  const response = await actions.handler({ httpMethod: method, queryStringParameters: { action: name }, body: JSON.stringify(payload) });
  return { status: response.statusCode, ...JSON.parse(response.body) };
}
async function list() { return JSON.parse((await directory.handler()).body); }
const source = [{ id: 'source-1', employee_id: 'EMP-1', name: 'Original Name', title: 'Engineer',
  date_of_hiring: '2020-02-29', onboard: { phone: '123456', custom: 'preserve' },
  extra_fields: { confidential: 'retained' }, asset_assignments: [
    { id: 'legacy-1', itemId: 'IT-1', itemName: 'Laptop', assignedDate: '2024-01-01', status: 'Active' }
  ] }];

test('employee CRUD, archive/restore and asset lifecycle preserve originals and links', async t => {
  const db = await makeDb(source);
  const fetchBefore = global.fetch;
  global.fetch = restFetch(db);
  t.after(async () => { global.fetch = fetchBefore; await db.close(); });
  await db.exec(migration);
  const original = (await db.query('select to_jsonb(e) as row from employees e')).rows;
  const originalSource = (await db.query('select source_record from inventory_employees')).rows[0].source_record;
  assert.deepEqual(originalSource, source[0]);
  let result = await list();
  assert.equal(result.employees.length, 1);
  assert.equal(result.assets.length, 1);
  assert.equal(result.employees[0].phone, '123456');
  assert.equal(result.migrationRequired, false);
  assert.equal((await action('archiveEmployee', { empId: 'EMP-1' })).success, false);
  assert.match((await action('archiveEmployee', { empId: 'EMP-1' })).error, /Return all active/);
  assert.equal((await action('updateEmployee', { empId: 'EMP-1', name: 'Inventory Edit', phone: '' })).success, true);
  assert.equal((await list()).employees[0].name, 'Inventory Edit');
  assert.equal((await list()).employees[0].phone, '');
  assert.deepEqual((await db.query('select source_record from inventory_employees')).rows[0].source_record, source[0]);
  assert.equal((await action('updateEmployee', { empId: 'EMP-1', employeeId: 'CHANGED', name: 'Bad' })).success, false);
  await db.exec(`insert into items values ('IT-1', 2, 1, 'Partially In Use')`);
  assert.equal((await action('returnAsset', { id: 'legacy-1', returnedDate: '2026-10-15' })).success, true);
  assert.equal((await db.query('select "In Use Qty" as qty from items')).rows[0].qty, 0);
  assert.equal((await action('returnAsset', { id: 'legacy-1', returnedDate: '2026-10-15' })).success, true);
  assert.equal((await action('archiveEmployee', { empId: 'EMP-1' })).success, true);
  assert.ok((await list()).employees[0].archivedAt);
  assert.equal((await list()).assets[0].status, 'Returned');
  assert.equal((await action('assignAsset', { empId: 'EMP-1', itemId: 'IT-1', id: 'new-asset' })).success, false);
  assert.equal((await action('createEmployee', { empId: 'EMP-1', name: 'Duplicate' })).success, false);
  assert.equal((await action('restoreEmployee', { empId: 'EMP-1' })).success, true);
  assert.equal((await action('assignAsset', { empId: 'EMP-1', itemId: 'IT-1', id: 'new-asset', assignedDate: '2026-10-15' })).success, true);
  assert.equal((await db.query('select "In Use Qty" as qty from items')).rows[0].qty, 1);
  const specialId = `EMP-'"<&`;
  assert.equal((await action('createEmployee', { empId: specialId, name: `O'Neil <Test>`, joinDate: '2024-02-29' })).success, true);
  assert.equal((await action('updateEmployee', { empId: specialId, department: 'Inventory' })).success, true);
  for (const payload of [{empId: 'BAD',name: ''}, {empId: 'BAD',name: 'Test',email: 'bad'},
    {empId: 'BAD',name: 'Test',joinDate: '2025-02-29'}, {empId: 'BAD',name: {value: 'bad'}}]) {
    assert.equal((await action('createEmployee', payload)).success, false);
  }
  assert.equal((await action('createEmployee', {empId: 'GET',name: 'Test'}, 'GET')).status, 405);
  await db.exec(migration);
  result = await list();
  assert.equal(result.employees.length, 2);
  assert.equal(result.employees.find(e => e.empId === 'EMP-1').name, 'Inventory Edit');
  assert.equal(result.assets.find(a => a.id === 'legacy-1').status, 'Returned');
  assert.equal(result.assets.length, 2);
  assert.deepEqual((await db.query('select to_jsonb(e) as row from employees e')).rows, original);
  await assert.rejects(db.exec(`delete from inventory_employees where employee_id='EMP-1'`), /archived/);
  await assert.rejects(db.exec(`update inventory_employees set employee_id='OTHER' where employee_id='EMP-1'`), /cannot be changed/);
  await assert.rejects(db.exec(`update inventory_employees set archived_at=now() where employee_id='EMP-1'`), /Return all active/);
  await db.exec(`update inventory_employees set archived_at=now() where employee_id <> 'EMP-1'`);
  await assert.rejects(db.query(`insert into employee_assets(id,employee_id) values ('bad',$1)`, [specialId]), /Restore/);
  await assert.rejects(db.exec(`insert into employee_assets(id,employee_id) values ('missing','MISSING')`), /not found/);
  await db.exec('set role anon');
  await assert.rejects(db.exec('select * from inventory_employees'), /permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.exec('select * from inventory_employees'), /permission denied/);
  await db.exec('reset role; set role service_role');
  assert.equal((await db.query('select count(*)::int as count from inventory_employees')).rows[0].count, 2);
});

test('before migration records remain readable and management fails explicitly', async t => {
  const db = await makeDb(source);
  const oldFetch = global.fetch; global.fetch = restFetch(db);
  t.after(async () => { global.fetch = oldFetch; await db.close(); });
  const result = await list();
  assert.equal(result.success, true);
  assert.equal(result.migrationRequired, true);
  assert.equal(result.employees.length, 1);
  assert.equal(result.assets.length, 1);
  assert.match((await action('createEmployee', {empId: 'NEW',name: 'Test'})).error, /sql applied/);
});

test('assignment and directory failures are reported instead of appearing as missing data', async t => {
  const db = await makeDb(source);
  const oldFetch = global.fetch;
  t.after(async () => { global.fetch = oldFetch; await db.close(); });
  await db.exec(migration);
  const adapter = restFetch(db);
  for (const table of ['inventory_employees', 'employee_assets']) {
    global.fetch = async (url, options) => new URL(url).pathname.endsWith('/' + table)
      ? new Response(JSON.stringify({message: 'Temporary read failure'}), {status:503})
      : adapter(url, options);
    const result = await list();
    assert.equal(result.success, false);
    assert.match(result.error, /Temporary read failure/);
    assert.equal(result.employees, undefined);
  }
});

test('migration handles alternate schemas, missing asset IDs and invalid calendar dates', async t => {
  const employees = [{ id: 'fallback', full_name: 'Alternate', designation: 'Designer', mobile: '555', assets: [
    { item_name: 'Mouse', assigned_date: '2025-02-30', returned_date: 'invalid', status: 'Returned' }
  ], unknown_field: { keep: true } }];
  const db = await makeDb(employees); t.after(() => db.close());
  await db.exec(migration);
  const rows = (await db.query('select * from inventory_employees')).rows;
  assert.equal(rows[0].employee_id, 'fallback');
  assert.equal(rows[0].role, 'Designer');
  assert.deepEqual(rows[0].source_record, employees[0]);
  const assets = (await db.query('select * from employee_assets')).rows;
  assert.equal(assets[0].id, 'EA-LEGACY-fallback-1');
  assert.equal(assets[0].assigned_date, null);
  assert.equal(assets[0].returned_date, null);
});

test('unsafe source IDs and conflicting assignment IDs cancel the whole migration', async t => {
  for (const [rows, assets, message] of [
    [[{name: 'Missing ID'}], [], /missing an ID/],
    [[{employee_id: 'DUP'}, {employee_id: 'DUP'}], [], /Duplicate employee IDs/],
    [source, [{id: 'legacy-1',employee_id: 'OTHER'}], /different employee/],
    [[{employee_id: 'EMP-1',asset_assignments:[{id:'dup'},{id:'dup'}]}], [], /Duplicate legacy/]
  ]) {
    const db = await makeDb(rows, assets);
    try {
      await assert.rejects(db.exec(migration), message);
      await db.exec('rollback');
      assert.equal((await db.query("select to_regclass('public.inventory_employees') as name")).rows[0].name, null);
      assert.equal((await db.query('select count(*)::int as count from employees')).rows[0].count, rows.length);
      assert.equal((await db.query('select count(*)::int as count from employee_assets')).rows[0].count, assets.length);
    } finally { await db.close(); }
  }
});

test('employee and assignment reads include every page beyond 1000 records', async t => {
  const employees = Array.from({length:1005}, (_, i) => ({id:`row-${i}`, employee_id:`EMP-${i}`,name:`Person ${i}`}));
  const db = await makeDb(employees); const oldFetch = global.fetch; global.fetch = restFetch(db);
  t.after(async () => {global.fetch=oldFetch;await db.close();});
  await db.exec(migration);
  await db.exec(`insert into employee_assets(id,employee_id,status)
    select 'A-' || n, 'EMP-' || n, 'Returned' from generate_series(0,1004) n`);
  const result = await list();
  assert.equal(result.employees.length,1005);
  assert.equal(result.assets.length,1005);
});

test('backed-up production records migrate without changing employees or existing assignments',
  {skip: !process.env.EMPLOYEE_BACKUP}, async t => {
  const snapshot = JSON.parse(fs.readFileSync(process.env.EMPLOYEE_BACKUP,'utf8')).tables;
  const db = await makeDb(snapshot.employees, snapshot.employee_assets); t.after(() => db.close());
  const beforeEmployees = (await db.query('select to_jsonb(e) as row from employees e order by id')).rows;
  const beforeAssets = (await db.query('select to_jsonb(a) as row from employee_assets a order by id')).rows;
  await db.exec(migration); await db.exec(migration);
  assert.deepEqual((await db.query('select to_jsonb(e) as row from employees e order by id')).rows, beforeEmployees);
  assert.deepEqual((await db.query('select to_jsonb(a) as row from employee_assets a order by id')).rows, beforeAssets);
  const copied = (await db.query('select * from inventory_employees')).rows;
  assert.equal(copied.length, snapshot.employees.length);
  for (const original of snapshot.employees) {
    const expected = normalizeEmployee(original);
    const target = copied.find(row => row.employee_id === expected.empId);
    assert.ok(target);
    assert.deepEqual(target.source_record, original);
    const actual = normalizeEmployee({...target,asset_assignments:target.legacy_assets});
    for (const field of ['empId','name','role','joinDate','department','email','phone','manager','location']) {
      assert.equal(actual[field], expected[field], `Field mapping: ${field}`);
    }
  }
});
