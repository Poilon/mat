const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const Plus = require('../js/plus.js');

test('The free preview respects cooking time and vegetarian choices across the real catalogue', () => {
  let seed = 729;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);
  const variations = new Set();
  for (const vegetarian of [true, false]) for (const maxTime of [30, 45, 120]) for (let i = 0; i < 40; i++) {
    const entries = Plus.preview(D.recipes, { start: '2026-09-14', vegetarian, maxTime }, random);
    assert.equal(entries.length, 4);
    assert.equal(new Set(entries.map(e => e.recipeId)).size, 4);
    assert.deepEqual(entries.map(e => [e.date, e.meal]), [['2026-09-14', 'lunch'], ['2026-09-14', 'dinner'], ['2026-09-15', 'lunch'], ['2026-09-15', 'dinner']]);
    const recipes = entries.map(e => D.recipes.find(r => r.id === e.recipeId));
    recipes.forEach(r => {
      assert.ok(['lunch', 'dinner'].includes(r.type));
      assert.ok(r.time <= maxTime);
      if (vegetarian) assert.equal(r.vegetarian, true);
    });
    assert.equal(new Set(recipes.map(r => r.collection)).size, 4);
    variations.add(entries.map(e => e.recipeId).join(','));
  }
  assert.ok(variations.size > 150);
});

test('Preview dates cross daylight saving, month, leap day and year boundaries correctly', () => {
  for (const [start, end] of [['2026-10-25', '2026-10-26'], ['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29'], ['2026-02-28', '2026-03-01']]) {
    assert.equal(Plus.preview(D.recipes, { start })[3].date, end);
  }
  for (const start of ['2026-02-30', 'tomorrow', '__proto__', null]) assert.throws(() => Plus.preview(D.recipes, { start }), /date/);
  assert.throws(() => Plus.preview(D.recipes, { start: '2026-09-14', maxTime: 20 }), /durée/);
  assert.throws(() => Plus.preview(D.recipes.slice(0, 2), { start: '2026-09-14' }), /Pas assez/);
});

test('Adding preview meals preserves occupied slots, unrelated dates and concurrent edits, and is idempotent', () => {
  const entries = Plus.preview(D.recipes, { start: '2026-09-14' });
  const existing = { '2026-09-14': { lunch: 'sunny-bowl' }, '2026-09-18': { dinner: 'lentil-soup' } };
  const original = structuredClone(existing);
  const result = Plus.fillEmpty(existing, entries, D.recipes);
  assert.equal(result.added, 3); assert.equal(result.occupied, 1);
  assert.equal(result.menus['2026-09-14'].lunch, 'sunny-bowl');
  assert.deepEqual(result.menus['2026-09-18'], original['2026-09-18']);
  assert.deepEqual(existing, original);
  const repeated = Plus.fillEmpty(result.menus, entries, D.recipes);
  assert.equal(repeated.added, 0); assert.equal(repeated.occupied, 4);
  assert.deepEqual(repeated.menus, result.menus);
  existing['2026-09-15'] = { dinner: 'green-pasta' };
  const afterSync = Plus.fillEmpty(existing, entries, D.recipes);
  assert.equal(afterSync.added, 2); assert.equal(afterSync.menus['2026-09-15'].dinner, 'green-pasta');
});

test('Invalid dates, slots and removed recipes cannot pollute the notebook', () => {
  const result = Plus.fillEmpty({}, [
    { date: '__proto__', meal: 'lunch', recipeId: 'sunny-bowl' },
    { date: '2026-09-14', meal: '__proto__', recipeId: 'sunny-bowl' },
    { date: '2026-09-14', meal: 'lunch', recipeId: 'missing-recipe' },
    { date: '2026-02-30', meal: 'dinner', recipeId: 'sunny-bowl' }, null
  ], D.recipes);
  assert.equal(result.added, 0); assert.equal(result.invalid, 5);
  assert.deepEqual(result.menus, {});
});

