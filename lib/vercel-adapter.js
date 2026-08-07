// Adapts a Netlify Functions handler to a Vercel Node serverless function.
//
// Netlify handler signature:  async (event) => ({ statusCode, headers, body })
//   event: { httpMethod, headers, body, queryStringParameters }
// Vercel handler signature:   async (req, res) => void
//
// This lets netlify/functions/*.js stay byte-for-byte unchanged.

function readRawBody(req) {
  // Vercel's Node runtime parses the body ahead of us for known content types.
  if (typeof req.body === 'string') return Promise.resolve(req.body);
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString('utf8'));
  if (req.body && typeof req.body === 'object') return Promise.resolve(JSON.stringify(req.body));

  // Stream already consumed (or empty) — never wait on an ended stream.
  if (!req.readable) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function queryStringParameters(req) {
  if (req.query && typeof req.query === 'object') {
    // req.query values can be arrays for repeated keys; Netlify gives the last one.
    const params = {};
    for (const [key, value] of Object.entries(req.query)) {
      params[key] = Array.isArray(value) ? value[value.length - 1] : value;
    }
    return params;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  return Object.fromEntries(url.searchParams);
}

module.exports = function adapt(handler) {
  return async function vercelHandler(req, res) {
    try {
      const response = await handler({
        httpMethod: req.method,
        headers: req.headers,
        body: await readRawBody(req),
        queryStringParameters: queryStringParameters(req)
      });

      const { statusCode = 200, headers = {}, body = '' } = response || {};
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
      }
      res.statusCode = statusCode;
      res.end(body);
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: error.message }));
    }
  };
};
