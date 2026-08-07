# Inventory Tool

Static frontend (`index.html` / `app.js` / `styles.css`) plus serverless functions that proxy to Supabase.
All data lives in Supabase — the host is stateless.

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
