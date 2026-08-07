const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/update-item');

module.exports = adapt(handler);
