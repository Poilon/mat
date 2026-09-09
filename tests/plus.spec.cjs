const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const D = require('../js/data.js');
const { empty } = require('../js/notebook.js');
const draftKey = 'miette-workshop-v1:miette-notebook-v1';
const recipeIDs = page => page.locator('[data-action="workshop-recipe"]').evaluateAll(nodes => nodes.map(n => n.dataset.id));
const notebook = page => page.evaluate(() => JSON.parse(localStorage.getItem('miette-notebook-v1')));

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-09T12:00:00+02:00'));
  await page.route('**/api/config', route => route.fulfill({ json: { accounts: false } }));
});
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function generate(page, meals = 'dinner') {
  await page.locator('#workshop-start').fill('2026-09-14');
  await page.locator('#workshop-meals').selectOption(meals);
  await page.locator('#workshop-form [type="submit"]').click();
  await expect(page.locator('.workshop-recipe')).toHaveCount(meals === 'both' ? 14 : 7);
}

test('The full workshop respects tastes, keeps pinned meals, and replaces just one dish', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#plus');
  await page.locator('.offer-primary').click();
  await page.locator('#workshop-time').selectOption('30');
  await page.locator('[name="vegetarian"]').check();
  await page.locator('[name="dislikes"][value="mushrooms"]').check();
  await page.locator('[name="pantry"][value="lentils"]').check();
  await page.locator('[name="mood"][value="comfort"]').check();
  await generate(page);
  const ids = await recipeIDs(page);
  for (const id of ids) {
    const r = D.recipes.find(r => r.id === id);
    expect(r.vegetarian).toBe(true); expect(r.time).toBeLessThanOrEqual(30);
    expect(r.ingredients.map(i => i.name).join(' ')).not.toMatch(/champignon/i);
  }
  expect(D.recipes.find(r => r.id === ids[0]).ingredients.some(i => /lentilles/i.test(i.name))).toBe(true);
  await page.locator('[data-action="workshop-recipe"]').first().click();
  await expect(page.locator('.ingredients-list')).toBeVisible();
  await expect(page.locator('dialog .sources-inline a').first()).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await recipeIDs(page)).toEqual(ids);
  await page.locator('[data-action="workshop-pin"][data-index="0"]').click();
  await expect(page.locator('[data-action="workshop-swap"][data-index="0"]')).toBeDisabled();
  await page.locator('[data-action="workshop-regenerate"]').click();
  const regenerated = await recipeIDs(page);
  expect(regenerated[0]).toBe(ids[0]);
  await page.locator('[data-action="workshop-swap"][data-index="1"]').click();
  const swapped = await recipeIDs(page);
  expect(swapped[1]).not.toBe(regenerated[1]);
  expect(swapped.filter((_, i) => i !== 1)).toEqual(regenerated.filter((_, i) => i !== 1));
  expect(new Set(swapped).size).toBe(7);
  await page.reload();
  expect(await recipeIDs(page)).toEqual(swapped);
  await expect(page.locator('[data-action="workshop-pin"][data-index="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#workshop-time')).toHaveValue('30');
  expect(errors).toEqual([]);
});

test('Saving updates workshop meals while keeping manual meals and requiring new preferences to be applied', async ({ page }) => {
  await page.addInitScript(value => { if (!localStorage.getItem('seeded')) { localStorage.setItem('miette-notebook-v1', JSON.stringify(value)); localStorage.setItem('seeded', '1'); } }, { ...empty(), menus: { '2026-09-14': { dinner: 'sunny-bowl' }, '2026-09-30': { lunch: 'green-pasta' } } });
  await page.goto('/#atelier'); await generate(page);
  await expect(page.locator('.workshop-occupied')).toHaveCount(1);
  await page.locator('#workshop-time').selectOption('30');
  await expect(page.locator('.workshop-dirty')).toBeVisible();
  for (const action of ['save', 'shopping', 'export', 'swap']) await expect(page.locator(`[data-action="workshop-${action}"]`).first()).toBeDisabled();
  await page.locator('#workshop-form [type="submit"]').click();
  await page.locator('[data-action="workshop-save"]').click();
  await expect(page.locator('#workshop-feedback')).toContainText('6 repas ajoutés');
  await expect(page.locator('[data-action="workshop-save"]')).toBeDisabled();
  await page.locator('[data-action="workshop-swap"][data-index="1"]').click();
  const ids = await recipeIDs(page);
  await page.locator('[data-action="workshop-save"]').click();
  await expect(page.locator('#workshop-feedback')).toContainText('1 actualisés');
  const saved = await notebook(page);
  expect(saved.menus['2026-09-14'].dinner).toBe('sunny-bowl');
  expect(saved.menus['2026-09-15'].dinner).toBe(ids[1]);
  expect(saved.menus['2026-09-30'].lunch).toBe('green-pasta');
  await page.goto('/#menus?semaine=1'); await page.reload();
  await expect(page.locator('.planned-recipe')).toHaveCount(7);
});

