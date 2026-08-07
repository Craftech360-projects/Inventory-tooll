// Single dynamic route that dispatches to every backend handler.
//
// Vercel counts each file under api/ as a separate Serverless Function, and the
// Hobby plan allows 12. One dynamic route keeps us at 1 regardless of how many
// handlers exist.
//
// The requires below are static on purpose: Vercel's bundler traces them and
// includes each handler in this function's bundle. A dynamic
// require(`../netlify/functions/${name}`) would build fine and then 404 at
// runtime, because nothing would have been bundled.

const adapt = require('../lib/vercel-adapter');

const routes = {
  'add-item': require('../netlify/functions/add-item'),
  'delete-delivery-channel': require('../netlify/functions/delete-delivery-channel'),
  'delete-item': require('../netlify/functions/delete-item'),
  'get-build-items': require('../netlify/functions/get-build-items'),
  'get-builds': require('../netlify/functions/get-builds'),
  'get-daily-log': require('../netlify/functions/get-daily-log'),
  'get-dc-items': require('../netlify/functions/get-dc-items'),
  'get-delivery-channels': require('../netlify/functions/get-delivery-channels'),
  'get-employees': require('../netlify/functions/get-employees'),
  'get-inventory': require('../netlify/functions/get-inventory'),
  'get-purchase-requests': require('../netlify/functions/get-purchase-requests'),
  'get-vendors': require('../netlify/functions/get-vendors'),
  'supabase-action': require('../netlify/functions/supabase-action'),
  'update-item': require('../netlify/functions/update-item')
};

function routeName(req) {
  // Vercel populates the [fn] path segment into req.query.
  if (req.query && req.query.fn) {
    return Array.isArray(req.query.fn) ? req.query.fn[0] : req.query.fn;
  }
  // Fallback: last path segment, e.g. /api/get-inventory?_=123
  const pathname = (req.url || '').split('?')[0].replace(/\/+$/, '');
  return decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
}

module.exports = async function dispatch(req, res) {
  const name = routeName(req);
  const mod = routes[name];

  if (!mod || typeof mod.handler !== 'function') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 404;
    res.end(JSON.stringify({ error: `Unknown function: ${name}` }));
    return;
  }

  // `fn` is the route param, not a real query string param — don't leak it
  // into handlers that read queryStringParameters.
  if (req.query && 'fn' in req.query) {
    req.query = { ...req.query };
    delete req.query.fn;
  }

  return adapt(mod.handler)(req, res);
};
