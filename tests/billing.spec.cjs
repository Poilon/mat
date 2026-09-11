const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { empty } = require('../js/notebook.js');
const { validateRequest, generateWeek } = require('../api/workshop.js');
const { readRecipe } = require('../server/recipe-access.cjs');
const user = { id: 'buyer-a', name: 'Camille', email: 'camille@example.test' };
async function account(page, { loggedIn = true, paid = false, trialWeek = null } = {}) {
  const state = { user: loggedIn ? user : null, paid, trialWeek, purchases: [], actions: [], confirmPaid: false, cancel: false, notebook: empty(), revision: 0 };
  const status = () => ({ configured: true, mode: 'test', access: { active: !!state.user && state.paid, plan: state.paid ? 'monthly' : null, until: state.paid ? '2026-10-11T12:00:00Z' : null, cancelAtPeriodEnd: state.cancel }, canManage: !!state.user && (state.paid || state.actions.includes('confirm')), trialWeek: state.user ? state.trialWeek : null, signedIn: !!state.user });
  const repo = { access: async () => ({ active: state.paid }), trial: async () => state.trialWeek, claimTrial: async (_, date) => { if (state.trialWeek && state.trialWeek !== date) return false; state.trialWeek = date; return true; } };
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Paiement Stripe de test</title>' }));
  await page.route('https://billing.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Gestion Stripe de test</title>' }));
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, body = req.method() === 'GET' ? {} : req.postDataJSON();
    if (path === '/api/config') return route.fulfill({ json: { accounts: true, appURL: 'http://localhost:4176' } });
    if (path === '/api/auth/get-session') return route.fulfill({ json: state.user ? { user: state.user, session: { expiresAt: '2099-01-01' } } : null });
    if (['/api/auth/sign-in/email', '/api/auth/sign-up/email'].includes(path)) { state.user = user; return route.fulfill({ json: { user } }); }
    if (path === '/api/auth/sign-out') { state.user = null; return route.fulfill({ json: { success: true } }); }
    if (path === '/api/notebook') { if (req.method() === 'PUT') { state.notebook = body.notebook; state.revision++; } return route.fulfill({ json: { notebook: state.notebook, revision: state.revision } }); }
    if (path === '/api/recipes') {
      try { return route.fulfill({ json: await readRecipe(new URL(req.url()).searchParams.get('id'), { config: { configured: true, live: false }, user: state.user, repo }) }); }
      catch (e) { return route.fulfill({ status: e.status || 500, json: { error: e.message, ...e.details } }); }
    }
    if (path === '/api/billing') {
      if (req.method() === 'GET') return route.fulfill({ json: status() });
      if (!state.user) return route.fulfill({ status: 401, json: { error: 'Connectez-vous.' } });
      state.actions.push(body.action);
      if (body.action === 'checkout') { state.purchases.push(body); return route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_test_local' } }); }
      if (body.action === 'portal') return route.fulfill({ json: { url: 'https://billing.stripe.com/p/session/test_own' } });
      if (body.action === 'confirm') state.paid = state.confirmPaid;
      return route.fulfill({ json: status() });
    }
    if (path === '/api/workshop') {
      try { return route.fulfill({ json: await generateWeek(validateRequest(body), { config: { configured: true, live: false }, user: state.user, repo }) }); }
      catch (e) { return route.fulfill({ status: e.status || 500, json: { error: e.message, ...e.details } }); }
    }
    return route.fulfill({ status: 404, json: { error: 'Route inconnue' } });
  });
  return state;
}
async function ready(page) { await expect.poll(() => page.evaluate(() => MietteBilling.state.loaded && MietteBilling.state.mode)).toBe('test'); }
async function signup(page) {
  await page.locator('#auth-name').fill('Camille'); await page.locator('#auth-email').fill('camille@example.test');
  await page.locator('#auth-password').fill('test-password-123'); await page.locator('#auth-confirm').fill('test-password-123');
  await page.locator('#auth-form [type="submit"]').click();
  await expect(page.locator('#auth-form')).toHaveCount(0);
  await page.locator('#profile-form [type="submit"]').click();
}
test('Poum carries its new identity and explains Plus in the main cooking journeys', async ({ page }) => {
  await account(page, { loggedIn: false });
  for (const [route, place] of [['accueil', 'home'], ['recettes', 'recipes'], ['favoris', 'favorites'], ['courses', 'shopping']]) {
    await page.goto('/#' + route); await ready(page);
    await expect(page).toHaveTitle(/Poum/); await expect(page.locator('.wordmark')).toHaveText('poum');
    await expect(page.locator('.premium-nudge-' + place)).toContainText('Première semaine offerte');
    await expect(page.locator('.topbar-plus')).toBeVisible();
  }
  await page.goto('/#recettes'); await page.locator('.recipe-card-open').first().click();
  await expect(page.locator('.premium-nudge-recipe')).toBeVisible();
  await expect(page.locator('.sources-inline a').first()).toBeVisible();
});
test('The selected subscription survives signup and opens hosted Checkout with no client-chosen customer or amount', async ({ page }) => {
  const state = await account(page, { loggedIn: false });
  await page.goto('/#plus'); await ready(page); await page.locator('#page-monthly').check();
  await page.locator('[data-action="billing-checkout"]').click(); await expect(page.locator('#auth-form')).toHaveAttribute('data-mode', 'signup');
  await signup(page); await expect(page).toHaveURL(/checkout\.stripe\.com/);
  expect(state.purchases).toEqual([{ action: 'checkout', plan: 'monthly' }]);
});
test('A first free week resumes after account creation; the next week encounters the real server gate', async ({ page }) => {
  const state = await account(page, { loggedIn: false });
  await page.goto('/#atelier'); await ready(page); await page.locator('#workshop-start').fill('2026-09-14');
  await page.locator('[name="vegetarian"]').check(); await page.locator('#workshop-form [type="submit"]').click();
  await expect(page.locator('#auth-form')).toHaveAttribute('data-mode', 'signup'); await signup(page);
  await expect(page.locator('.workshop-recipe')).toHaveCount(7); expect(state.trialWeek).toBe('2026-09-14');
  await expect(page.locator('[name="vegetarian"]')).toBeChecked();
  await page.locator('#workshop-start').fill('2026-09-21'); await page.locator('#workshop-form [type="submit"]').click();
  await expect(page.locator('dialog')).toBeVisible(); await expect(page.locator('dialog [data-action="billing-checkout"]')).toContainText('29,90');
  await page.locator('[data-action="close-dialog"]').last().click(); await expect(page.locator('.workshop-recipe')).toHaveCount(7);
  expect(state.purchases).toEqual([]);
});
test('A forged success URL never activates Plus; refresh can restore a payment confirmed by the server', async ({ page }) => {
  const state = await account(page);
  await page.goto('/?checkout=success&session_id=cs_test_abcdefghijk#plus');
  await expect(page.locator('.billing-feedback')).toContainText('n’a pas encore confirmé');
  expect(await page.evaluate(() => MietteBilling.active)).toBe(false);
  expect(new URL(page.url()).search).toBe('');
  state.paid = true; await page.locator('[data-action="billing-restore"]').click();
  await expect(page.locator('.member-panel')).toContainText('Votre abonnement est actif');
  await expect(page.locator('[data-action="billing-checkout"]')).toHaveCount(0);
  expect(state.purchases).toEqual([]);
});
test('A returned purchase survives reload when login is needed and confirms only in the right account', async ({ page }) => {
  const state = await account(page, { loggedIn: false }); state.confirmPaid = true;
  await page.goto('/?checkout=success&session_id=cs_test_abcdefghijk#plus'); await ready(page); await page.reload();
  await page.getByRole('link', { name: 'Me connecter pour retrouver mon achat' }).click();
  await page.locator('#auth-email').fill('camille@example.test'); await page.locator('#auth-password').fill('test-password-123');
  await page.locator('#auth-form [type="submit"]').click();
  await expect(page.locator('.member-panel')).toContainText('Votre abonnement est actif'); expect(state.actions).toContain('confirm');
  expect(await page.evaluate(() => sessionStorage.getItem('miamama-checkout-return'))).toBe(null);
});
test('Paid users see the renewal status, can use the portal, and never leak access after signing out', async ({ page }) => {
  const state = await account(page, { paid: true }); state.cancel = true;
  await page.goto('/#plus'); await ready(page); await expect(page.locator('.member-panel')).toContainText('Le renouvellement est arrêté');
  await page.locator('[data-action="billing-portal"]').click(); await expect(page).toHaveURL(/billing\.stripe\.com/);
  await page.goto('/#profil'); await ready(page); await page.locator('[data-action="sign-out"]').click();
  await expect.poll(() => page.evaluate(() => MietteBilling.active)).toBe(false);
  await page.goto('/#plus'); await expect(page.locator('.offer-hero')).toBeVisible();
  expect(state.actions).toContain('portal');
});
test('Cancellation and service errors keep free content available and do not create purchases', async ({ page }) => {
  const state = await account(page);
  await page.goto('/?checkout=cancelled#plus'); await ready(page);
  await expect(page.locator('.billing-feedback')).toContainText('interrompu');
  await page.route('**/api/billing', route => route.fulfill({ status: 503, json: { error: 'Paiements temporairement indisponibles.' } }));
  await page.evaluate(() => MietteBilling.refresh()); await expect(page.locator('[data-action="billing-refresh"]')).toBeVisible();
  await page.goto('/#aliments?q=ananas'); await page.locator('.food-card-open').click();
  await expect(page.locator('.food-explanation')).toBeVisible(); expect(state.purchases).toEqual([]);
});
test('Checkout choices and subscription management stay accessible on mobile', async ({ page }) => {
  const state = await account(page); await page.setViewportSize({ width: 320, height: 740 });
  async function check() { await page.evaluate(() => document.fonts.ready); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); const audit = await new AxeBuilder({ page }).analyze(); expect(audit.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id)).toEqual([]); }
  await page.goto('/#plus'); await ready(page); await check();
  state.paid = true; await page.evaluate(() => MietteBilling.refresh()); await expect(page.locator('.member-panel')).toBeVisible(); await check();
});

