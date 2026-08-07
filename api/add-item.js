const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/add-item');

module.exports = adapt(handler);
