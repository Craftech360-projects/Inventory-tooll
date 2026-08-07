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
`api/*.js` become serverless functions.

Required environment variables (Project Settings -> Environment Variables, all environments):

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |

### How the routing works

The frontend calls `/.netlify/functions/<name>`. `vercel.json` rewrites those to `/api/<name>`,
and each `api/<name>.js` is a three-line wrapper that hands the request to the original handler
in `netlify/functions/<name>.js` via `lib/vercel-adapter.js`. The business logic is shared, so
there is one copy of every function.

`netlify.toml` is kept so the project can still be deployed to Netlify unchanged if needed.
