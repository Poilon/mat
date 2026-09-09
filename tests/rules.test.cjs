'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeProduct, isValidBarcode, normalize } = require('../js/rules.js');
const D = require('../js/data.js');
const analyze = (name, rest = {}) => analyzeProduct({ product_name: name, ...rest });
const flagIds = analysis => analysis.flags.map(f => f.id);

test('French search normalizes accents, uppercase ligatures and taxonomy separators', () => {
  assert.equal(normalize('  ŒUFS à-la_coque  '), 'oeufs a la coque');
  assert.equal(normalize('BŒUF'), 'boeuf');
});
test('An empty or incomplete product never gets a compatible verdict', () => {
  for (const product of [{}, { product_name: 'Produit inconnu' }, { product_name: 'Pâtes', nutrition_grades: 'a' }, { ingredients_text: 'eau, sucre' }]) assert.equal(analyzeProduct(product).status, 'unknown');
  assert.deepEqual(analyzeProduct({}).missing, ['Ingrédients non renseignés', 'Catégorie non renseignée']);
});
test('Clinical compatibility is never inferred from Nutri-Score', () => {
  for (const grade of ['a', 'b', 'c', 'd', 'e']) assert.equal(analyze('Salade composée', { nutrition_grades: grade }).status, 'unknown');
});
test('Even rich product data cannot produce a green verdict', () => {
  const examples = ['Eau minérale', 'Pois chiches en conserve', 'Yaourt au lait pasteurisé', 'Lait UHT', 'Pain complet', 'Saumon bien cuit', 'Parmesan', 'Huile d’olive'];
  examples.forEach(name => assert.notEqual(analyze(name, { categories_tags: ['fr:aliments'], ingredients_text: 'ingrédients renseignés' }).status, 'compatible'));
});
test('Raw milk is flagged, including thermised and negated pasteurisation', () => {
  ['Lait cru', 'Lait non pasteurisé', 'Lait thermisé', 'Raw milk', 'Unpasteurized milk'].forEach(name => assert.equal(analyze(name).status, 'avoid', name));
});
test('Pasteurisation does not clear soft cheese', () => {
  for (const name of ['Brie au lait pasteurisé', 'Camembert pasteurisé', 'Morbier', 'Reblochon', 'Roquefort']) assert.equal(analyze(name).status, 'avoid', name);
});
test('The hard cooked cheese exception is distinguished from raw milk', () => {
  const result = analyze('Comté au lait cru');
  assert.equal(result.status, 'unknown');
  assert.ok(flagIds(result).includes('hard-cheese'));
  assert.ok(!flagIds(result).includes('raw-milk'));
});
test('Multiple risk signals accumulate and avoidance wins over limitation', () => {
  const result = analyze('Tiramisu au rhum et café', { ingredients_text: 'Œufs, mascarpone, café, rhum' });
  assert.equal(result.status, 'avoid');
  assert.ok(flagIds(result).includes('alcohol'));
  assert.ok(flagIds(result).includes('caffeine'));
  assert.ok(flagIds(result).includes('eggs'));
  assert.ok(flagIds(result).includes('dairy'));
});
test('Eggs as an ingredient do not make a cooked biscuit forbidden', () => {
  const result = analyze('Biscuits cuits', { ingredients_text: 'Farine de blé, sucre, œufs' });
  assert.equal(result.status, 'unknown');
  assert.ok(flagIds(result).includes('eggs'));
});
test('French and English high-risk fish are recognized', () => {
  ['Saumon fumé', 'Smoked salmon', 'Sashimi', 'Tarama', 'Swordfish', 'Espadon', 'Requin', 'Lamproie'].forEach(name => assert.equal(analyze(name).status, 'avoid', name));
});
test('Mercury limitation persists in canned tuna', () => {
  assert.equal(analyze('Thon au naturel en conserve').status, 'limit');
  assert.equal(analyze('Canned tuna', { ingredients_text: 'Tuna, water' }).status, 'limit');
});
test('Immunity cannot remove any non-toxoplasmosis precaution', () => {
  const p = { product_name: 'Saumon fumé', toxoplasmosis_immune: true };
  assert.equal(analyzeProduct(p).status, 'avoid');
});
test('Alcohol requires attention even under a misleading non-alcoholic claim', () => {
  assert.equal(analyze('Bière sans alcool', { nutriments: { alcohol_100g: 0.5 } }).status, 'avoid');
  assert.equal(analyze('Bière sans alcool', { nutriments: { alcohol_100g: 0 } }).status, 'unknown');
  assert.equal(analyze('Bière 0,0 %', { nutriments: { alcohol_100g: 0 } }).status, 'unknown');
  assert.equal(analyze('Dessert', { ingredients_text: 'Sucre, alcool, cacao' }).status, 'avoid');
});
test('Wine vinegar is not classified as drinking alcohol', () => {
  assert.equal(analyze('Vinaigre de vin rouge', { categories_tags: ['en:wine-vinegars'], ingredients_text: 'Vinaigre de vin rouge' }).status, 'unknown');
});
test('Soy foods are distinguished from trace allergens and lecithin', () => {
  ['Tofu', 'Boisson au soja', 'Tempeh'].forEach(name => assert.equal(analyze(name).status, 'avoid'));
  assert.ok(!flagIds(analyze('Biscuit', { ingredients_text: 'Sucre, lécithine de soja', allergens_tags: ['en:soybeans'] })).includes('soy'));
});
test('Nested ingredients are examined and recursion is bounded', () => {
  assert.ok(flagIds(analyze('Dessert', { ingredients: [{ text: 'fourrage', ingredients: [{ id: 'fr:rhum' }] }] })).includes('alcohol'));
  let nested = []; for (let i = 0; i < 100; i++) nested = [{ text: 'préparation', ingredients: nested }];
  assert.doesNotThrow(() => analyze('Dessert', { ingredients: nested }));
});
test('Input is resilient to missing types', () => {
  assert.doesNotThrow(() => analyzeProduct({ product_name: 12, categories_tags: null, ingredients: [null, {}, 4], nutriments: null }));
});
test('Valid barcodes include EAN8, UPC12, EAN13 and GTIN14', () => {
  ['96385074', '036000291452', '3017620422003', '03017620422003', '3 017620 422003'].forEach(code => assert.equal(isValidBarcode(code), true, code));
});
test('Wrong length, wrong checksum and non-numeric barcodes are rejected', () => {
  ['', '1234567', '3017620422004', 'abc3017620422003', '1234567890'].forEach(code => assert.equal(isValidBarcode(code), false, code));
});
test('The editorial guide has valid source references and actionable preparation', () => {
  assert.ok(D.foods.length >= 60);
  assert.equal(new Set(D.foods.map(f => f.id)).size, D.foods.length);
  D.foods.forEach(f => {
    assert.ok(D.statuses[f.status], f.name);
    assert.ok(f.preparation.length > 0, f.name);
    f.sources.forEach(s => assert.ok(D.sources[s], f.name));
    assert.ok(D.categories.some(c => c.id === f.category));
  });
});
test('Recipes have usable positive quantities, preparation and valid related foods', () => {
  assert.equal(new Set(D.recipes.map(r => r.id)).size, D.recipes.length);
  D.recipes.forEach(r => {
    assert.ok(r.steps.length >= 3 && r.safety.length > 20);
    assert.ok(r.servings > 0);
    r.ingredients.forEach(i => assert.ok(i.quantity > 0 && i.name));
    r.foods.forEach(id => assert.ok(D.foods.some(f => f.id === id), id));
    const quantities = r.ingredients.map(i => i.quantity * 4 / r.servings);
    assert.ok(quantities.every(v => Number.isFinite(v) && v > 0));
  });
});