test('Complete weeks contain seven or fourteen unique meals and honor time, exclusions and vegetarian choices', () => {
  for (const meals of ['dinner', 'both']) for (const vegetarian of [false, true]) for (const maxTime of [30, 45, 120]) {
    const options = { start: '2026-12-28', meals, vegetarian, maxTime, dislikes: ['mushrooms', 'fish'], pantry: ['chickpeas'], mood: 'comfort' };
    const entries = Plus.compose(D.recipes, options);
    assert.equal(entries.length, meals === 'both' ? 14 : 7);
    assert.equal(new Set(entries.map(e => e.recipeId)).size, entries.length);
    assert.equal(entries.at(-1).date, '2027-01-03');
    entries.forEach((e, i) => {
      const r = D.recipes.find(r => r.id === e.recipeId);
      assert.ok(r.time <= maxTime);
      if (vegetarian) assert.equal(r.vegetarian, true);
      assert.doesNotMatch(r.ingredients.map(i => i.name).join(' '), /champignon|saumon|cabillaud|thon|truite/i);
      assert.equal(e.meal, meals === 'both' && i % 2 === 0 ? 'lunch' : 'dinner');
    });
  }
});

test('Pantry preference uses actual ingredients; mood guides choices without overriding exclusions', () => {
  const prefs = { start: '2026-09-14', maxTime: 45, pantry: ['lentils'], mood: 'comfort' };
  const entries = Plus.compose(D.recipes, prefs, [], () => .5);
  const first = D.recipes.find(r => r.id === entries[0].recipeId);
  assert.ok(first.ingredients.some(i => /lentilles/i.test(i.name)));
  assert.deepEqual(Plus.pantryMatches({ ingredients: [{ name: 'Œuf' }] }, ['eggs']).map(i => i.id), ['eggs']);
  assert.deepEqual(Plus.pantryMatches({ foods: ['lentils'], ingredients: [{ name: 'Carotte' }] }, ['lentils']), []);
  const comfortable = Plus.compose(D.recipes, { ...prefs, pantry: [] }, [], () => .5);
  assert.ok(['italie', 'four'].includes(D.recipes.find(r => r.id === comfortable[0].recipeId).collection));
  assert.throws(() => Plus.compose(D.recipes, { ...prefs, meals: 'both', maxTime: 30, dislikes: ['cheese', 'onion', 'coconut', 'eggs', 'fish', 'mushrooms'] }), /Il reste/);
});

test('Regeneration keeps pinned dishes and a single replacement leaves all other slots untouched', () => {
  const prefs = { start: '2026-09-14', maxTime: 45 };
  const entries = Plus.compose(D.recipes, prefs);
  entries[1].locked = true; entries[4].locked = true;
  const regenerated = Plus.compose(D.recipes, prefs, entries);
  assert.deepEqual(regenerated[1], entries[1]); assert.deepEqual(regenerated[4], entries[4]);
  const swapped = Plus.swap(D.recipes, regenerated, 2, prefs);
  assert.notEqual(swapped[2].recipeId, regenerated[2].recipeId);
  assert.equal(new Set(swapped.map(e => e.recipeId)).size, 7);
  regenerated.forEach((e, i) => { if (i !== 2) assert.deepEqual(swapped[i], e); });
  assert.throws(() => Plus.swap(D.recipes, entries, 1, prefs), /épingle/);
  const meat = D.recipes.find(r => ['lunch', 'dinner'].includes(r.type) && !r.vegetarian && r.time <= 45);
  assert.throws(() => Plus.compose(D.recipes, { ...prefs, vegetarian: true }, [{ ...entries[0], recipeId: meat.id, locked: true }]), /épingle/);
});

