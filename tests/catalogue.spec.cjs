const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const D = require('../js/data.js');

test('All 360 foods are reachable, with no duplicate cards and independent produce family filters', async ({ page }) => {
  await page.goto('/#aliments');
  await expect(page.locator('.food-card')).toHaveCount(48);
  for (const count of [96, 144, 192, 240, 288, 336, 360]) {
    await page.locator('[data-action="more-foods"]').click();
    await expect(page.locator('.food-card')).toHaveCount(count);
  }
  const ids = await page.locator('.food-card-open').evaluateAll(nodes => nodes.map(n => n.dataset.id));
  expect(new Set(ids).size).toBe(360);
  expect(ids.sort()).toEqual(D.foods.map(f => f.id).sort());
  await page.locator('[data-action="category"][data-category="produce"]').click();
  await expect(page.locator('.food-card')).toHaveCount(48);
  for (const family of ['fruit', 'herb']) {
    await page.locator(`[data-action="food-family"][data-family="${family}"]`).click();
    const expected = D.foods.filter(f => f.category === 'produce' && f.family === family).map(f => f.id);
    await expect(page.locator('.food-card')).toHaveCount(expected.length);
    expect(await page.locator('.food-card-open').evaluateAll(nodes => nodes.map(n => n.dataset.id).sort())).toEqual(expected.sort());
  }
  await page.locator('[data-action="category"][data-category="dairy"]').click();
  await expect(page.locator('.food-card')).toHaveCount(D.foods.filter(f => f.category === 'dairy').length);
});

test('Pineapple and sweet potato searches lead to individual advice, cooking and actual source links', async ({ page }) => {
  for (const [query, id] of [['anans', 'pineapple'], ['patate douce', 'sweet-potato']]) {
    await page.goto('/#aliments?q=' + encodeURIComponent(query));
    await expect(page.locator('.food-card')).toHaveCount(1);
    await page.locator(`.food-card-open[data-id="${id}"]`).click();
    await expect(page.locator('.food-explanation')).toContainText(D.foods.find(f => f.id === id).evidence.why);
    await expect(page.locator('.evidence-basis')).toContainText('ne citent pas nécessairement cet aliment individuellement');
    await expect(page.locator('.preparation-list')).toContainText('Laver');
    await expect(page.locator('.mini-recipes .mini-recipe').first()).toBeVisible();
    await expect(page.locator('.sources-inline .source-link').first()).toHaveAttribute('href', /^https:\/\//);
    await expect(page.locator('.sources-inline')).toContainText('9 SEPTEMBRE 2026');
    await page.keyboard.press('Escape');
  }
});

test('Product explanations show the ingredient that triggered the precaution and its source', async ({ page }) => {
  await page.route('**/api/products?**', route => route.fulfill({ json: { count: 1, page: 1, page_size: 24, products: [{ code: '3017620422003', product_name: 'Dessert au rhum', ingredients_text: 'Sucre, rhum, œufs', categories_tags: ['en:desserts'] }] } }));
  await page.goto('/#aliments?source=off&q=dessert');
  await page.locator('.food-card-open').click();
  const flag = page.locator('.risk-flag').filter({ hasText: 'Alcool repéré ou probable' });
  await expect(flag.locator('.signal-trace')).toContainText('Ingrédients : rhum');
  await flag.locator('summary').click();
  await expect(flag.locator('.signal-explanation')).toContainText('traverse le placenta');
  await expect(flag.locator('.claim-sources a').first()).toHaveAttribute('href', /^https:\/\//);
  await expect(page.locator('.product-unknowns')).toContainText('ne peut pas confirmer');
});

test('Pregnancy branding and expanded detail remain legible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.pregnancy-hero')).toBeVisible();
  expect(await page.locator('.pregnancy-hero').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/#aliments?q=ananas');
  await page.locator('.food-card-open').click();
  expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});

test('Spices have a visible category, useful subfilters and source-backed exceptions', async ({ page }) => {
  await page.goto('/#aliments');
  await page.getByRole('button', { name: 'Épices & aromates', exact: true }).click();
  await expect(page.locator('.results-meta')).toContainText('73 aliments');
  await page.locator('[data-action="food-family"][data-family="blend"]').click();
  await expect(page.locator('.food-card')).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'Ras el-hanout', exact: true })).toBeVisible();
  await page.locator('[data-action="food-family"][data-family="herb"]').click();
  await expect(page.locator('.food-card')).toHaveCount(14);
  await expect(page.getByRole('heading', { name: 'Gingembre en cuisine', exact: true })).toBeVisible();
  await page.locator('[data-action="food-family"][data-family="all"]').click();
  await page.locator('[data-action="status"][data-filter="avoid"]').click();
  await expect(page.locator('.food-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Réglisse', exact: true })).toBeVisible();
  await page.goto('/#aliments?q=cannelle');
  await expect(page.locator('.food-card')).toHaveCount(2);
  await page.locator('.food-card-open[data-id="cinnamon-cassia"]').click();
  await expect(page.locator('.food-explanation')).toContainText('coumarine');
  await expect(page.locator('.source-full[href*="anses.fr"]')).toBeVisible();
});
