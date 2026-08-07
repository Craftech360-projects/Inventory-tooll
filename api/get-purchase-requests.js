const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-purchase-requests');

module.exports = adapt(handler);
