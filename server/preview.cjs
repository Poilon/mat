'use strict';
const { createHash } = require('node:crypto');
const { HttpError, originOf } = require('./http.cjs');
const COOKIE = 'poum-access-preview';
// This cookie is only a display preference. Authorization always comes from
// the verified account returned by Neon, never from a client-supplied email.
function eligible(user) {
  return Boolean(user?.id && user.emailVerified === true && user.email?.toLowerCase() === 'poilon@gmail.com');
}
function identity(user) { return createHash('sha256').update(user.id).digest('hex'); }
function preview(req, user) {
  if (!eligible(user)) return { eligible: false, mode: 'auto', ...(user?.id && user.email?.toLowerCase() === 'poilon@gmail.com' ? { requiresVerification: true } : {}) };
  const value = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  const [owner, mode] = (value || '').split('.');
  return { eligible: true, mode: owner === identity(user) && ['free', 'plus'].includes(mode) ? mode : 'auto' };
}
function select(req, res, user, mode) {
  if (!eligible(user)) throw new HttpError(403, 'Ce mode est réservé au compte de test dont l’adresse e-mail est vérifiée.');
  if (!['free', 'plus', 'auto'].includes(mode)) throw new HttpError(400, 'Choisissez le mode gratuit, Plus ou votre accès réel.');
  const value = mode === 'auto' ? '' : identity(user) + '.' + mode;
  const pair = COOKIE + '=' + value;
  res.setHeader('Set-Cookie', pair + '; Path=/; Max-Age=' + (mode === 'auto' ? 0 : 2592000) + '; HttpOnly; SameSite=Lax' + (originOf(req).startsWith('https:') ? '; Secure' : ''));
  return { ...req, headers: { ...req.headers, cookie: String(req.headers.cookie || '').split(';').filter(v => !v.trim().startsWith(COOKIE + '=')).concat(pair).join('; ') } };
}
function access(mode) { return { active: mode === 'plus', plan: mode === 'plus' ? 'preview' : null, until: null, subscriptionStatus: null, cancelAtPeriodEnd: false }; }
function effectiveRepo(req, user, repo) {
  const p = preview(req, user);
  if (p.mode === 'auto') return repo;
  return { ...repo, access: async (id, live) => id === user.id ? access(p.mode) : repo.access(id, live) };
}
function status(req, user, actual) {
  const p = preview(req, user);
  return { ...actual, ...(p.mode === 'auto' ? {} : { access: access(p.mode), canManage: false }), preview: p };
}
function requireRealMode(req, user) {
  if (preview(req, user).mode !== 'auto') throw new HttpError(409, 'Revenez à « Accès réel » avant d’ouvrir un paiement ou de gérer votre abonnement.');
}
module.exports = { eligible, preview, select, effectiveRepo, status, requireRealMode };
