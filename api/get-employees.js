const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-employees');

module.exports = adapt(handler);
