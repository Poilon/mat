/* Nidelle Plus is a pre-launch offer. No payment or paid entitlement is simulated. */
(root => {
  'use strict';
  const offer = Object.freeze({
    stage: 'prelaunch',
    defaultPlan: 'pass',
    plans: Object.freeze([
      Object.freeze({ id: 'pass', name: 'Le pass 9 mois', cents: 2990, months: 9, recurring: false, cadence: 'en une fois', terms: '9 mois d’accès, sans renouvellement automatique.' }),
      Object.freeze({ id: 'monthly', name: 'Au fil des mois', cents: 490, months: 1, recurring: true, cadence: 'par mois', terms: 'Abonnement mensuel renouvelé automatiquement, résiliable à tout moment pour la prochaine échéance.' })
    ])
  });
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }
  function preview(recipes, { start, vegetarian = false, maxTime = 45 } = {}, random = Math.random) {
    if (!validDate(start)) throw new Error('Choisissez une date de début valide.');
    if (![30, 45, 120].includes(maxTime)) throw new Error('Choisissez une durée de 30 min, 45 min ou sans limite.');
    const pool = [...new Map(recipes.filter(r => ['lunch', 'dinner'].includes(r.type) && (!vegetarian || r.vegetarian) && r.time <= maxTime).map(r => [r.id, r])).values()];
    if (pool.length < 4) throw new Error('Pas assez de plats différents avec ces préférences. Augmentez le temps disponible.');
    // Shuffle first, then prefer different recipe collections. This is inspiration,
    // not a nutritional assessment or a personalised medical meal plan.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = [], collections = new Set();
    while (selected.length < 4) {
      const varied = pool.findIndex(r => !collections.has(r.collection));
      const [recipe] = pool.splice(varied < 0 ? 0 : varied, 1);
      selected.push(recipe); collections.add(recipe.collection);
    }
    const next = new Date(start + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    const end = next.toISOString().slice(0, 10);
    if (!validDate(end)) throw new Error('Choisissez une autre date de début.');
    return selected.map((r, i) => ({ date: i < 2 ? start : end, meal: i % 2 ? 'dinner' : 'lunch', recipeId: r.id }));
  }
  function fillEmpty(menus, entries, recipes) {
    const ids = new Set(recipes.map(r => r.id));
    const next = Object.fromEntries(Object.entries(menus).map(([date, slots]) => [date, { ...slots }]));
    let added = 0, occupied = 0, invalid = 0;
    for (const entry of entries) {
      if (!entry || !validDate(entry.date) || !['lunch', 'dinner'].includes(entry.meal) || !ids.has(entry.recipeId)) { invalid++; continue; }
      if (next[entry.date]?.[entry.meal]) { occupied++; continue; }
      if (!Object.hasOwn(next, entry.date)) next[entry.date] = {};
      next[entry.date][entry.meal] = entry.recipeId;
      added++;
    }
    return { menus: next, added, occupied, invalid };
  }
  const api = { offer, preview, fillEmpty };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MiettePlus = api;
})(typeof window !== 'undefined' ? window : globalThis);
