/* Menu inspiration and shopping helpers. Browser state never proves a paid entitlement. */
(root => {
  'use strict';
  const Diet = typeof module !== 'undefined' && module.exports ? require('./diet.js') : root.PoumDiet;
  const offer = Object.freeze({ stage: 'launch', defaultPlan: 'pass', plans: Object.freeze([
    Object.freeze({ id: 'pass', name: 'Le pass 9 mois', cents: 2990, months: 9, recurring: false, cadence: 'en une fois', terms: '9 mois d’accès, sans renouvellement automatique.' }),
    Object.freeze({ id: 'monthly', name: 'Au fil des mois', cents: 490, months: 1, recurring: true, cadence: 'par mois', terms: 'Abonnement mensuel renouvelé automatiquement, résiliable à tout moment pour la prochaine échéance.' })
  ]) });
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[œŒ]/g, 'oe').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const pantry = [
    { id: 'pasta', label: 'Pâtes', pattern: /\b(pates|macaronis|coquillettes|orzo|vermicelles|nouilles|lasagnes)\b/ },
    { id: 'rice', label: 'Riz', pattern: /\briz\b/ },
    { id: 'chickpeas', label: 'Pois chiches', pattern: /\bpois chiches\b/ },
    { id: 'lentils', label: 'Lentilles', pattern: /\blentilles\b/ },
    { id: 'zucchini', label: 'Courgettes', pattern: /\bcourgettes?\b/ },
    { id: 'carrot', label: 'Carottes', pattern: /\bcarottes?\b/ },
    { id: 'tomato', label: 'Tomates', pattern: /\btomates?\b/ },
    { id: 'spinach', label: 'Épinards', pattern: /\bepinards\b/ },
    { id: 'eggs', label: 'Œufs', pattern: /\boeufs?\b/ },
    { id: 'chicken', label: 'Poulet', pattern: /\bpoulet\b/ },
    { id: 'potato', label: 'Pommes de terre', pattern: /\bpommes? de terre\b/ },
    { id: 'broccoli', label: 'Brocoli', pattern: /\bbrocoli\b/ }
  ];
  const dislikes = [
    { id: 'fish', label: 'Poisson', pattern: /\b(saumon|cabillaud|poisson|truite|thon|sardines?|anchois|colin|merlu|lieu)\b/ },
    { id: 'mushrooms', label: 'Champignons', pattern: /\bchampignons?|shiitakes?\b/ },
    { id: 'eggs', label: 'Œufs', pattern: /\boeufs?\b/ },
    { id: 'cheese', label: 'Fromage', pattern: /\b(fromage|ricotta|parmesan|comte|mozzarella|cheddar|feta|burrata|emmental)\b/ },
    { id: 'onion', label: 'Oignon & échalote', pattern: /\b(oignons?|echalotes?)\b/ },
    { id: 'coconut', label: 'Noix de coco', pattern: /\bcoco\b/ }
  ];
  const moods = [
    { id: 'all', label: 'Un peu de tout', description: 'Varier les plaisirs', collections: [] },
    { id: 'comfort', label: 'Du réconfort', description: 'Crémeux, fondant, doré', collections: ['italie', 'four'] },
    { id: 'color', label: 'De la couleur', description: 'Bowls & assiettes généreuses', collections: ['bowls'] },
    { id: 'travel', label: 'Une petite escapade', description: 'Curry, tacos & saveurs d’ailleurs', collections: ['voyage', 'bistro'] }
  ];
  const aisleLabels = { produce: 'Fruits, légumes & surgelés', protein: 'Viande, poisson & œufs', dairy: 'Crèmerie & fromages', pantry: 'Épicerie & placard' };
  const cleanIDs = (values, catalog) => Array.isArray(values) ? [...new Set(values.filter(v => catalog.some(item => item.id === v)))] : [];
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  function preferences(value = {}) {
    if (!validDate(value.start)) throw new Error('Choisissez une date de début valide.');
    const maxTime = Number(value.maxTime ?? 45);
    if (![30, 45, 120].includes(maxTime)) throw new Error('Choisissez une durée de 30 min, 45 min ou sans limite.');
    return { diet: Diet.validate(value.diet), start: value.start, maxTime, vegetarian: value.vegetarian === true, meals: value.meals === 'both' ? 'both' : 'dinner', mood: moods.some(m => m.id === value.mood) ? value.mood : 'all', pantry: cleanIDs(value.pantry, pantry), dislikes: cleanIDs(value.dislikes, dislikes) };
  }
  function pantryMatches(recipe, ids) {
    return pantry.filter(item => ids.includes(item.id) && recipe.ingredients.some(i => item.pattern.test(normalize(i.name))));
  }
  function eligible(recipes, prefs) {
    return [...new Map(recipes.filter(r => Diet.allows(r,prefs.diet) && ['lunch', 'dinner'].includes(r.type) && (!prefs.vegetarian || r.vegetarian) && r.time <= prefs.maxTime && !dislikes.some(d => prefs.dislikes.includes(d.id) && r.ingredients.some(i => d.pattern.test(normalize(i.name))))).map(r => [r.id, r])).values()];
  }
  function fillEmpty(menus, entries, recipes) {
    const ids = new Set(recipes.map(r => r.id));
    const next = Object.fromEntries(Object.entries(menus).map(([date, slots]) => [date, { ...slots }]));
    let added = 0, occupied = 0, invalid = 0;
    for (const entry of entries) {
      if (!entry || !validDate(entry.date) || !['lunch', 'dinner'].includes(entry.meal) || !ids.has(entry.recipeId)) { invalid++; continue; }
      if (next[entry.date]?.[entry.meal]) { occupied++; continue; }
      if (!Object.hasOwn(next, entry.date)) next[entry.date] = {};
      next[entry.date][entry.meal] = entry.recipeId; added++;
    }
    return { menus: next, added, occupied, invalid };
  }
  function applyPlan(menus, entries, recipes, applied = []) {
    const previous = new Map(applied.map(e => [e.date + ':' + e.meal, e.recipeId]));
    const result = fillEmpty(menus, [], recipes), ids = new Set(recipes.map(r => r.id));
    result.updated = 0; result.applied = [];
    for (const e of entries) {
      if (!e || !validDate(e.date) || !['lunch', 'dinner'].includes(e.meal) || !ids.has(e.recipeId)) { result.invalid++; continue; }
      const current = result.menus[e.date]?.[e.meal], owned = current && previous.get(e.date + ':' + e.meal) === current;
      if (!current || owned) {
        if (!current) result.added++; else if (current !== e.recipeId) result.updated++;
        (result.menus[e.date] ||= {})[e.meal] = e.recipeId;
        result.applied.push({ date: e.date, meal: e.meal, recipeId: e.recipeId });
      } else result.occupied++;
    }
    return result;
  }
  function aisle(name) {
    const n = normalize(name);
    if (/\b(lait|creme) de coco\b/.test(n)) return 'pantry';
    if (/\b(poulet|dinde|saumon|cabillaud|oeufs?)\b/.test(n)) return 'protein';
    if (/\b(lait|creme|yaourt|beurre|ricotta|parmesan|comte|mozzarella|cheddar|feta|fromage)\b/.test(n)) return 'dairy';
    if (/\b(carottes?|courgettes?|tomates?|brocoli|epinards|avocats?|citron|pommes? de terre|patates? douces?|oignon|echalote|champignons?|shiitakes?|aubergine|poivron|poireau|petits pois|chou fleur|potimarron|mangue|ananas|salade|persil|basilic|haricots verts|grenade|pomme|betterave)\b/.test(n) && !/\b(conserve|bocal|concassees)\b/.test(n)) return 'produce';
    return 'pantry';
  }
  const ingredientKey = ingredient => normalize(ingredient.name) + '|' + normalize(ingredient.unit);
  function shopping(entries, recipes) {
    const result = new Map();
    entries.forEach(e => {
      const recipe = recipes.find(r => r.id === e.recipeId); if (!recipe) return;
      recipe.ingredients.forEach(i => {
        if (normalize(i.name) === 'eau') return;
        const key = ingredientKey(i);
        if (result.has(key)) result.get(key).quantity = Number((result.get(key).quantity + i.quantity).toFixed(2));
        else result.set(key, { key, name: i.name, quantity: i.quantity, unit: i.unit, aisle: aisle(i.name) });
      });
    });
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  function mergeShopping(existing, incoming, makeID) {
    const items = existing.map(i => ({ ...i }));
    for (const ingredient of incoming) {
      const match = items.find(i => !i.checked && ingredientKey(i) === ingredientKey(ingredient));
      if (match) match.quantity = Math.max(match.quantity, ingredient.quantity);
      else items.push({ id: makeID(), name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit, checked: false });
    }
    return items;
  }
  function restore(raw, recipes, defaults) {
    const fresh = { options: preferences(defaults), entries: [], owned: [], applied: [], dirty: false };
    if (!raw || typeof raw !== 'object') return fresh;
    try {
      const options = preferences(raw.options);
      const ids = new Set(recipes.map(r => r.id));
      if (!Array.isArray(raw.entries) || ![0, 7, 14].includes(raw.entries.length)) return fresh;
      const entries = raw.entries.map(e => ({ date: e.date, meal: e.meal, recipeId: e.recipeId, locked: e.locked === true }));
      if (entries.some(e => !validDate(e.date) || !['lunch', 'dinner'].includes(e.meal) || !ids.has(e.recipeId)) || new Set(entries.map(e => e.date + e.meal)).size !== entries.length || new Set(entries.map(e => e.recipeId)).size !== entries.length) return fresh;
      const perDay = entries.length === 14 ? 2 : 1;
      if (entries.some((e, i) => {
        const date = new Date(entries[0].date + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + Math.floor(i / perDay));
        return e.date !== date.toISOString().slice(0, 10) || e.meal !== (perDay === 2 && i % 2 === 0 ? 'lunch' : 'dinner');
      })) return fresh;
      const expected = options.meals === 'both' ? 14 : 7;
      const dirty = raw.dirty === true || (entries.length > 0 && (entries.length !== expected || entries[0].date !== options.start || eligible(entries.map(e => recipes.find(r => r.id === e.recipeId)), options).length !== entries.length));
      const keys = new Set(shopping(entries, recipes).map(i => i.key));
      const applied = Array.isArray(raw.applied) ? raw.applied.filter(e => e && validDate(e.date) && ['lunch', 'dinner'].includes(e.meal) && ids.has(e.recipeId)).slice(0, 14).map(e => ({ date: e.date, meal: e.meal, recipeId: e.recipeId })) : [];
      return { options, entries, applied, dirty, owned: Array.isArray(raw.owned) ? [...new Set(raw.owned.filter(key => keys.has(key)))] : [] };
    } catch { return fresh; }
  }
  const api = { offer, pantry, dislikes, moods, aisleLabels, preferences, pantryMatches, eligible, validDate, fillEmpty, applyPlan, ingredientKey, shopping, mergeShopping, restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MiettePlus = api;
})(typeof window !== 'undefined' ? window : globalThis);
