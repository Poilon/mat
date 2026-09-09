const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const product = (overrides = {}) => ({ code: '3017620422003', product_name: 'Produit de démonstration', brands: 'Marque test', ingredients_text: 'Sucre, lait pasteurisé, cacao', categories_tags: ['en:spreads'], nutriments: { sugars_100g: 12 }, ...overrides });
async function routeOFF(page, handler) { await page.route('**/api/products?**', handler); }

test('Home, local search, risk details and favorites persist across reloads', async ({ page }) => {
  const errors = []; page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bien dans l’assiette. Bien dans votre grossesse.' })).toBeVisible();
  await page.locator('#home-search-input').fill('mozza');
  await page.locator('#home-search').getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(page.locator('.food-card')).toHaveCount(1);
  await page.locator('.food-card-open').click();
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('dialog')).toContainText('pasteurisé');
  await page.locator('dialog [data-action="favorite"]').click();
  await page.keyboard.press('Escape');
  await page.goto('/#favoris');
  await expect(page.locator('.food-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.food-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Category and status filters combine, French ligatures work', async ({ page }) => {
  await page.goto('/#aliments');
  await page.locator('#explore-search-input').fill('oeuf');
  await expect(page.locator('.food-card')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Œufs de caille', exact: true })).toBeVisible();
  await page.locator('#explore-search-input').fill('');
  await page.locator('[data-action="category"][data-category="dairy"]').click();
  await page.locator('[data-action="status"][data-filter="avoid"]').click();
  await expect(page.locator('.food-card')).toHaveCount(require('../js/data.js').foods.filter(f => f.category === 'dairy' && f.status === 'avoid').length);
  await expect(page.locator('.food-card[data-category="produce"]')).toHaveCount(0);
});

test('Portions update ingredient quantities and add to shopping without losing them', async ({ page }) => {
  await page.goto('/#recettes');
  await page.locator('[data-action="recipe"][data-id="sunny-bowl"]').click();
  await page.locator('[data-action="servings"][data-delta="1"]').click();
  await page.locator('[data-action="servings"][data-delta="1"]').click();
  await expect(page.locator('.ingredients-list')).toContainText('240 g');
  await page.locator('[data-action="recipe-shopping"]').click();
  await page.keyboard.press('Escape');
  await page.goto('/#courses');
  await expect(page.locator('.shopping-item')).toHaveCount(6);
  await expect(page.locator('.shopping-list')).toContainText('240 g');
  await page.locator('.shopping-item input').first().check();
  await page.reload();
  await expect(page.locator('.shopping-item input').first()).toBeChecked();
  await page.locator('#shopping-input').fill('Pommes');
  await page.locator('#shopping-add button').click();
  await expect(page.locator('.shopping-item')).toHaveCount(7);
  const download = page.waitForEvent('download');
  await page.locator('[data-action="download-shopping"]').click();
  expect((await download).suggestedFilename()).toBe('miette-mes-courses.txt');
});

test('Meal planner saves a recipe, generates shopping and removes a meal', async ({ page }) => {
  await page.goto('/#menus');
  await page.locator('[data-action="pick-recipe"]').first().click();
  await page.locator('[data-action="assign-recipe"]').first().click();
  await expect(page.locator('.planned-recipe')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.planned-recipe')).toHaveCount(1);
  await page.locator('[data-action="week-shopping"]').click();
  await expect(page.locator('.shopping-item')).toHaveCount(6);
  await page.goto('/#menus');
  await page.locator('[data-action="remove-meal"]').click();
  await expect(page.locator('.planned-recipe')).toHaveCount(0);
});

test('Manual scanner validates the checksum and reads a product', async ({ page }) => {
  let requests = 0;
  await routeOFF(page, async route => { requests++; await route.fulfill({ json: { status: 'success', product: product() } }); });
  await page.goto('/');
  await page.locator('[data-action="scan"]').click();
  await page.locator('#barcode-input').fill('3017620422004');
  await page.locator('#barcode-form button').click();
  await expect(page.locator('#barcode-error')).toContainText('clé de contrôle');
  expect(requests).toBe(0);
  await page.locator('#barcode-input').fill('3017620422003');
  await page.locator('#barcode-form button').click();
  await expect(page.locator('.food-card')).toHaveCount(1);
  expect(requests).toBe(1);
  await page.locator('.food-card-open').click();
  await expect(page.locator('dialog')).toContainText('ne certifie pas');
  await expect(page.locator('dialog .status-badge')).toHaveText('À vérifier');
});

test('OFF search is submission-only; incomplete data, pagination and caching work', async ({ page }) => {
  const requests = [];
  await routeOFF(page, async route => {
    const url = new URL(route.request().url()); requests.push(url);
    const current = Number(url.searchParams.get('page') || 1);
    const products = Array.from({ length: current === 1 ? 20 : 1 }, (_, i) => product({ code: String(1000000000000 + current * 100 + i), product_name: `Produit ${current}-${i}`, ingredients_text: '', categories_tags: [] }));
    await route.fulfill({ json: { count: 21, products } });
  });
  await page.goto('/#aliments?source=off');
  await page.locator('#explore-search-input').fill('yaourt');
  expect(requests.length).toBe(0);
  await page.locator('#explore-search button[type="submit"]').click();
  await expect(page.locator('.food-card')).toHaveCount(20);
  expect(requests[0].pathname).toBe('/api/products');
  expect(requests[0].searchParams.get('q')).toBe('yaourt');
  await page.locator('.food-card-open').first().click();
  await expect(page.locator('dialog')).toContainText('Ingrédients non renseignés');
  await expect(page.locator('dialog .status-badge')).toHaveText('À vérifier');
  await page.keyboard.press('Escape');
  await page.clock.install(); await page.clock.fastForward(7100);
  await page.locator('[data-action="more-products"]').click();
  await expect(page.locator('.food-card')).toHaveCount(21);
  expect(requests.length).toBe(2);
  await page.reload();
  await expect(page.locator('.food-card')).toHaveCount(20);
  expect(requests.length).toBe(2);
  await expect(page.locator('.results-meta')).toContainText('cache');
});

test('External text is escaped and unsafe product image URLs are discarded', async ({ page }) => {
  await routeOFF(page, async route => route.fulfill({ json: { count: 1, products: [product({ product_name: '<img src=x onerror=alert(1)>', image_front_small_url: 'javascript:alert(1)', ingredients_text: '<script>window.injected=true</script>' })] } }));
  await page.goto('/#aliments?source=off&q=test');
  await expect(page.locator('.food-card')).toHaveCount(1);
  await page.locator('.food-card-open').click();
  await expect(page.locator('.ingredient-text').last()).toContainText('<script>');
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('img[src^="javascript:"]')).toHaveCount(0);
});

test('An unavailable API shows an actionable error and the local guide remains usable', async ({ page }) => {
  await routeOFF(page, route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/#aliments?source=off&q=saumon');
  await expect(page.locator('.error-panel')).toContainText('temporairement indisponible');
  await expect(page.locator('[data-action="retry-api"]')).toBeVisible();
  await page.locator('.tab').first().click();
  await expect(page.locator('.food-card')).toHaveCount(3);
});

test('Slow obsolete requests cannot overwrite a newer query', async ({ page }) => {
  let releaseFirst;
  await routeOFF(page, async route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    if (query === 'premier') await new Promise(resolve => { releaseFirst = resolve; });
    await route.fulfill({ json: { count: 1, products: [product({ product_name: query })] } }).catch(() => {});
  });
  await page.goto('/#aliments?source=off&q=premier');
  await expect.poll(() => typeof releaseFirst).toBe('function');
  await page.clock.install(); await page.clock.fastForward(7100);
  await page.locator('#explore-search-input').fill('second');
  await page.locator('#explore-search button[type="submit"]').click();
  await expect(page.locator('.food-card')).toContainText('second');
  releaseFirst();
  await expect(page.locator('.food-card')).toContainText('second');
});

test('Profile preferences are local and vegetarian recipes exclude fish', async ({ page }) => {
  await page.goto('/#profil');
  await page.locator('#profile-name').fill('Camille');
  await page.locator('#profile-vegetarian').check();
  await page.locator('#profile-form button[type="submit"]').click();
  await page.goto('/#accueil');
  await expect(page.locator('.page-heading')).toContainText('Bonjour Camille');
  await page.goto('/#recettes');
  await expect(page.locator('[data-action="recipe"][data-id="lemon-salmon"]')).toHaveCount(0);
  await page.goto('/#confidentialite');
  await page.locator('[data-action="reset-data"]').click();
  await page.locator('[data-action="confirm-reset"]').click();
  await page.goto('/#profil');
  await expect(page.locator('#profile-name')).toHaveValue('');
  await expect(page.locator('#profile-vegetarian')).not.toBeChecked();
});

test('Mobile routes and dialog fit the viewport and menu opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const path of ['accueil', 'aliments', 'recettes', 'menus', 'courses', 'guide', 'sources', 'profil']) {
    await page.goto('/#' + path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.locator('[data-action="menu"]').click();
  await expect(page.locator('#sidebar')).toHaveClass(/is-open/);
  await page.locator('#sidebar a[href="#aliments"]').click();
  await expect(page.locator('#sidebar')).not.toHaveClass(/is-open/);
  await page.locator('.food-card-open').first().click();
  await expect(page.locator('dialog')).toBeVisible();
  expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
});

test('Keyboard dialog focus is restored when closed', async ({ page }) => {
  await page.goto('/#aliments');
  const trigger = page.locator('.food-card-open').first();
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('.dialog-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('Main pages have no serious or critical accessibility violations', async ({ page }) => {
  const titles = { accueil: 'Mon quotidien', aliments: 'Explorer les aliments', recettes: 'Idées de recettes', menus: 'Mes menus', guide: 'Les bons repères' };
  for (const path of ['accueil', 'aliments', 'recettes', 'menus', 'guide']) {
    await page.goto('/#' + path);
    // A hash navigation resolves before the app's hashchange handler. Sample the settled page.
    await expect(page).toHaveTitle(titles[path] + ' — Miette');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.querySelector('.page-content').getAnimations().map(a => a.finished));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, elements: v.nodes.slice(0, 3).map(n => n.target) })), path).toEqual([]);
  }
});