test('Fourteen meals produce a real grocery list and an offline booklet with complete recipes and sources', async ({ page }) => {
  await page.goto('/#atelier'); await generate(page, 'both');
  const ids = await recipeIDs(page);
  const owned = page.locator('[data-workshop-owned]').first();
  const ownedKey = await owned.getAttribute('data-workshop-owned');
  const itemCount = await page.locator('[data-workshop-owned]').count();
  await owned.check();
  await page.locator('[data-action="workshop-shopping"]').click();
  const saved = await notebook(page);
  expect(saved.shopping).toHaveLength(itemCount - 1);
  expect(saved.shopping.some(i => i.name.toLowerCase() === ownedKey.split('|')[0])).toBe(false);
  await page.locator('[data-action="workshop-shopping"]').click();
  expect((await notebook(page)).shopping).toEqual(saved.shopping);
  const pending = page.waitForEvent('download');
  await page.locator('[data-action="workshop-export"]').click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('mon-carnet-de-cuisine-2026-09-14.html');
  const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const html = Buffer.concat(chunks).toString();
  const documentPage = await page.context().newPage();
  await page.context().setOffline(true); await documentPage.setContent(html);
  await expect(documentPage.locator('article')).toHaveCount(14);
  await expect(documentPage.locator('tbody tr')).toHaveCount(14);
  for (let i = 0; i < ids.length; i++) {
    const r = D.recipes.find(r => r.id === ids[i]);
    await expect(documentPage.locator('article').nth(i)).toContainText(r.title);
    await expect(documentPage.locator('article').nth(i)).toContainText(r.steps.at(-1));
    await expect(documentPage.locator('article').nth(i)).toContainText(r.safety);
    expect(await documentPage.locator('article').nth(i).locator('a[href^="https://"]').count()).toBeGreaterThan(0);
  }
  await expect(documentPage.getByRole('button', { name: 'Imprimer / enregistrer en PDF' })).toBeVisible();
  expect(await documentPage.locator('script[src],img,link[href]').count()).toBe(0);
});

test('The offer shows actual results and clear prices after using the workshop, without taking payment', async ({ page }) => {
  const payments = []; page.on('request', req => { if (/stripe|checkout|billing|subscribe/i.test(req.url())) payments.push(req.url()); });
  await page.goto('/#atelier'); await generate(page);
  const trigger = page.locator('[data-action="plus-offer"]'); await trigger.click();
  await expect(page.locator('.offer-proof')).toContainText('7 repas');
  await expect(page.locator('dialog')).toContainText('Les paiements ne sont pas encore ouverts');
  await expect(page.locator('dialog [data-plus-terms]')).toContainText('29,90');
  await page.locator('#dialog-monthly').check();
  await expect(page.locator('dialog [data-plus-terms]')).toContainText('4,90');
  await expect(page.locator('dialog [data-plus-terms]')).toContainText('renouvelé automatiquement');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.goto('/#plus'); await expect(page.locator('#page-monthly')).toBeChecked();
  await page.locator('#page-pass').check();
  await expect(page.locator('main [data-plus-terms]')).toContainText('sans renouvellement automatique');
  await page.goto('/#aliments?q=ananas'); await page.locator('.food-card-open').click();
  await expect(page.locator('.food-explanation')).toBeVisible();
  await expect(page.locator('.sources-inline a').first()).toBeVisible();
  expect(payments).toEqual([]);
});

test('The offer, full workshop and result paywall stay accessible on a small phone', async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#plus');
  async function check() {
    await settle(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
  }
  await check(); await page.locator('.offer-primary').click(); await check();
  await generate(page); await check();
  await page.locator('[data-action="plus-offer"]').click(); await check();
  await page.locator('.plus-dismiss').click();
  await expect(page.locator('dialog')).not.toBeVisible();
  await page.locator('[data-action="menu"]').click();
  await expect(page.locator('.sidebar a[href="#atelier"]')).toBeVisible();
});

test('Resetting a notebook clears its workshop draft and old preferences', async ({ page }) => {
  await page.goto('/#atelier'); await page.locator('[name="vegetarian"]').check(); await generate(page);
  await page.goto('/#confidentialite');
  await page.locator('[data-action="reset-data"]').click();
  await page.locator('[data-action="confirm-reset"]').click();
  expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(null);
  await page.goto('/#atelier');
  await expect(page.locator('.workshop-before')).toBeVisible();
  await expect(page.locator('[name="vegetarian"]')).not.toBeChecked();
});

test.describe('Offline workshop', () => {
  test.use({ serviceWorkers: 'allow' });
  test('The installed shell can generate, edit and retain a week without network', async ({ page, context }) => {
    test.setTimeout(60000);
    await page.goto('/#atelier');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await expect.poll(() => page.evaluate(async () => (await caches.open('miette-shell-v2.3.0')).match(new URL('js/workshop.js?v=1', location.href)).then(Boolean))).toBe(true);
    await context.setOffline(true); await page.reload();
    await generate(page);
    await page.locator('[data-action="workshop-swap"][data-index="0"]').click();
    const ids = await recipeIDs(page);
    await page.locator('[data-action="workshop-save"]').click(); await page.reload();
    expect(await recipeIDs(page)).toEqual(ids);
    await expect.poll(() => page.locator('.workshop-recipe img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await page.goto('/#menus?semaine=1'); await expect(page.locator('.planned-recipe')).toHaveCount(7);
  });
});

test('Unavailable browser storage is disclosed while the workshop stays usable in the tab', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('Storage blocked', 'QuotaExceededError'); }; });
  await page.goto('/#atelier'); await generate(page);
  await expect(page.locator('#workshop-storage-note')).toContainText('reste dans cet onglet');
  await page.locator('[data-action="workshop-pin"][data-index="0"]').click();
  await expect(page.locator('[data-action="workshop-pin"][data-index="0"]')).toHaveAttribute('aria-pressed', 'true');
});
