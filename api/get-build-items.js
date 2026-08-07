const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-build-items');

module.exports = adapt(handler);
