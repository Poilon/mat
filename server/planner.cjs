'use strict';
const { preferences, pantryMatches, moods, eligible, validDate } = require('../js/plus.js');
  function choose(pool, selected, prefs, random) {
    const mood = moods.find(m => m.id === prefs.mood);
    const counts = new Map(); selected.forEach(r => counts.set(r.collection, (counts.get(r.collection) || 0) + 1));
    // Match known ingredient names, not vague food tags or medical requirements.
    return pool.map(recipe => ({ recipe, score: pantryMatches(recipe, prefs.pantry).length * 8 - selected.filter(r=>recipe.family&&r.family===recipe.family).length*12 - selected.filter(r=>recipe.cuisine&&r.cuisine===recipe.cuisine).length*2 + (mood.collections.includes(recipe.collection) ? 3 : 0) - (counts.get(recipe.collection) || 0) * 4 + random() * 3 })).sort((a, b) => b.score - a.score)[0].recipe;
  }
  function compose(recipes, options, previous = [], random = Math.random, days = 7) {
    const prefs = preferences(options);
    if (![2, 7].includes(days)) throw new Error('La proposition couvre deux ou sept jours.');
    const meals = prefs.meals === 'both' ? ['lunch', 'dinner'] : ['dinner'];
    const slots = Array.from({ length: days }, (_, index) => {
      const date = new Date(prefs.start + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      if (!validDate(day)) throw new Error('Choisissez une autre date de début.');
      return meals.map(meal => ({ date: day, meal }));
    }).flat();
    const pool = eligible(recipes, prefs);
    if (pool.length < slots.length) throw new Error(`Il reste ${pool.length} plats pour ${slots.length} repas. Élargissez le temps de cuisine ou retirez une préférence.`);
    const pinned = previous.filter(e => e.locked);
    if (pinned.some(e => !pool.some(r => r.id === e.recipeId))) throw new Error('Un plat à garder ne correspond plus à vos choix. Retirez son épingle ou ajustez vos préférences.');
    if (pinned.length > slots.length || new Set(pinned.map(e => e.recipeId)).size !== pinned.length) throw new Error('Retirez quelques épingles avant de recomposer.');
    const chosen = new Map();
    pinned.forEach(entry => {
      const original = previous.indexOf(entry);
      const index = original < slots.length && !chosen.has(original) ? original : slots.findIndex((_, i) => !chosen.has(i));
      chosen.set(index, { recipe: pool.find(r => r.id === entry.recipeId), locked: true });
    });
    for (let i = 0; i < slots.length; i++) {
      if (chosen.has(i)) continue;
      const used = [...chosen.values()].map(c => c.recipe);
      const recipe = choose(pool.filter(r => !used.some(u => u.id === r.id)), used, prefs, random);
      chosen.set(i, { recipe, locked: false });
    }
    return slots.map((slot, index) => ({ ...slot, recipeId: chosen.get(index).recipe.id, locked: chosen.get(index).locked }));
  }
  function preview(recipes, options, random = Math.random) {
    try { return compose(recipes, { ...options, meals: 'both' }, [], random, 2); }
    catch (error) { if (/Il reste/.test(error.message)) throw new Error('Pas assez de plats différents avec ces préférences. Augmentez le temps disponible.'); throw error; }
  }
  function swap(recipes, entries, index, options, random = Math.random) {
    const entry = entries[index];
    if (!entry || entry.locked) throw new Error('Retirez l’épingle de ce plat avant de le remplacer.');
    const prefs = preferences(options), used = entries.map(e => recipes.find(r => r.id === e.recipeId)).filter(Boolean);
    const pool = eligible(recipes, prefs).filter(r => !used.some(u => u.id === r.id));
    if (!pool.length) throw new Error('Aucune autre recette avec ces préférences. Élargissez vos choix.');
    const replacement = choose(pool, used, prefs, random);
    return entries.map((e, i) => i === index ? { ...e, recipeId: replacement.id } : { ...e });
  }

module.exports = { compose, preview, swap };
