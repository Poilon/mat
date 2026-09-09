'use strict';
const { HttpError } = require('./http.cjs');
const FIELDS = 'code,product_name,product_name_fr,brands,quantity,image_front_small_url,ingredients_text,ingredients_text_fr,ingredients,categories,categories_tags,allergens_tags,nutriments,nutrition_grades';
async function fetchProducts({ term, code, barcode, page }, { fetchImpl = fetch, allowance } = {}) {
  const hosts = ['world.openfoodfacts.org', 'fr.openfoodfacts.org'];
  for (let attempt = 0; attempt < hosts.length; attempt++) {
    if (allowance) await allowance(barcode ? 'off-global-barcode' : 'off-global-search', barcode ? 75 : 8);
    const url = new URL(barcode ? '/api/v3/product/' + code + '.json' : '/cgi/search.pl', 'https://' + hosts[attempt]);
    // cc=world preserves the international catalogue on the French endpoint too.
    Object.entries({ fields: FIELDS, lc: 'fr', cc: 'world' }).forEach(([k,v]) => url.searchParams.set(k,v));
    if (!barcode) Object.entries({ search_terms: term, search_simple: '1', action: 'process', json: '1', page_size: '20', page: String(page) }).forEach(([k,v]) => url.searchParams.set(k,v));
    try {
      const response = await fetchImpl(url, { headers: { 'User-Agent': 'Nidelle/2.2.1 (https://github.com/Poilon/mat)', Accept: 'application/json' }, signal: AbortSignal.timeout(6500) });
      if (response.status === 404 && barcode) return { products: [], count: 0, page: 1 };
      if (response.status === 429) throw new HttpError(429, 'Open Food Facts reçoit trop de demandes. Réessayez dans une minute.');
      if (!response.ok) throw new HttpError(502, 'Open Food Facts ne répond pas pour le moment. Le guide et les recettes restent accessibles.');
      const raw = await response.json();
      const products = barcode ? raw.product ? [{ ...raw.product, code: raw.product.code || code }] : [] : raw.products;
      if (!Array.isArray(products)) throw new Error('Incomplete upstream response');
      return { products, count: barcode ? products.length : Number(raw.count) || products.length, page };
    } catch (error) {
      // Never bypass a rate limit. Other availability failures get one alternate official endpoint.
      if (error.status === 429) throw error;
      if (attempt === hosts.length - 1) throw new HttpError(502, 'Open Food Facts ne répond pas pour le moment. Le guide et les recettes restent accessibles.');
    }
  }
}
module.exports = { fetchProducts };
