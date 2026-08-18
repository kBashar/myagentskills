// Auth quarantine (ADR-0003): ALL token generation, token verification, and
// token-scoped URL construction lives in this module. No other file may mint,
// extract, compare, or embed tokens into URLs.
//
// The token exists because annotations are instructions an autonomous agent
// will act on: without it, any website open in the browser could blind-POST
// forged "user feedback" to this loopback port. Every daemon route requires
// the token, presented either as `?t=…` (doc URLs opened in a browser) or as
// `Authorization: Bearer …` (CLI calls).
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function extractToken(req: IncomingMessage, url: URL): string | null {
  const fromQuery = url.searchParams.get('t');
  if (fromQuery) return fromQuery;
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  return null;
}

export function verifyToken(provided: string | null, expected: string | null): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAuthorized(req: IncomingMessage, url: URL, expectedToken: string): boolean {
  return verifyToken(extractToken(req, url), expectedToken);
}

// The only place a token-scoped URL (?t=…) is constructed (review finding,
// issue #2). Anything handed to a browser — doc URLs now, later the endpoints
// the injected layer calls — must go through here, so the query-parameter
// contract exists in exactly one module.
export function scopedUrl(base: string, token: string): string {
  return `${base}${base.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}
