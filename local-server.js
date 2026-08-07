const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);

function loadDotEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    ...headers
  });
  res.end(body);
}

// Both prefixes hit the same handlers: /.netlify/functions/* is what the frontend
// calls, /api/* is the path Vercel serves (vercel.json rewrites one to the other).
const FUNCTION_PREFIXES = ['/.netlify/functions/', '/api/'];

async function handleFunction(req, res, pathname) {
  const prefix = FUNCTION_PREFIXES.find(p => pathname.startsWith(p));
  const functionName = pathname.slice(prefix.length);
  const functionPath = path.join(root, 'netlify', 'functions', `${functionName}.js`);

  if (!/^[a-zA-Z0-9_-]+$/.test(functionName) || !fs.existsSync(functionPath)) {
    send(res, 404, JSON.stringify({ error: 'Function not found' }), {
      'Content-Type': 'application/json'
    });
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      delete require.cache[require.resolve(functionPath)];
      const fn = require(functionPath);
      const response = await fn.handler({
        httpMethod: req.method,
        headers: req.headers,
        body,
        queryStringParameters: Object.fromEntries(new URL(req.url, `http://${req.headers.host}`).searchParams)
      });

      send(res, response.statusCode || 200, response.body || '', response.headers || {});
    } catch (error) {
      send(res, 500, JSON.stringify({ error: error.message }), {
        'Content-Type': 'application/json'
      });
    }
  });
}

function handleStatic(req, res, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (FUNCTION_PREFIXES.some(p => url.pathname.startsWith(p))) {
    handleFunction(req, res, url.pathname);
    return;
  }

  handleStatic(req, res, decodeURIComponent(url.pathname));
});

server.listen(port, () => {
  console.log(`Local inventory server running at http://localhost:${port}`);
});
