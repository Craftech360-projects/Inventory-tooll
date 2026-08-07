const adapt = require('../lib/vercel-adapter');
const { handler } = require('../netlify/functions/get-builds');

module.exports = adapt(handler);
