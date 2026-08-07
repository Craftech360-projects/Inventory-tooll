const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-inventory');

module.exports = adapt(handler);
