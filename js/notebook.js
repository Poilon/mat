(function (root) {
  'use strict';
  const Diet=typeof module !== 'undefined' && module.exports ? require('./diet.js') : root.PoumDiet;
  const empty = () => ({ diet: Diet.clean(), name: '', vegetarian: false, favorites: [], products: [], menus: {}, shopping: [] });
  const stable = value => JSON.stringify(value && typeof value === 'object' ? Array.isArray(value) ? value.map(v => JSON.parse(stable(v))) : Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(stable(value[k]))])) : value ?? null);
  const same = (a, b) => stable(a) === stable(b);
  function entries(notebook) {
    const n = { ...empty(), ...notebook };
    return new Map([
      ['diet', Diet.clean(n.diet)], ['name', n.name], ['vegetarian', n.vegetarian],
      ...n.favorites.map(id => ['favorite:' + id, true]),
      ...n.products.map(p => ['product:' + p.code, p]),
      ...n.shopping.map(item => ['shopping:' + item.id, item]),
      ...Object.entries(n.menus).flatMap(([date, meals]) => Object.entries(meals).map(([meal, id]) => ['menu:' + date + ':' + meal, id]))
    ]);
  }
  function merge(base, local, remote) {
    const [b, l, r] = [base, local, remote].map(entries);
    const result = empty(); const conflicts = [];
    for (const key of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
      let value;
      if (same(l.get(key), b.get(key))) value = r.get(key);
      else if (same(r.get(key), b.get(key)) || same(l.get(key), r.get(key))) value = l.get(key);
      else { conflicts.push(key); value = l.get(key); }
      if (value === undefined) continue;
      if (key === 'diet' || key === 'name' || key === 'vegetarian') result[key] = value;
      else if (key.startsWith('favorite:')) result.favorites.push(key.slice(9));
      else if (key.startsWith('product:')) result.products.push(value);
      else if (key.startsWith('shopping:')) result.shopping.push(value);
      else if (key.startsWith('menu:')) { const [, date, meal] = key.split(':'); (result.menus[date] ||= {})[meal] = value; }
    }
    return { notebook: result, conflicts };
  }
  function hasContent(notebook) {
    const n = notebook || empty();
    return Boolean(Diet.clean(n.diet).completed || n.name || n.vegetarian || n.favorites.length || n.shopping.length || Object.values(n.menus).some(slots => Object.keys(slots).length));
  }
  const exported = { empty, merge, same, hasContent };
  root.MietteNotebook = exported;
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
})(typeof window !== 'undefined' ? window : globalThis);
