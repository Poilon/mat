const { handler, json, readJSON, HttpError, originOf, ipKey } = require('../server/http.cjs');
const { authURL, sessionCookies, publicSession } = require('../server/auth.cjs');
const { limit } = require('../server/db.cjs');
const routes = {
  'get-session': 'GET', 'sign-in/email': 'POST', 'sign-up/email': 'POST', 'sign-out': 'POST',
  'request-password-reset': 'POST', 'reset-password': 'POST', 'send-verification-email': 'POST',
  'verify-email': 'GET', 'change-password': 'POST'
};
module.exports = handler(async (req, res) => {
  const incoming = new URL(req.url, originOf(req));
  const action = String(incoming.searchParams.get('path') || incoming.pathname.replace(/^\/api\/auth\/?/, ''));
  if (!Object.hasOwn(routes, action) || routes[action] !== req.method) throw new HttpError(404, 'Cette action de compte n’existe pas.');
  if (action !== 'get-session') await limit('auth:' + ipKey(req), 12);
  const upstream = new URL(authURL(action));
  for (const key of ['token', 'callbackURL']) if (incoming.searchParams.has(key)) upstream.searchParams.set(key, incoming.searchParams.get(key));
  const headers = { Cookie: sessionCookies(req.headers.cookie, originOf(req).startsWith('http:')), Accept: 'application/json' };
  let body;
  if (req.method === 'POST') {
    const data = await readJSON(req, 12000);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Vérifiez les champs du formulaire.');
    for (const key of ['callbackURL', 'redirectTo']) if (data[key] && new URL(data[key], originOf(req)).origin !== originOf(req)) throw new HttpError(400, 'Adresse de retour invalide.');
    body = JSON.stringify(data);
    headers['Content-Type'] = 'application/json';
    // CSRF is checked against our own origin above; upstream runs behind this same-origin proxy.
    headers.Origin = upstream.origin;
  }
  const response = await fetch(upstream, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) {
    const local = originOf(req).startsWith('http:');
    res.setHeader('Set-Cookie', cookies.map(cookie => {
      let value = cookie.replace(/;\s*Domain=[^;]*/ig, '').replace(/;\s*Path=[^;]*/ig, '; Path=/');
      if (local) value = value.replace(/^__Secure-/, '').replace(/^__Host-/, '').replace(/;\s*Secure/ig, '').replace(/;\s*SameSite=None/ig, '; SameSite=Lax');
      return value;
    }));
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location || new URL(location, originOf(req)).origin !== originOf(req)) throw new HttpError(400, 'Le lien de confirmation a expiré.');
    res.writeHead(302, { Location: location }); res.end(); return;
  }
  const data = await response.json();
  json(res, response.status, publicSession(data));
});
