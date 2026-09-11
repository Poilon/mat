const { handler, json, readJSON, HttpError, ipKey } = require('../server/http.cjs');
const { requireUser } = require('../server/auth.cjs');
const { limit } = require('../server/db.cjs');
const { billingStore } = require('../server/billing-store.cjs');
const { settings } = require('../server/billing.cjs');
const P = require('../js/plus.js');
const D = require('../js/data.js');
const Planner = require('../server/planner.cjs');
function validateRequest(body, now = Date.now()) {
  if (!['compose', 'swap'].includes(body?.action)) throw new HttpError(400, 'Cette opération est inconnue.');
  let options;
  try { options = P.preferences(body.options); } catch (error) { throw new HttpError(400, error.message); }
  const start = new Date(options.start + 'T12:00:00Z');
  if (start.getUTCDay() !== 1 || Math.abs(start.getTime() - now) > 372 * 86400000) throw new HttpError(400, 'Choisissez le lundi d’une semaine dans l’année à venir ou écoulée.');
  const entries = body.entries || [];
  if (!Array.isArray(entries) || ![0, 7, 14].includes(entries.length)) throw new HttpError(400, 'La proposition de repas est invalide.');
  const restored = P.restore({ options, entries }, D.recipes, options);
  if (restored.entries.length !== entries.length) throw new HttpError(400, 'La proposition de repas est invalide.');
  if (body.action === 'swap' && (restored.dirty || !entries.length || !Number.isInteger(body.index) || body.index < 0 || body.index >= entries.length)) throw new HttpError(400, 'Recomposez la semaine avant de remplacer un plat.');
  return { action: body.action, options, entries: restored.entries, index: body.index };
}
async function generateWeek(input, { config, user, repo }) {
  if (config.configured && !user?.id) throw new HttpError(401, 'Connectez-vous pour préparer votre semaine offerte.');
  if (config.configured && !(await repo.access(user.id, config.live)).active) {
    const trial = await repo.trial(user.id);
    if (trial && trial !== input.options.start) throw new HttpError(402, 'Votre première semaine est offerte. Passez à Plus pour préparer les suivantes.', { code: 'premium_required', trialWeek: trial });
  }
  let entries;
  try { entries = input.action === 'compose' ? Planner.compose(D.recipes, input.options, input.entries) : Planner.swap(D.recipes, input.entries, input.index, input.options); }
  catch (error) { throw new HttpError(400, error.message); }
  if (config.configured && !(await repo.access(user.id, config.live)).active && !await repo.claimTrial(user.id, input.options.start)) {
    throw new HttpError(402, 'Votre semaine offerte a déjà été choisie. Passez à Plus pour préparer une autre semaine.', { code: 'premium_required', trialWeek: await repo.trial(user.id) });
  }
  return { entries, trialWeek: user ? await repo.trial(user.id) : null };
}
module.exports = handler(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
  const config = settings();
  const user = config.configured ? await requireUser(req) : null;
  if (process.env.DATABASE_URL) await limit('workshop:' + (user?.id || ipKey(req)), 30);
  const input = validateRequest(await readJSON(req, 12000));
  const repo = process.env.DATABASE_URL ? billingStore() : null;
  json(res, 200, await generateWeek(input, { config, user, repo }));
});
module.exports.validateRequest = validateRequest;
module.exports.generateWeek = generateWeek;
