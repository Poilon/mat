const { handler, json, readJSON, HttpError } = require('../server/http.cjs');
const { requireUser, authURL, sessionCookies } = require('../server/auth.cjs');
const { database, limit } = require('../server/db.cjs');
module.exports = handler(async (req, res) => {
  if (req.method !== 'DELETE') throw new HttpError(405, 'Méthode non autorisée.');
  const user = await requireUser(req);
  await limit('delete-account:' + user.id, 5);
  const body = await readJSON(req, 1000);
  if (typeof body?.password !== 'string' || !body.password || body.password.length > 128) throw new HttpError(400, 'Votre mot de passe est nécessaire pour supprimer le compte.');
  // Reauthenticate through the managed provider. Never read or verify stored password hashes here.
  const url = new URL(authURL('sign-in/email'));
  const check = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url.origin }, body: JSON.stringify({ email: user.email, password: body.password }), signal: AbortSignal.timeout(15000) });
  if (!check.ok) throw new HttpError(check.status === 429 ? 429 : 400, 'Le mot de passe est incorrect ou la connexion doit être renouvelée.');
  const verified = await check.json();
  if (verified.user?.id !== user.id) throw new HttpError(403, 'La confirmation du compte a échoué.');
  const sql = database();
  // Neon Auth uses cascading foreign keys from session/account/member to user.
  // Both the app notebook and managed identity are removed in one transaction.
  await sql.transaction([
    sql`DELETE FROM miette_notebooks WHERE user_id = ${user.id}`,
    sql`DELETE FROM miette_limits WHERE key = ${'notebook:' + user.id} OR key = ${'delete-account:' + user.id}`,
    sql`DELETE FROM neon_auth.verification WHERE identifier = ${user.email} OR value = ${user.id}`,
    sql`DELETE FROM neon_auth."user" WHERE id = ${user.id}`
  ]);
  const cookieNames = sessionCookies(req.headers.cookie).split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
  if (cookieNames.length) res.setHeader('Set-Cookie', cookieNames.map(name => `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${name.startsWith('__Secure-') || name.startsWith('__Host-') ? '; Secure' : ''}`));
  json(res, 200, { deleted: true });
});
