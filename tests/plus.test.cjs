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
