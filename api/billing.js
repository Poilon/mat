const { handler, json, readJSON, HttpError, originOf, ipKey } = require('../server/http.cjs');
const { getSession, requireUser } = require('../server/auth.cjs');
const { limit } = require('../server/db.cjs');
const { settings, publicPlans, service } = require('../server/billing.cjs');
module.exports = handler(async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) throw new HttpError(405, 'Méthode non autorisée.');
  if (req.method === 'GET') {
    if (!process.env.DATABASE_URL || !process.env.NEON_AUTH_BASE_URL) return json(res, 200, { configured: false, mode: 'unavailable', plans: publicPlans(), access: { active: false }, trialWeek: null, signedIn: false, canManage: false });
    await limit('billing-read:' + ipKey(req), 90);
    const session = await getSession(req);
    return json(res, 200, await service().status(session?.user));
  }
  if (!settings().configured) throw new HttpError(503, 'Les paiements ne sont pas encore ouverts. Votre carnet reste accessible.');
  const user = await requireUser(req); await limit('billing-write:' + user.id, 20);
  const body = await readJSON(req, 1500), billing = service();
  if (body?.action === 'checkout') return json(res, 200, await billing.checkout(user, body.plan, originOf(req)));
  if (body?.action === 'portal') return json(res, 200, await billing.portal(user, originOf(req)));
  if (body?.action === 'refresh') return json(res, 200, await billing.refresh(user));
  if (body?.action === 'confirm') return json(res, 200, await billing.confirm(user, body.session));
  throw new HttpError(400, 'Cette opération est inconnue.');
});
