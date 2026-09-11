'use strict';
const { createHash } = require('node:crypto');

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
function originOf(req) {
  const host = process.env.APP_URL ? new URL(process.env.APP_URL).host : req.headers.host;
  const protocol = host?.startsWith('localhost:') || host?.startsWith('127.0.0.1:') ? 'http:' : 'https:';
  return `${protocol}//${host}`;
}
function allowRequest(req, res, { publicRead = false } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  const own = originOf(req);
  if (publicRead) res.setHeader('Vary', 'Origin');
  // The old GitHub Pages site can read public product data, never account data.
  if (publicRead && origin === 'https://poilon.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (origin && origin !== own) {
    throw new HttpError(403, 'Cette connexion ne vient pas de l’application Miamama.');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin !== own) throw new HttpError(403, 'Rechargez Miamama avant de réessayer.');
}
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function handler(fn, options) {
  return async (req, res) => {
    try { allowRequest(req, res, options); await fn(req, res); }
    catch (error) {
      const status = error.status || 503;
      if (status === 429) res.setHeader('Retry-After', '60');
      json(res, status, { error: error.status ? error.message : 'Le service ne répond pas pour le moment. Réessayez dans un instant.', ...error.details });
      if (!error.status) console.error('Miamama service error:', error.name, error.code || 'upstream');
    }
  };
}
async function readJSON(req, maxBytes = 250000) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Un document JSON est attendu.');
  if (Number(req.headers['content-length']) > maxBytes) throw new HttpError(413, 'Le document est trop volumineux.');
  let text;
  if (req.body !== undefined) text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += Buffer.byteLength(chunk); if (size > maxBytes) throw new HttpError(413, 'Le document est trop volumineux.'); chunks.push(chunk); }
    text = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(text || '') > maxBytes) throw new HttpError(413, 'Le document est trop volumineux.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Le document est illisible.'); }
}
function ipKey(req) {
  const address = process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] : req.socket?.remoteAddress;
  return createHash('sha256').update(String(address || 'unknown').split(',')[0] + new Date().toISOString().slice(0, 10)).digest('hex').slice(0, 32);
}
module.exports = { HttpError, originOf, handler, json, readJSON, ipKey };
