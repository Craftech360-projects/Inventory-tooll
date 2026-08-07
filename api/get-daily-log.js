const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-daily-log');

module.exports = adapt(handler);