test('Saving revisions updates only workshop-owned slots and preserves manual and concurrent changes', () => {
  const prefs = { start: '2026-09-14' }, entries = Plus.compose(D.recipes, prefs);
  const original = { '2026-09-14': { dinner: 'sunny-bowl' }, '2026-09-30': { lunch: 'green-pasta' } };
  const saved = Plus.applyPlan(original, entries, D.recipes);
  assert.equal(saved.added, 6); assert.equal(saved.occupied, 1); assert.equal(saved.applied.length, 6);
  assert.deepEqual(original, { '2026-09-14': { dinner: 'sunny-bowl' }, '2026-09-30': { lunch: 'green-pasta' } });
  assert.equal(Plus.applyPlan(saved.menus, entries, D.recipes, saved.applied).updated, 0);
  let changed = Plus.swap(D.recipes, entries, 2, prefs);
  changed = Plus.swap(D.recipes, changed, 3, prefs);
  // Another device edits a previously managed slot before this workshop is saved again.
  saved.menus[changed[3].date].dinner = entries[0].recipeId;
  const updated = Plus.applyPlan(saved.menus, changed, D.recipes, saved.applied);
  assert.equal(updated.updated, 1); assert.equal(updated.occupied, 2);
  assert.equal(updated.menus[changed[2].date].dinner, changed[2].recipeId);
  assert.equal(updated.menus[changed[3].date].dinner, entries[0].recipeId);
  assert.equal(updated.menus['2026-09-14'].dinner, 'sunny-bowl');
  assert.deepEqual(updated.menus['2026-09-30'], { lunch: 'green-pasta' });
});

test('Grocery totals preserve units and preparation details; repeated completion is idempotent', () => {
  const recipes = [{ id: 'a', ingredients: [{ name: 'Carotte', quantity: 1, unit: '' }, { name: 'Lait pasteurisé', quantity: 200, unit: 'ml' }, { name: 'Eau', quantity: 400, unit: 'ml' }] }, { id: 'b', ingredients: [{ name: 'Carotte', quantity: 2, unit: '' }, { name: 'Carotte', quantity: 100, unit: 'g' }, { name: 'Lait cru', quantity: 200, unit: 'ml' }] }];
  const shopping = Plus.shopping([{ recipeId: 'a' }, { recipeId: 'b' }], recipes);
  assert.equal(shopping.length, 4);
  assert.equal(shopping.find(i => i.name === 'Carotte' && !i.unit).quantity, 3);
  assert.equal(shopping.find(i => i.name === 'Carotte' && i.unit === 'g').quantity, 100);
  let serial = 0;
  const existing = [{ id: 'larger', name: 'Carotte', quantity: 5, unit: '', checked: false }, { id: 'done', name: 'Lait pasteurisé', quantity: 200, unit: 'ml', checked: true }, { id: 'extra', name: 'Pain', quantity: 1, unit: '', checked: false }];
  const merged = Plus.mergeShopping(existing, shopping, () => 'new-' + ++serial);
  assert.equal(merged.find(i => i.id === 'larger').quantity, 5);
  assert.deepEqual(merged.find(i => i.id === 'done'), existing[1]);
  assert.deepEqual(Plus.mergeShopping(merged, shopping, () => 'new-' + ++serial), merged);
  assert.equal(existing.length, 3);
});

test('Persisted drafts reject broken weeks and stale recipes, retaining pending preference edits as unsaved', () => {
  const options = Plus.preferences({ start: '2026-09-14' });
  const entries = Plus.compose(D.recipes, options), items = Plus.shopping(entries, D.recipes);
  const draft = { options, entries, applied: [], owned: [items[0].key], dirty: false };
  assert.deepEqual(Plus.restore(draft, D.recipes, options), draft);
  assert.equal(Plus.restore({ ...draft, options: { ...options, meals: 'both' } }, D.recipes, options).dirty, true);
  assert.equal(Plus.restore({ ...draft, options: { ...options, start: '2026-09-21' } }, D.recipes, options).dirty, true);
  for (const bad of [null, { ...draft, entries: [null] }, { ...draft, entries: entries.map((e, i) => i === 2 ? { ...e, date: '2026-12-25' } : e) }, { ...draft, entries: entries.map(e => ({ ...e, recipeId: 'removed' })) }]) {
    assert.deepEqual(Plus.restore(bad, D.recipes, options).entries, []);
  }
});