test('Recipe paywall keeps precautions public, checks the server and isolates downloaded preparations by account', async ({ page, context }) => {
  const state = await account(page, { loggedIn: true });
  const id = 'burger-poulet-croustillant';
  const target = require('../js/data.js').recipes.find(r => r.id === id);
  await page.goto('/#recettes?q=burger%20poulet'); await ready(page);
  expect(await page.evaluate(id => window.MietteData.recipes.find(r => r.id === id).steps, id)).toEqual([]);
  await page.locator('.recipe-card-open').click();
  await expect(page.locator('.recipe-paywall')).toContainText('Cette recette fait partie de Plus');
  await expect(page.locator('.advice-box')).toContainText(target.safety);
  await expect(page.locator('.sources-inline a').first()).toBeVisible();
  await expect(page.locator('.steps-list')).toHaveCount(0);
  await page.evaluate(() => { window.MietteBilling.state.access.active = true; });
  await page.locator('.recipe-paywall [data-action="recipe"]').click();
  await expect(page.locator('.recipe-paywall')).toContainText('Cette recette fait partie de Plus');
  state.paid = true;
  await page.evaluate(() => window.MietteBilling.refresh());
  await page.locator('.recipe-paywall [data-action="recipe"]').click();
  await expect(page.locator('.steps-list')).toContainText(target.steps[0]);
  await page.keyboard.press('Escape');
  await context.setOffline(true);
  await page.locator('.recipe-card-open').click();
  await expect(page.locator('.steps-list')).toContainText(target.steps[0]);
  await context.setOffline(false); await page.keyboard.press('Escape');
  await page.goto('/#profil'); await page.locator('[data-action="sign-out"]').click();
  await expect.poll(() => page.evaluate(() => window.MietteCloud.state.user)).toBe(null);
  expect(await page.evaluate(id => window.MietteData.recipes.find(r => r.id === id).steps, id)).toEqual([]);
  await page.goto('/#recettes?q=burger%20poulet'); await page.locator('.recipe-card-open').click();
  await expect(page.locator('.recipe-paywall')).toBeVisible();
  await expect(page.locator('.steps-list')).toHaveCount(0);
});

