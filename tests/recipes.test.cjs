const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/data.js');

test('The expanded catalogue preserves saved recipe IDs and covers nine distinct collections', () => {
  assert.equal(D.recipes.length, 1000);
  assert.equal(new Set(D.recipes.map(r => r.title)).size, 1000);
  assert.equal(new Set(D.recipes.map(r => JSON.stringify(r.steps))).size, 1000);
  const originalIDs = ['sunny-bowl', 'lemon-salmon', 'green-pasta', 'morning-porridge', 'lentil-soup', 'roasted-chickpeas', 'spinach-frittata', 'apple-oat', 'cod-rice', 'tomato-pasta'];
  originalIDs.forEach(id => assert.ok(D.recipes.some(r => r.id === id), id));
  assert.equal(D.recipeCollections.length, 9);
  D.recipeCollections.forEach(c => assert.ok(D.recipes.filter(r => r.collection === c.id).length >= 10, c.id));
  D.recipes.forEach(r => {
    assert.ok(D.recipeCollections.some(c => c.id === r.collection), r.id);
    assert.ok(['lunch', 'dinner', 'breakfast', 'snack', 'dessert', 'apero'].includes(r.type), r.id);
    assert.ok(Number.isFinite(r.time) && r.time > 0, r.id);
    assert.equal(r.servings, 2, `${r.id}: planner quantities use a two-person recipe`);
    assert.equal(typeof r.vegetarian, 'boolean');
  });
});

test('Every new recipe has source-backed precautions and locally available, precached photography', () => {
  const worker = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
  D.recipes.forEach(r => {
    const photo = `assets/${r.image}.jpg`;
    assert.ok(fs.existsSync(path.join(__dirname, '..', photo)), `${r.id}: ${photo}`);
    assert.ok(worker.includes(photo), `${r.id}: photo must work offline`);
    if (![2,3].includes(r.edition)) return;
    assert.ok(r.sources.length && r.sources.every(id => D.sources[id]), r.id);
    assert.ok(r.precautions.length > 0, r.id);
    assert.ok(r.allergens.length > 15, r.id);
    if (r.ingredients.some(i => /poulet|dinde/i.test(i.name))) {
      assert.ok(r.precautions.includes('chicken'), r.id);
      assert.ok(r.steps.join(' ').includes('74 °C'), r.id);
      assert.equal(r.vegetarian, false, r.id);
    }
    if (r.ingredients.some(i => /saumon|cabillaud/i.test(i.name))) {
      assert.ok(r.precautions.includes('fish'), r.id);
      assert.equal(r.vegetarian, false, r.id);
    }
    if (r.ingredients.some(i => /^œuf$/i.test(i.name))) assert.ok(r.precautions.includes('eggs'), r.id);
    if (r.ingredients.some(i => /farine/i.test(i.name))) assert.ok(r.precautions.some(n => n === 'flour' || n === 'eggs'), r.id);
  });
});
