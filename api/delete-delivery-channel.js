const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/delete-delivery-channel');

module.exports = adapt(handler);
