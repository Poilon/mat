'use strict';
const { HttpError } = require('./http.cjs');
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value + 'T12:00:00Z').getTime()) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
function validateNotebook(input) {
  const bad = () => { throw new HttpError(400, 'Ce carnet est incomplet ou contient des données invalides.'); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return bad();
  if (typeof input.name !== 'string' || input.name.length > 30 || typeof input.vegetarian !== 'boolean') return bad();
  if (!Array.isArray(input.favorites) || input.favorites.length > 300 || !input.favorites.every(v => typeof v === 'string' && /^(food|recipe):[\w-]{1,100}$/.test(v))) return bad();
  if (!Array.isArray(input.products) || input.products.length > 100 || !input.products.every(p => p && typeof p === 'object' && /^\d{4,24}$/.test(String(p.code)))) return bad();
  if (!input.menus || typeof input.menus !== 'object' || Array.isArray(input.menus) || Object.keys(input.menus).length > 1000) return bad();
  const menus = {};
  for (const [date, slots] of Object.entries(input.menus)) {
    if (!validDate(date) || !slots || typeof slots !== 'object' || Array.isArray(slots)) return bad();
    menus[date] = {};
    for (const [meal, recipe] of Object.entries(slots)) {
      if (!['lunch', 'dinner'].includes(meal) || typeof recipe !== 'string' || !/^[\w-]{1,100}$/.test(recipe)) return bad();
      menus[date][meal] = recipe;
    }
  }
  if (!Array.isArray(input.shopping) || input.shopping.length > 500) return bad();
  const shopping = input.shopping.map(i => {
    if (!i || typeof i.id !== 'string' || !/^[\w-]{1,100}$/.test(i.id) || typeof i.name !== 'string' || !i.name.trim() || i.name.length > 150 || typeof i.unit !== 'string' || i.unit.length > 20 || !Number.isFinite(i.quantity) || i.quantity < 0 || i.quantity > 1000000 || typeof i.checked !== 'boolean') return bad();
    return { id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, checked: i.checked };
  });
  if (new Set(shopping.map(i => i.id)).size !== shopping.length) return bad();
  let diet;try { diet = require('../js/diet.js').validate(input.diet); } catch { return bad(); }
  // Product metadata is untrusted at rest and sanitized again by the existing client normalizer.
  return { diet, name: input.name, vegetarian: input.vegetarian, favorites: [...new Set(input.favorites)], products: input.products, menus, shopping };
}
module.exports = { validateNotebook };
