'use strict';

// Auth quarantine (ADR-0003): ALL token generation and verification lives in
// this module. No other file may mint, extract, or compare tokens.
//
// The token exists because annotations are instructions an autonomous agent
// will act on: without it, any website open in the browser could blind-POST
// forged "user feedback" to this loopback port. Every daemon route requires
// the token, presented either as `?t=…` (doc URLs opened in a browser) or as
// `Authorization: Bearer …` (CLI calls).
const crypto = require('node:crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function extractToken(req, url) {
  const fromQuery = url.searchParams.get('t');
  if (fromQuery) return fromQuery;
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }
  return null;
}

function verifyToken(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isAuthorized(req, url, expectedToken) {
  return verifyToken(extractToken(req, url), expectedToken);
}

module.exports = { generateToken, extractToken, verifyToken, isAuthorized };
