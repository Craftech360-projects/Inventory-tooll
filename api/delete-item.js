const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/delete-item');

module.exports = adapt(handler);
