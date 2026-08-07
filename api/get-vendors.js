const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-vendors');

module.exports = adapt(handler);