test('The free recipe selection is reachable and the early Plus offer never starts a purchase by itself', async ({ page }) => {
  const state = await account(page, { loggedIn: false });
  await page.goto('/'); await ready(page);
  await expect(page.locator('.premium-nudge-home')).toBeInViewport();
  await page.locator('.premium-nudge-home [data-action="plus-offer"]').click();
  await expect(page.locator('.plus-benefits')).toContainText('980 recettes complètes');
  expect(state.purchases).toEqual([]);
  await page.keyboard.press('Escape');
  await page.goto('/#recettes');
  await page.locator('[data-access="free"]').click();
  await expect(page.locator('#recipe-count')).toContainText('20 recettes');
  await page.locator('[data-action="more-recipes"]').click();
  await expect(page.locator('.recipe-card')).toHaveCount(20);
  await expect(page.locator('.recipe-access-tag.is-plus')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-access="free"]')).toHaveAttribute('aria-pressed', 'true');
});

test('A confirmed purchase started from Ce soir returns to dinner planning', async ({ page }) => {
  const state = await account(page); state.confirmPaid = true;
  await page.route('**/api/tonight', r => r.fulfill({ json: { meal: null, preferences: {}, trialUsed: true, paid: state.paid, history: [] } }));
  await page.addInitScript(() => sessionStorage.setItem('poum-dinner-checkout', String(Date.now() + 3600000)));
  await page.goto('/?checkout=success&session_id=cs_test_dinner_return#plus');
  await expect(page).toHaveURL(/#cesoir$/);
  await expect(page.locator('#tonight-form')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('poum-dinner-checkout'))).toBe(null);
});
