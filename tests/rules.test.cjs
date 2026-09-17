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
test('Product summaries distinguish missing information, detected preparation needs and no detected signal',()=>{
 assert.equal(analyzeProduct({}).label,'Fiche incomplète');
 const rice=analyze('Riz complet',{categories_tags:['en:rices'],ingredients_text:'Riz complet'});assert.equal(rice.label,'Aucun signal repéré');assert.equal(rice.status,'unknown');assert.match(rice.summary,/données disponibles/);
 const milk=analyze('Lait UHT',{categories_tags:['en:milks'],ingredients_text:'Lait'});assert.equal(milk.status,'precaution');assert.equal(milk.label,'Précautions de préparation');assert(milk.facts.some(f=>f.id==='uht'));assert.match(milk.summary,/UHT/);
 const spread=analyze('Pâte à tartiner',{categories_tags:['en:spreads'],ingredients_text:'Sucre, lait écrémé en poudre, cacao'});assert(spread.facts.some(f=>f.id==='milk-powder'));assert.match(spread.summary,/lait en poudre/);
 const partial=analyze('Produit',{ingredients_text:'Sucre'});assert.equal(partial.label,'Fiche incomplète');assert.deepEqual(partial.missing,['Catégorie non renseignée']);
 const invalid=analyze('Riz',{categories_tags:['en:rices'],ingredients_text:'Riz',data_quality_errors_tags:['en:example-error']});assert.equal(invalid.label,'Fiche incomplète');assert.equal(invalid.qualityIssues,true);
});
test('Treatment mentions are traced to fields, do not read negations as affirmative, and never clear stronger signals',()=>{
 for(const name of ['Lait non pasteurisé','Lait not pasteurized','Lait non UHT','Sans lait pasteurisé'])assert.equal(analyze(name).facts.filter(f=>['uht','pasteurised'].includes(f.id)).length,0,name);
 const brie=analyze('Brie au lait pasteurisé');assert.equal(brie.status,'avoid');assert(brie.facts.some(f=>f.id==='pasteurised'));
 const tuna=analyze('Thon en conserve');assert.equal(tuna.status,'limit');assert(tuna.facts.some(f=>f.id==='canned'));
 const mixed=analyze('Dessert',{ingredients_text:'Lait pasteurisé, rhum'});assert.equal(mixed.status,'avoid');assert.equal(mixed.facts[0].matches[0].field,'ingredients');assert.equal(mixed.flags[0].id,'alcohol');
});
test('Raw milk is flagged, including thermised and negated pasteurisation', () => {
  ['Lait cru', 'Lait non pasteurisé', 'Lait thermisé', 'Raw milk', 'Unpasteurized milk'].forEach(name => assert.equal(analyze(name).status, 'avoid', name));
});
test('Pasteurisation does not clear soft cheese', () => {
  for (const name of ['Brie au lait pasteurisé', 'Camembert pasteurisé', 'Morbier', 'Reblochon', 'Roquefort']) assert.equal(analyze(name).status, 'avoid', name);
});
test('The hard cooked cheese exception is distinguished from raw milk', () => {
  const result = analyze('Comté au lait cru');
  assert.equal(result.status, 'precaution');
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
  assert.equal(result.status, 'precaution');
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
