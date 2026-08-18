// Minimal loopback HTTP client over node:http — the wire the CLI uses to
// talk to the daemon (and the shape later adapters follow). Deliberately
// dependency-free.
import { request as httpRequest } from 'node:http';
import type { IncomingMessage } from 'node:http';

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export interface RequestArgs {
  port: number;
  path: string;
  method?: string;
  token?: string | null;
  body?: unknown;
  timeout?: number;
}

// `token` is sent as `Authorization: Bearer …`. Token-scoped URLs (?t=…),
// for contexts without header control (a browser bar), are built only by the
// auth module. `body`, when non-null, is sent as JSON.
export function request({
  port,
  path: reqPath,
  method = 'GET',
  token = null,
  body = null,
  timeout = 5000,
}: RequestArgs): Promise<HttpResponse> {
  return new Promise((resolvePromise, reject) => {
    const headers: Record<string, string | number> = {};
    let payload: Buffer | null = null;
    if (token) headers.authorization = `Bearer ${token}`;
    if (body != null) {
      payload = Buffer.from(JSON.stringify(body));
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    }
    const req = httpRequest({ host: '127.0.0.1', port, path: reqPath, method, headers }, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolvePromise({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.setTimeout(timeout, () => req.destroy(new Error(`request to 127.0.0.1:${port}${reqPath} timed out`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export function get(port: number, token: string | null, reqPath: string): Promise<HttpResponse> {
  return request({ port, token, path: reqPath });
}

export function post(port: number, token: string | null, reqPath: string, body: unknown): Promise<HttpResponse> {
  return request({ port, token, path: reqPath, method: 'POST', body });
}
