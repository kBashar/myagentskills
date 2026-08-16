'use strict';

// Minimal loopback HTTP client over node:http — the wire the CLI uses to
// talk to the daemon (and the shape later adapters follow). Deliberately
// dependency-free.
const http = require('node:http');

// request({ port, path, method, token, body, timeout })
//   → Promise<{ status, headers, body: Buffer }>
// `token` is sent as `Authorization: Bearer …`; doc GETs may instead carry
// `?t=…` in `path`. `body`, when non-null, is sent as JSON.
function request({ port, path: reqPath, method = 'GET', token = null, body = null, timeout = 5000 }) {
  return new Promise((resolve, reject) => {
    const headers = {};
    let payload = null;
    if (token) headers.authorization = `Bearer ${token}`;
    if (body != null) {
      payload = Buffer.from(JSON.stringify(body));
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    const req = http.request({ host: '127.0.0.1', port, path: reqPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(timeout, () => req.destroy(new Error(`request to 127.0.0.1:${port}${reqPath} timed out`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function get(port, token, reqPath) {
  return request({ port, token, path: reqPath });
}

function post(port, token, reqPath, body) {
  return request({ port, token, path: reqPath, method: 'POST', body });
}

module.exports = { request, get, post };
