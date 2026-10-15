# Inventory Tool

Static frontend (`index.html` / `app.js` / `styles.css`) plus serverless functions that proxy to Supabase.
All data lives in Supabase — the host is stateless.

## Inventory employee management

Before deploying this employee-management change:

1. Back up the current directory and assignments:
   `node --env-file=.env scripts/backup-employees.cjs`.
   The private backup is saved under your home directory in `.codex/backups/inventory-employees`, outside the website.
2. Run the **entire** `database-inventory-employees-plan.sql` file in the inventory
   Supabase project's SQL Editor. It includes the employee-assets setup; the older
   `database-employee-assets-plan.sql` does not also need to be run.
3. Compare the returned counts with the backup, then run the read-only verifier:
   `node --env-file=.env scripts/verify-employee-migration.cjs "<backup path>"`.
   It should report `migrationRequired: false`.
4. Deploy the app through the existing deployment workflow.

The migration runs in one transaction, aborts on missing/duplicate employee IDs or
conflicting assignment IDs, and preserves the original `employees` table and its
triggers. `inventory_employees.source_record` holds each complete original row;
`legacy_assets` also preserves original assignment JSON. Rerunning the SQL never
overwrites inventory edits, archive state, or existing assignment/return records.
New assignment IDs and employees are copied without changing inventory quantities.

Employee Assets now offers Add Employee and, on each employee's detail page,
Edit Employee and Delete Employee. Delete archives the employee and requires all
active assets to be returned first. Select **Archived employees** to view history
or restore an employee. IDs cannot be changed, preserving asset links. The
assignment picker excludes archived employees; exports follow the status filter.

Until the SQL is applied, employees remain readable from the original table and
management controls show a setup notice. No employee writes fall back to that table.
The backend requires `SUPABASE_SERVICE_ROLE_KEY`; browser roles have no access to
the inventory employee table.

Run `npm test` for the migration, API and DOM/HTTP integration tests. To also
exercise the migration against a private production snapshot, set
`EMPLOYEE_BACKUP` to its backup path before running tests. Tests use an isolated
PostgreSQL database and intercept all database requests; they never write to Supabase.

For an application rollback, redeploy the previous app version and leave both
inventory tables in place. Inventory edits are retained in `inventory_employees`
but will not be shown by the old app. Do not drop the new tables or restore an old
backup over newer assignments. This change is inventory-only; HR's database is
never contacted by the migration or the new employee actions.

## Local development

```
npm install
npm start          # http://localhost:3000
```

`local-server.js` serves the static files and runs the functions from `netlify/functions/`
under `/.netlify/functions/*`. It reads credentials from a local `.env` file:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

## Deployment (Vercel)

Hosted on Vercel. No build step — static files are served from the repo root and
`api/[fn].js` is the single serverless function handling every backend route.

Required environment variables (Project Settings -> Environment Variables, all environments):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |

### How the routing works

The frontend calls `/.netlify/functions/<name>`. `vercel.json` rewrites those to `/api/<name>`,
which resolves to the dynamic route `api/[fn].js`. That file looks `<name>` up in a static
require map and hands the request to the original handler in `netlify/functions/<name>.js`
via `lib/vercel-adapter.js`. The business logic is shared, so there is one copy of every function.

It is deliberately ONE file rather than one per route: Vercel counts each file under `api/` as a
separate Serverless Function, and the Hobby plan allows a maximum of 12. Adding a new backend
route means adding a handler in `netlify/functions/` and one line to the map in `api/[fn].js` —
the function count stays at 1.

`netlify.toml` is kept so the project can still be deployed to Netlify unchanged if needed.
