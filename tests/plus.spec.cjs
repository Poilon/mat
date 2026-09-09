const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const D = require('../js/data.js');
const { empty } = require('../js/notebook.js');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+02:00'));
  await page.route('**/api/config', route => route.fulfill({ json: { accounts: false } }));
});
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function createPreview(page) {
  await page.locator('[data-action="plus-preview"]').last().click();
  await page.locator('#plus-start').fill('2026-09-14');
  await page.locator('#plus-preview-form [type="submit"]').click();
  await expect(page.locator('.plus-preview-recipe')).toHaveCount(4);
}

test('The menu paywall explains the proposed prices, can be dismissed, and leaves food advice free', async ({ page }) => {
  const payments = [];
  page.on('request', req => { if (/stripe|checkout|billing|subscribe/i.test(req.url())) payments.push(req.url()); });
  await page.goto('/#menus');
  const trigger = page.locator('[data-action="plus-offer"]');
  await trigger.click();
  await expect(page.getByRole('dialog')).toContainText('Les abonnements et les paiements ne sont pas encore ouverts');
  await expect(page.locator('dialog [data-plus-terms]')).toContainText('29,90');
  await page.locator('#dialog-monthly').check();
  await expect(page.locator('dialog [data-plus-terms]')).toContainText('4,90');
  await expect(page.locator('dialog [data-plus-terms]')).toContainText('renouvelé automatiquement');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.goto('/#plus');
  await expect(page.locator('#page-monthly')).toBeChecked();
  await expect(page.locator('main [data-plus-terms]')).toContainText('prochaine échéance');
  await page.locator('#page-pass').check();
  await expect(page.locator('main [data-plus-terms]')).toContainText('sans renouvellement automatique');
  await page.goto('/#aliments?q=ananas');
  await page.locator('.food-card-open').click();
  await expect(page.locator('.food-explanation')).toBeVisible();
  await expect(page.locator('.sources-inline a').first()).toBeVisible();
  expect(payments).toEqual([]);
});

test('The preview preserves preferences while reading recipes, saves four meals and prepares real shopping', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#menus?semaine=1');
  await page.locator('[data-action="plus-preview"]').click();
  await page.locator('#plus-start').fill('2026-09-14');
  await page.locator('#plus-duration').selectOption('30');
  await page.locator('#plus-preview-form [name="vegetarian"]').check();
  await page.locator('#plus-preview-form [type="submit"]').click();
  const ids = await page.locator('.plus-preview-recipe').evaluateAll(nodes => nodes.map(n => n.dataset.id));
  expect(ids).toHaveLength(4);
  for (const id of ids) { const r = D.recipes.find(r => r.id === id); expect(r.vegetarian).toBe(true); expect(r.time).toBeLessThanOrEqual(30); }
  await page.locator('.plus-preview-recipe').first().click();
  await expect(page.locator('.ingredients-list')).toBeVisible();
  await page.locator('[data-action="servings"][data-delta="1"]').click();
  await page.locator('[data-action="plus-back-preview"]').click();
  await expect(page.locator('#plus-duration')).toHaveValue('30');
  await expect(page.locator('#plus-preview-form [name="vegetarian"]')).toBeChecked();
  expect(await page.locator('.plus-preview-recipe').evaluateAll(nodes => nodes.map(n => n.dataset.id))).toEqual(ids);
  await page.locator('[data-action="plus-save-preview"]').click();
  await expect(page.locator('dialog')).not.toBeVisible();
  await expect(page.locator('.planned-recipe')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('.planned-recipe')).toHaveCount(4);
  await page.locator('[data-action="week-shopping"]').click();
  await expect(page.locator('.shopping-item').first()).toBeVisible();
  expect(await page.locator('.shopping-item').count()).toBeGreaterThan(4);
  expect(errors).toEqual([]);
});

test('Occupied slots are preserved and changing preview preferences invalidates stale suggestions', async ({ page }) => {
  const notebook = { ...empty(), menus: { '2026-09-14': { lunch: 'sunny-bowl' }, '2026-09-17': { dinner: 'green-pasta' } } };
  await page.addInitScript(value => localStorage.setItem('miette-notebook-v1', JSON.stringify(value)), notebook);
  await page.goto('/#menus');
  await createPreview(page);
  await expect(page.locator('.plus-occupied')).toHaveCount(1);
  await expect(page.locator('[data-action="plus-save-preview"]')).toContainText('Ajouter 3 repas');
  await page.locator('#plus-duration').selectOption('30');
  await expect(page.locator('.plus-preview-recipe')).toHaveCount(0);
  await expect(page.locator('[data-action="plus-save-preview"]')).toHaveCount(0);
  await page.locator('#plus-preview-form [type="submit"]').click();
  await page.locator('[data-action="plus-save-preview"]').click();
  const menus = await page.evaluate(() => JSON.parse(localStorage.getItem('miette-notebook-v1')).menus);
  expect(menus['2026-09-14'].lunch).toBe('sunny-bowl');
  expect(menus['2026-09-17'].dinner).toBe('green-pasta');
  expect(Object.values(menus).flatMap(day => Object.values(day))).toHaveLength(5);
  await createPreview(page);
  await expect(page.locator('[data-action="plus-save-preview"]')).toBeDisabled();
  await expect(page.locator('.plus-save-note')).toContainText('Choisissez une autre date');
});

test('The offer, paywall and preview are accessible and fit small phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#plus');
  await settle(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  let result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  await page.goto('/#menus');
  await page.locator('[data-action="plus-offer"]').click();
  await settle(page);
  result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  expect(await page.locator('dialog').evaluate(d => d.scrollWidth <= d.clientWidth)).toBe(true);
  await createPreview(page);
  await settle(page);
  result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.locator('dialog').evaluate(d => d.scrollWidth <= d.clientWidth)).toBe(true);
});

test('The cached static app can create and save a free preview without a network', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+02:00'));
    await page.goto('/#plus');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await createPreview(page);
    await expect.poll(() => page.locator('.plus-preview-recipe img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await page.locator('[data-action="plus-save-preview"]').click();
    await expect(page.locator('.planned-recipe')).toHaveCount(4);
  } finally { await context.close(); }
});
