const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { JSDOM, VirtualConsole } = require('jsdom');
const { makeDb, restFetch, migration } = require('./helpers/employee-db.cjs');
process.env.SUPABASE_URL = 'https://inventory-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-key';
const dispatch = require('../api/[fn].js');
const root = path.join(__dirname, '..');

async function until(condition) {
  const end = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > end) throw new Error('UI condition did not complete');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function setup(t, migrate = true) {
  const db = await makeDb([{ id: 'row1', employee_id: 'EMP-1', name: 'Existing Employee', title: 'Engineer',
    asset_assignments: [{id: 'history', itemName: 'Returned laptop', status: 'Returned', assignedDate: '2025-01-01', returnedDate: '2026-01-01'}] }]);
  if (migrate) await db.exec(migration);
  const realFetch = global.fetch;
  global.fetch = restFetch(db);
  const server = http.createServer((req, res) => dispatch(req, res));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError',error => errors.push(error.message));
  const dom = new JSDOM(html, {url, runScripts:'dangerously', virtualConsole: console});
  const {window} = dom;
  if (window.document.readyState !== 'complete') await once(window,'load');
  window.fetch = (input, options) => realFetch(new URL(input, url), options);
  window.alert = message => { throw new Error(message); };
  window.scrollTo = () => {};
  const script = window.document.createElement('script');
  script.textContent = fs.readFileSync(path.join(root,'app.js'),'utf8');
  window.document.body.appendChild(script);
  // App initialization has already occurred in this focused page harness.
  // Wire its existing confirmation controls without loading unrelated app data.
  window.document.getElementById('appConfirmOk').addEventListener('click', () => window.resolveAppConfirm(true));
  window.document.getElementById('appConfirmCancel').addEventListener('click', () => window.resolveAppConfirm(false));
  window.setupNavigation();
  t.after(async () => {dom.window.close(); await new Promise(resolve => server.close(resolve)); global.fetch = realFetch; await db.close();});
  const document = window.document;
  const clickText = (selector,text) => {
    const element = [...document.querySelectorAll(selector)].find(el=>el.textContent.trim()===text);
    assert.ok(element, `Missing control: ${text}`); element.click();
  };
  document.querySelector('[data-view="employeeAssets"]').click();
  await until(()=>document.querySelector('#employeesList .employee-card'));
  return {db, window, document, clickText, errors};
}

test('page controls create, edit, archive, filter, export and restore through HTTP and PostgreSQL', async t => {
  const {db,window,document,clickText,errors} = await setup(t);
  const input = (id,value) => {document.getElementById(id).value=value;};
  const active = id => document.getElementById(id).classList.contains('active');
  document.getElementById('addEmployeeButton').click();
  assert.ok(active('employeeFormView'));
  const specialId = `INV-'"<&`;
  input('employeeFormId', specialId);
  input('employeeFormName', `O'Neil <Inventory>`);
  input('employeeFormDepartment','Operations');
  input('employeeFormEmail','inventory@example.test');
  input('employeeFormPhone','12345');
  input('employeeFormManager','Manager');
  input('employeeFormLocation','Office');
  document.getElementById('employeeSaveButton').click();
  await until(()=>active('employeeDetailView'));
  assert.equal(document.querySelector('#employeeDetailContent h2').textContent, `O'Neil <Inventory>`);
  assert.equal(document.querySelector('#employeeDetailContent inventory'),null);
  clickText('#employeeDetailContent button','Edit Employee');
  assert.equal(document.getElementById('employeeFormId').readOnly,true);
  input('employeeFormName','Inventory Edited'); input('employeeFormPhone','');
  document.getElementById('employeeSaveButton').click();
  await until(()=>active('employeeDetailView') && document.querySelector('#employeeDetailContent h2').textContent==='Inventory Edited');
  const saved = (await db.query('select * from inventory_employees where employee_id=$1',[specialId])).rows[0];
  assert.equal(saved.phone,''); assert.equal(saved.department,'Operations');
  assert.equal(saved.manager,'Manager'); assert.equal(saved.location,'Office');
  clickText('#employeeDetailContent button','Delete Employee');
  await until(()=>document.getElementById('appConfirmModal').classList.contains('active'));
  assert.match(document.getElementById('appConfirmNote').textContent,/history will be kept/);
  document.getElementById('appConfirmOk').click();
  await until(()=>[...document.querySelectorAll('#employeeDetailContent button')].some(el=>el.textContent==='Restore Employee'));
  window.switchView('employeeAssets');
  await window.loadEmployeesData(); window.renderEmployees();
  assert.equal(document.querySelectorAll('#employeesList .employee-card').length,1);
  document.getElementById('employeeStatusFilter').value='archived'; window.filterEmployees();
  assert.equal(document.querySelectorAll('#employeesList .employee-card').length,1);
  assert.match(document.querySelector('#employeesList').textContent,/Inventory Edited/);
  assert.equal(window.employeeAssetsExportRows().length,1);
  window.openAssignAsset(); window.filterAssignEmployees();
  assert.doesNotMatch(document.getElementById('assignEmployeeResults').textContent,/Inventory Edited/);
  window.switchView('employeeAssets'); await window.loadEmployeesData(); window.renderEmployees();
  document.querySelector('#employeesList .employee-card').click();
  assert.ok(active('employeeDetailView')); // Special characters in IDs survive the click handler.
  clickText('#employeeDetailContent button','Restore Employee');
  await until(()=>[...document.querySelectorAll('#employeeDetailContent button')].some(el=>el.textContent==='Delete Employee'));
  window.openEmployeeForm(); input('employeeFormId',specialId); input('employeeFormName','Duplicate');
  document.getElementById('employeeSaveButton').click();
  await until(()=>!document.getElementById('employeeFormError').hidden);
  assert.match(document.getElementById('employeeFormError').textContent,/already exists/);
  assert.equal(document.getElementById('employeeFormName').value,'Duplicate');
  assert.equal(document.getElementById('employeeSaveButton').disabled,false);
  assert.deepEqual(errors,[]);
  assert.equal((await db.query('select count(*)::int as count from employees')).rows[0].count,1);
  assert.equal((await db.query('select name from employees')).rows[0].name,'Existing Employee');
  assert.equal((await db.query('select count(*)::int as count from employee_assets')).rows[0].count,1);
});

test('page preserves the employee list and clearly disables management until SQL is applied', async t => {
  const {document,errors}=await setup(t,false);
  assert.equal(document.querySelectorAll('#employeesList .employee-card').length,1);
  assert.equal(document.getElementById('addEmployeeButton').disabled,true);
  assert.equal(document.getElementById('employeeMigrationNotice').hidden,false);
  assert.match(document.getElementById('employeeMigrationNotice').textContent,/database-inventory-employees-plan.sql/);
  assert.deepEqual(errors,[]);
});
