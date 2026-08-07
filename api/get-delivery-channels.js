const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-delivery-channels');

module.exports = adapt(handler);
