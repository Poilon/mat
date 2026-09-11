const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const { freeIDs, publicRecipe, readRecipe, recipeSteps } = require('../server/recipe-access.cjs');
test('The public catalogue keeps 20 complete recipes and all precautions, without the 80 Plus preparations', () => {
  const rows = D.recipes.map(publicRecipe);
  assert.equal(freeIDs.size, 20);
  assert.equal(rows.filter(r => r.steps.length).length, 20);
  assert.equal(rows.filter(r => r.premium && !r.steps.length).length, 80);
  for (const r of rows) { const full = D.recipes.find(f => f.id === r.id); assert.equal(r.safety, full.safety); assert.deepEqual(r.ingredients, full.ingredients); assert.equal(r.allergens, full.allergens); assert.deepEqual(r.sources, full.sources); }
});
test('Recipe steps require a server entitlement; guest, unpaid and expired accounts cannot retrieve them', async () => {
  const premium = D.recipes.find(r => !freeIDs.has(r.id));
  const config = { configured: true, live: true };
  for (const user of [null, { id: 'expired' }]) await assert.rejects(readRecipe(premium.id, { config, user, repo: { access: async () => ({ active: false }) } }), e => e.status === (user ? 402 : 401));
  const checks = [];
  const paid = await readRecipe(premium.id, { config, user: { id: 'paid' }, repo: { access: async (...args) => { checks.push(args); return { active: true }; } } });
  assert.deepEqual(checks, [['paid', true]]);
  assert.deepEqual(paid.recipes, [{ id: premium.id, steps: premium.steps }]);
  assert.equal(paid.access, 'plus');
  await assert.rejects(readRecipe('__proto__', { config }), e => e.status === 404);
});
test('The free selection and temporary launch access are explicit; week responses contain only the selected preparations', async () => {
  const free = await readRecipe('sunny-bowl', { config: { configured: true } });
  assert.equal(free.access, 'free');
  const premium = D.recipes.find(r => !freeIDs.has(r.id));
  const launch = await readRecipe(premium.id, { config: { configured: false } });
  assert.equal(launch.access, 'launch');
  assert.deepEqual(recipeSteps(['sunny-bowl', premium.id, 'sunny-bowl']).map(r => r.id), ['sunny-bowl', premium.id]);
});

test('A recipe response arriving after a reset or account switch cannot repopulate the wrong cache', async () => {
  const vm = require('node:vm'), fs = require('node:fs');
  for (const change of ['reset', 'owner']) {
    const premium = publicRecipe(D.recipes.find(r => !freeIDs.has(r.id)));
    const storage = new Map(); let resolve;
    const cloud = { storageKey: 'account-a', request: () => new Promise(r => { resolve = r; }) };
    const window = { MietteData: { recipes: [premium] }, MietteCloud: cloud, MietteRuntime: {}, addEventListener() {} };
    const context = { window, localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../js/recipe-access.js'), 'utf8'), context);
    const access = window.MietteRecipeAccess;
    const pending = access.load(premium.id);
    if (change === 'reset') access.clear(); else { cloud.storageKey = 'account-b'; access.ensure(); }
    resolve({ recipes: [{ id: premium.id, steps: ['Authorized preparation for the old request'] }] });
    await assert.rejects(pending, /carnet ou le compte a changé/);
    assert.equal(premium.steps.length, 0);
    assert.equal(storage.size, 0);
  }
});
