const { handler, json, HttpError, ipKey } = require('../server/http.cjs');
const { limit } = require('../server/db.cjs');
const { isValidBarcode, normalize } = require('../js/rules.js');
const { fetchProducts } = require('../server/off.cjs');
const { getSession } = require('../server/auth.cjs');
const { settings } = require('../server/billing.cjs');
const { billingStore } = require('../server/billing-store.cjs');
const { effectiveRepo } = require('../server/preview.cjs');
function createProducts({ session = getSession, config = settings, repo = billingStore, quota = limit, fetcher = fetchProducts } = {}) {
const cache = new Map();
const inflight = new Map();
return handler(async (req, res) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Méthode non autorisée.');
  const input = new URL(req.url, 'https://miette.invalid');
  const term = (input.searchParams.get('q') || '').trim();
  const code = term.replace(/[\s-]/g, '');
  const barcode = /^\d+$/.test(code);
  const page = Number(input.searchParams.get('page') || 1);
  if (term.length < 2 || term.length > 150 || !Number.isSafeInteger(page) || page < 1 || page > 100 || (barcode && !isValidBarcode(code))) throw new HttpError(400, 'Vérifiez le nom ou les chiffres du code-barres.');
  if (barcode) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    const billing = config();
    if (!billing.configured) throw new HttpError(503, 'La vérification de Plus est indisponible. Réessayez dans un instant.');
    const user = (await session(req))?.user;
    if (!user?.id) throw new HttpError(401, 'Connectez-vous avec un accès Plus pour utiliser les codes-barres.', { code: 'scan_premium' });
    if (!(await effectiveRepo(req, user, repo()).access(user.id, billing.live)).active) throw new HttpError(402, 'Le scan et la recherche par code-barres font partie de Poum Plus.', { code: 'scan_premium' });
  }
  const key = normalize(term) + ':' + page;
  const send = data => { if (!barcode) { res.setHeader('Cache-Control', 'public, max-age=60'); res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400'); } json(res, 200, data); };
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600000) return send(hit.data);
  await quota('products:' + ipKey(req), barcode ? 30 : 12);
  if (!inflight.has(key)) {
    const task = fetcher({ term, code, barcode, page }, { allowance: quota });
    inflight.set(key, task);
  }
  try {
    const data = await inflight.get(key);
    cache.set(key, { at: Date.now(), data });
    while (cache.size > 100) cache.delete(cache.keys().next().value);
    send(data);
  } finally { inflight.delete(key); }
}, { publicRead: true });

}
module.exports = createProducts();
module.exports.createProducts = createProducts;
