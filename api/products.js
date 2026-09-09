const { handler, json, HttpError, ipKey } = require('../server/http.cjs');
const { limit } = require('../server/db.cjs');
const { isValidBarcode, normalize } = require('../js/rules.js');
const cache = new Map();
const inflight = new Map();
const fields = 'code,product_name,product_name_fr,brands,quantity,image_front_small_url,ingredients_text,ingredients_text_fr,ingredients,categories,categories_tags,allergens_tags,nutriments,nutrition_grades';
module.exports = handler(async (req, res) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Méthode non autorisée.');
  const input = new URL(req.url, 'https://miette.invalid');
  const term = (input.searchParams.get('q') || '').trim();
  const code = term.replace(/[\s-]/g, '');
  const barcode = /^\d+$/.test(code);
  const page = Number(input.searchParams.get('page') || 1);
  if (term.length < 2 || term.length > 150 || !Number.isSafeInteger(page) || page < 1 || page > 100 || (barcode && !isValidBarcode(code))) throw new HttpError(400, 'Vérifiez le nom ou les chiffres du code-barres.');
  const key = normalize(term) + ':' + page;
  const send = data => { res.setHeader('Cache-Control', 'public, max-age=60'); res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400'); json(res, 200, data); };
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600000) return send(hit.data);
  await limit('products:' + ipKey(req), barcode ? 30 : 12);
  if (!inflight.has(key)) {
    const task = (async () => {
      // All instances share the upstream allowance; cached requests do not consume it.
      await limit(barcode ? 'off-global-barcode' : 'off-global-search', barcode ? 75 : 8);
      const url = new URL(barcode ? '/api/v3/product/' + code + '.json' : '/cgi/search.pl', 'https://world.openfoodfacts.org');
      url.searchParams.set('fields', fields); url.searchParams.set('lc', 'fr');
      if (!barcode) Object.entries({ search_terms: term, search_simple: '1', action: 'process', json: '1', page_size: '20', page: String(page) }).forEach(([k,v]) => url.searchParams.set(k,v));
      const response = await fetch(url, { headers: { 'User-Agent': 'Miette/2.0 (https://github.com/Poilon/mat)', Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (response.status === 404 && barcode) return { products: [], count: 0, page: 1 };
      if (response.status === 429) throw new HttpError(429, 'Open Food Facts reçoit trop de demandes. Réessayez dans une minute.');
      if (!response.ok) throw new HttpError(502, 'Open Food Facts ne répond pas pour le moment. Le guide et les recettes restent accessibles.');
      const raw = await response.json();
      const products = barcode ? raw.product ? [{ ...raw.product, code: raw.product.code || code }] : [] : raw.products;
      if (!Array.isArray(products)) throw new HttpError(502, 'La fiche reçue est incomplète. Réessayez plus tard.');
      return { products, count: barcode ? products.length : Number(raw.count) || products.length, page };
    })();
    inflight.set(key, task);
  }
  try {
    const data = await inflight.get(key);
    cache.set(key, { at: Date.now(), data });
    while (cache.size > 100) cache.delete(cache.keys().next().value);
    send(data);
  } finally { inflight.delete(key); }
}, { publicRead: true });
