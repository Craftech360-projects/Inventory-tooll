const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/supabase-action');

module.exports = adapt(handler);