test('Offline app shell survives a reload with local recipes', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.hero')).toBeVisible();
  expect(await page.locator('.pregnancy-hero').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.goto('/#aliments?q=ananas');
  await page.locator('.food-card-open').click();
  await expect(page.locator('.food-explanation')).toContainText('ananas');
  await expect(page.locator('.sources-inline .source-link').first()).toHaveAttribute('href', /^https:\/\//);
  await page.keyboard.press('Escape');
  expect(await page.locator('.illustrated-intro img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.locator('a[href="#recettes"]').first().click();
  await expect(page.locator('.recipe-card')).toHaveCount(12);
  await expect(page.locator('#recipe-count')).toContainText('100 recettes');
  await page.locator('[data-action="more-recipes"]').click();
  await expect(page.locator('.recipe-card')).toHaveCount(24);
  await page.locator('#recipe-query').fill('brownie');
  await expect(page.locator('.recipe-card')).toHaveCount(1);
  await page.locator('.recipe-card-open').click();
  await expect(page.locator('.steps-list')).toContainText('sans centre coulant');
  expect(await page.locator('.dialog-recipe-photo').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.offline-banner')).toBeVisible();
  await context.close();
});

test('Recipe collections, instant ingredient search, duration and vegetarian filters combine', async ({ page }) => {
  await page.goto('/#recettes');
  await expect(page.locator('.recipe-collection')).toHaveCount(9);
  await expect(page.locator('#recipe-count')).toContainText('100 recettes');
  await page.locator('.recipe-collection[data-collection="italie"]').click();
  await expect(page.locator('#recipe-count')).toContainText('12 recettes');
  await page.locator('#recipe-duration').selectOption('30');
  await page.locator('[data-action="vegetarian"]').click();
  await page.locator('#recipe-query').fill('tomate');
  await expect(page.locator('#recipe-query')).toBeFocused();
  await page.locator('#recipe-sort').selectOption('rapide');
  const matching = await page.locator('.recipe-card-open').evaluateAll(buttons => buttons.map(b => window.MietteData.recipes.find(r => r.id === b.dataset.id)));
  expect(matching.length).toBeGreaterThan(0);
  expect(matching.every(r => r.collection === 'italie' && r.time <= 30 && r.vegetarian && /tomate/i.test(r.title + r.ingredients.map(i => i.name).join(' ')))).toBe(true);
  expect(matching.map(r => r.time)).toEqual(matching.map(r => r.time).sort((a, b) => a - b));
  await page.reload();
  await expect(page.locator('#recipe-duration')).toHaveValue('30');
  await expect(page.locator('#recipe-query')).toHaveValue('tomate');
  await expect(page.locator('[data-action="vegetarian"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#recipe-query').fill('zzzintrouvable');
  await expect(page.locator('.recipe-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await expect(page.locator('#recipe-count')).toContainText('100 recettes');
  await expect(page.locator('.recipe-card')).toHaveCount(12);
});

test('All 100 recipes can be browsed without duplicates and French search finds new recipes', async ({ page }) => {
  await page.goto('/#recettes');
  for (let i = 0; i < 8; i++) await page.locator('[data-action="more-recipes"]').click();
  await expect(page.locator('.recipe-card')).toHaveCount(100);
  await expect(page.locator('[data-action="more-recipes"]')).toHaveCount(0);
  const ids = await page.locator('.recipe-card-open').evaluateAll(buttons => buttons.map(b => b.dataset.id));
  expect(new Set(ids).size).toBe(100);
  await page.locator('#recipe-query').fill('RICOTTA CITRON');
  await expect(page.locator('[data-action="recipe"][data-id="pancakes-citron-ricotta"]')).toBeVisible();
  await page.locator('#recipe-query').fill('oeuf avocat');
  const matches = await page.locator('.recipe-card-open').count();
  expect(matches).toBeGreaterThan(0);
  expect(matches).toBeLessThan(12);
});

test('A new recipe scales quantities, persists as a favorite and can be found in the menu picker', async ({ page }) => {
  await page.goto('/#recettes?q=burger+poulet');
  await page.locator('.recipe-card-open').click();
  await expect(page.locator('dialog')).toContainText('74 °C');
  await expect(page.locator('dialog a[href*="foodsafety.gov"]')).toHaveCount(1);
  await page.locator('[data-action="servings"][data-delta="1"]').click();
  await page.locator('[data-action="servings"][data-delta="1"]').click();
  await expect(page.locator('.ingredients-list')).toContainText('500 g');
  await page.locator('[data-action="recipe-shopping"]').click();
  await page.locator('dialog [data-action="favorite"]').click();
  await page.keyboard.press('Escape');
  await page.goto('/#favoris');
  await page.reload();
  await expect(page.locator('.recipe-card')).toHaveCount(1);
  await page.goto('/#courses');
  await expect(page.locator('.shopping-list')).toContainText('500 g');
  await page.goto('/#menus');
  await page.locator('[data-action="pick-recipe"]').first().click();
  await page.locator('#picker-query').fill('burger poulet');
  await expect(page.locator('.picker-recipe:visible')).toHaveCount(1);
  await expect(page.locator('#picker-count')).toContainText('1 recette');
  await page.locator('.picker-recipe:visible').click();
  await expect(page.locator('.planned-recipe')).toContainText('Burger de poulet');
  await page.reload();
  await expect(page.locator('.planned-recipe')).toContainText('Burger de poulet');
});
