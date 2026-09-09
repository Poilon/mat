(function (root) {
  'use strict';
  const API_ROOT = 'https://world.openfoodfacts.org';
  const FIELDS = 'code,product_name,product_name_fr,brands,quantity,image_front_small_url,ingredients_text,ingredients_text_fr,ingredients,categories,categories_tags,allergens_tags,nutriments,nutrition_grades';
  const cacheKey = 'miette-off-cache-v1';
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const requestTimes = { search: [], barcode: [] };
  let memoryCache = {};
  try { const value = JSON.parse(localStorage.getItem(cacheKey) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) memoryCache = value; } catch (_) { /* Storage may be unavailable in private mode. */ }
  const safeString = (value, length = 8000) => typeof value === 'string' ? value.slice(0, length) : '';
  function safeImage(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && (u.hostname === 'images.openfoodfacts.org' || u.hostname.endsWith('.openfoodfacts.org')) ? u.href : ''; } catch (_) { return ''; }
  }
  function toProduct(raw) {
    if (!raw || typeof raw !== 'object' || !/^\d{4,24}$/.test(String(raw.code || ''))) return null;
    const product = {
      code: String(raw.code), product_name: safeString(raw.product_name, 250), product_name_fr: safeString(raw.product_name_fr, 250),
      brands: safeString(raw.brands, 200), quantity: safeString(raw.quantity, 100),
      ingredients_text: safeString(raw.ingredients_text), ingredients_text_fr: safeString(raw.ingredients_text_fr),
      categories: safeString(raw.categories, 2000), categories_tags: Array.isArray(raw.categories_tags) ? raw.categories_tags.filter(x => typeof x === 'string').slice(0, 80) : [],
      allergens_tags: Array.isArray(raw.allergens_tags) ? raw.allergens_tags.filter(x => typeof x === 'string').slice(0, 30) : [],
      ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.slice(0, 100) : [],
      nutriments: {}, nutrition_grades: /^[a-e]$/.test(raw.nutrition_grades) ? raw.nutrition_grades : '',
      image_front_small_url: safeImage(raw.image_front_small_url)
    };
    ['energy-kcal_100g', 'fat_100g', 'saturated-fat_100g', 'carbohydrates_100g', 'sugars_100g', 'proteins_100g', 'salt_100g', 'fiber_100g', 'alcohol_100g'].forEach(k => {
      const v = raw.nutriments && raw.nutriments[k];
      if (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))) product.nutriments[k] = Number(v);
    });
    const analysis = root.MietteRules.analyzeProduct(product);
    return { ...product, id: 'off-' + product.code, name: product.product_name_fr || product.product_name || 'Produit sans nom', origin: 'off', art: 'bowl', category: 'product', status: analysis.status, summary: analysis.status === 'unknown' ? 'Composition et préparation à vérifier' : 'Précautions repérées dans la fiche', analysis };
  }
  function cached(key) {
    const entry = memoryCache[key];
    if (!entry || !Number.isFinite(entry.at) || Date.now() - entry.at > CACHE_TTL || !entry.data || !Array.isArray(entry.data.products)) return null;
    return { ...entry.data, products: entry.data.products.map(toProduct).filter(Boolean), cached: true, cachedAt: entry.at };
  }
  function saveCache(key, data) {
    memoryCache[key] = { at: Date.now(), data };
    const recent = Object.entries(memoryCache).filter(([, v]) => v && Date.now() - v.at < CACHE_TTL).sort((a, b) => b[1].at - a[1].at).slice(0, 12);
    memoryCache = Object.fromEntries(recent);
    try { localStorage.setItem(cacheKey, JSON.stringify(memoryCache)); } catch (_) { /* Keep the in-memory cache if quota is exceeded. */ }
  }
  function checkRate(kind) {
    const now = Date.now();
    // Share a lightweight limiter between tabs when localStorage is available.
    try {
      const stored = JSON.parse(localStorage.getItem('miette-off-rate-' + kind) || '[]');
      if (Array.isArray(stored)) requestTimes[kind] = [...new Set([...requestTimes[kind], ...stored.filter(Number.isFinite)])];
    } catch (_) { /* Memory fallback. */ }
    requestTimes[kind] = requestTimes[kind].filter(t => now - t < 60000);
    const spacing = kind === 'search' ? 7000 : 4500;
    const cap = kind === 'search' ? 8 : 12;
    const last = Math.max(0, ...requestTimes[kind]);
    let wait = Math.max(0, spacing - (now - last));
    if (requestTimes[kind].length >= cap) wait = Math.max(wait, 60000 - (now - Math.min(...requestTimes[kind])));
    if (wait > 0) throw new Error(`Pour respecter le service Open Food Facts, réessayez dans ${Math.ceil(wait / 1000)} secondes. Le guide reste disponible.`);
    requestTimes[kind].push(now);
    try { localStorage.setItem('miette-off-rate-' + kind, JSON.stringify(requestTimes[kind])); } catch (_) { /* Memory fallback. */ }
  }
  async function request(query, page = 1, signal) {
    const term = String(query).trim().slice(0, 150);
    const digits = term.replace(/[\s-]/g, '');
    const isBarcode = /^\d+$/.test(digits);
    if (isBarcode && !root.MietteRules.isValidBarcode(digits)) throw new Error('Ce code-barres est incomplet ou sa clé de contrôle est incorrecte. Vérifiez les 8, 12, 13 ou 14 chiffres.');
    if (!isBarcode && term.length < 2) throw new Error('Saisissez au moins deux caractères pour rechercher un produit.');
    const key = isBarcode ? 'barcode:' + digits : 'search:' + root.MietteRules.normalize(term) + ':' + page;
    const hit = cached(key);
    if (hit) return hit;
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Vous êtes hors connexion. Les aliments du guide, vos recettes et votre carnet restent accessibles.');
    const proxyBase = root.MietteRuntime?.apiBase;
    if (!proxyBase) checkRate(isBarcode ? 'barcode' : 'search');
    const url = new URL(isBarcode ? '/api/v3/product/' + digits + '.json' : '/cgi/search.pl', API_ROOT);
    url.searchParams.set('fields', FIELDS);
    // Browser fetch cannot reliably set User-Agent. Identify the static client in the URL.
    url.searchParams.set('app_name', 'Miette');
    url.searchParams.set('app_version', '1.0');
    url.searchParams.set('lc', 'fr');
    if (!isBarcode) {
      Object.entries({ search_terms: term, search_simple: '1', action: 'process', json: '1', page_size: '20', page: String(page) }).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 18000);
    try {
      const proxy = proxyBase ? new URL('products', new URL(proxyBase, location.href)) : null;
      if (proxy) { proxy.searchParams.set('q', term); proxy.searchParams.set('page', String(page)); }
      let response = await fetch(proxy || url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      // A standalone static copy keeps working; Vercel responds with JSON for all product lookups.
      if (proxy && response.status === 404) {
        checkRate(isBarcode ? 'barcode' : 'search');
        response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      }
      if (response.status === 404 && isBarcode) return { products: [], count: 0, page: 1, hasMore: false };
      if (response.status === 429) throw new Error('Open Food Facts reçoit trop de demandes. Réessayez dans une minute.');
      if (!response.ok) throw new Error('Open Food Facts est temporairement indisponible. Vous pouvez utiliser le guide et réessayer plus tard.');
      const json = await response.json();
      if (!json || typeof json !== 'object' || (!isBarcode && !Array.isArray(json.products))) throw new Error('La réponse Open Food Facts est incomplète. Réessayez plus tard.');
      const raw = isBarcode ? (Array.isArray(json.products) ? json.products : json.product ? [{ ...json.product, code: json.product.code || digits }] : []) : json.products;
      const products = raw.map(toProduct).filter(Boolean);
      const count = isBarcode ? products.length : Number.isFinite(Number(json.count)) ? Math.max(0, Number(json.count)) : products.length;
      const data = { products, count, page, hasMore: !isBarcode && raw.length === 20 && page * 20 < count };
      saveCache(key, data);
      return data;
    } catch (err) {
      if (timedOut) throw new Error('Open Food Facts met trop de temps à répondre. Le guide reste accessible ; réessayez dans un instant.');
      if (err.name === 'AbortError') throw err;
      if (err instanceof TypeError) throw new Error('Connexion à Open Food Facts impossible. Vérifiez votre connexion ou réessayez plus tard ; le guide reste disponible.');
      throw err;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  root.MietteAPI = { request, toProduct, safeImage, clearCache() { memoryCache = {}; try { localStorage.removeItem(cacheKey); } catch (_) {} } };
})(typeof window !== 'undefined' ? window : globalThis);
