'use strict';
const { HttpError } = require('./http.cjs');
function authURL(path) {
  if (!process.env.NEON_AUTH_BASE_URL) throw new HttpError(503, 'La connexion aux comptes n’est pas configurée.');
  return process.env.NEON_AUTH_BASE_URL.replace(/\/$/, '') + '/' + path;
}
function sessionCookies(value = '', local = false) {
  return value.split(';').map(s => s.trim()).filter(s => /^(?:__Secure-|__Host-)?(?:neon-auth|better-auth|neonauth)[\w.-]*=/.test(s)).map(s => local && s.startsWith('neon-auth.') ? '__Secure-' + s : s).join('; ');
}
async function getSession(req) {
  const response = await fetch(authURL('get-session'), { headers: { Cookie: sessionCookies(req.headers.cookie, require('./http.cjs').originOf(req).startsWith('http:')), 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new HttpError(503, 'Impossible de vérifier votre connexion pour le moment.');
  const session = await response.json();
  return session?.user?.id ? session : null;
}
async function requireUser(req) {
  const session = await getSession(req);
  if (!session) throw new HttpError(401, 'Reconnectez-vous pour retrouver votre carnet en ligne.');
  return session.user;
}
function publicSession(data) {
  if (!data || typeof data !== 'object') return data;
  const result = { ...data };
  delete result.token;
  if (result.session) { result.session = { expiresAt: result.session.expiresAt }; }
  if (result.user) {
    const { id, name, email, emailVerified } = result.user;
    result.user = { id, name, email, emailVerified };
  }
  return result;
}
module.exports = { authURL, sessionCookies, getSession, requireUser, publicSession };
