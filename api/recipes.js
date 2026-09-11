const { handler, json, HttpError, ipKey } = require('../server/http.cjs');
const { getSession } = require('../server/auth.cjs');
const { settings } = require('../server/billing.cjs');
const { billingStore } = require('../server/billing-store.cjs');
const { limit } = require('../server/db.cjs');
const { readRecipe } = require('../server/recipe-access.cjs');
module.exports = handler(async (req, res) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Méthode non autorisée.');
  const config = settings();
  const user = config.configured ? (await getSession(req))?.user : null;
  if (process.env.DATABASE_URL) await limit('recipes:' + (user?.id || ipKey(req)), 90);
  const id = new URL(req.url, 'http://localhost').searchParams.get('id');
  json(res, 200, await readRecipe(id, { config, user, repo: config.configured ? billingStore() : null }));
});
