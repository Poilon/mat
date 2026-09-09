'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/data.js');
const { analyzeProduct, normalize } = require('../js/rules.js');
const byId = id => D.foods.find(f => f.id === id);

test('The expanded food guide has individual explanations and complete evidence references', () => {
  assert.equal(D.foods.length, 360);
  assert.equal(D.foods.filter(f => f.category === 'produce').length, 105);
  assert.equal(new Set(D.foods.map(f => f.evidence.why)).size, 360, 'Each food needs its own context');
  for (const f of D.foods) {
    const e = f.evidence, p = D.profiles[e.profile];
    assert.ok(p, f.id);
    assert.ok(['family', 'specific'].includes(e.basis), f.id);
    assert.ok(e.why.length > 70 && p.mechanism.length > 100 && p.condition.length > 60, f.id);
    assert.ok(f.preparation.length >= 2 && f.preparation.every(s => s.length > 20), f.id);
    assert.ok(e.sources.length && p.sources.length, f.id);
    for (const id of [...e.sources, ...p.sources, ...f.sources]) {
      assert.ok(D.sources[id]?.name && D.sources[id]?.title, `${f.id}: ${id}`);
      assert.equal(new URL(D.sources[id].url).protocol, 'https:');
    }
    if (f.category === 'produce') assert.ok(['fruit', 'vegetable', 'herb'].includes(f.family), f.id);
  }
});

test('Preparation and species change advice; washing, pasteurising and cooking are not interchangeable', () => {
  for (const id of ['pineapple', 'sweet-potato']) {
    assert.equal(byId(id).status, 'compatible');
    assert.match(normalize(byId(id).preparation.join(' ')), /laver/);
    assert.equal(byId(id).evidence.basis, 'family');
  }
  assert.equal(byId('sprouts').status, 'avoid');
  assert.equal(byId('brussels-sprouts').status, 'compatible');
  assert.equal(byId('brie').status, 'avoid');
  assert.notEqual(byId('comte').status, 'avoid');
  assert.equal(byId('tuna').status, 'limit');
  for (const id of ['canned-sardines', 'canned-mackerel']) {
    const f = byId(id);
    assert.equal(f.status, 'compatible');
    assert.match(D.profiles[f.evidence.profile].condition, /froide/);
    assert.doesNotMatch(f.preparation.join(' '), /cuire.*cœur/);
  }
  assert.match(D.profiles.poultry.condition + D.profiles.poultry.steps.join(' '), /74 °C/);
  assert.match(D.profiles.caffeine.condition, /200 mg/);
  assert.equal(byId('rice').status, 'compatible');
  assert.match(byId('rice').preparation.join(' '), /24 heures/);
});

test('OFF explains which field triggered a signal and never turns an unknown product green', () => {
  const a = analyzeProduct({ product_name: 'Dessert au café', ingredients_text: 'Mascarpone, œufs, rhum', categories_tags: ['en:desserts'] });
  assert.equal(a.status, 'avoid');
  assert.ok(a.unknowns.length >= 3);
  const alcohol = a.flags.find(f => f.id === 'alcohol');
  assert.deepEqual(alcohol.matches, [{ field: 'ingredients', label: 'Ingrédients', term: 'rhum' }]);
  for (const flag of a.flags) {
    assert.ok(flag.matches.length && flag.matches.every(m => m.term.length > 0 && m.term.length <= 120));
    assert.ok(flag.explanation.mechanism && flag.explanation.condition);
    assert.ok(flag.sources.every(id => D.sources[id]));
  }
  const flags = name => analyzeProduct({ product_name: name }).flags.map(f => f.id);
  assert.ok(!flags('Brussels sprouts').includes('sprouts'));
  assert.ok(flags('Alfalfa sprouts').includes('sprouts'));
  assert.ok(flags('Brussels sprouts and alfalfa sprouts').includes('sprouts'));
  assert.ok(!flags('Chocolate cereal bar').includes('mercury'));
  assert.ok(flags('Bar sauvage').includes('mercury'));
  assert.equal(analyzeProduct({ product_name: 'Eau', nutrition_grades: 'a' }).status, 'unknown');
});

test('Spices cover culinary forms, variable blends and documented exceptions without losing existing aromatics', () => {
  assert.equal(D.foods.filter(f => f.category === 'seasoning').length, 60);
  assert.equal(D.foods.filter(f => f.seasoningFamily).length, 73);
  for (const id of ['cumin', 'paprika', 'turmeric', 'nutmeg', 'saffron', 'vanilla']) {
    assert.equal(byId(id).status, 'compatible', id);
    assert.equal(byId(id).seasoningFamily, 'spice');
    assert.match(D.profiles[byId(id).evidence.profile].condition, /culinaire|assaisonner/);
  }
  assert.equal(byId('cinnamon-cassia').status, 'limit');
  assert.equal(byId('fenugreek').status, 'precaution');
  assert.equal(byId('sage-leaf').status, 'unknown');
  assert.equal(byId('liquorice').status, 'avoid');
  assert.equal(byId('liquorice').seasoningFamily, 'spice');
  assert.equal(byId('ginger').category, 'produce');
  assert.equal(byId('ginger').seasoningFamily, 'herb');
  for (const id of ['curry-powder', 'ras-el-hanout', 'garam-masala', 'zaatar']) assert.equal(byId(id).evidence.profile, 'spiceBlend');
  assert.ok(D.recipes.some(r => r.foods.includes('cumin')));
});
