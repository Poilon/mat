/* Authorized recipe downloads are retained on this device, separately per account. */
window.MietteRecipeAccess = (() => {
  'use strict';
  const D = window.MietteData, Cloud = window.MietteCloud;
  const originals = new Map(D.recipes.map(r => [r.id, {steps:[...r.steps],guide:r.guide}]));
  let owner, revision = 0;
  const key = () => 'miamama-recipes-v1:' + Cloud.storageKey;
  function apply(rows) {
    if (!Array.isArray(rows)) return;
    for (const row of rows.slice(0, D.recipes.length)) {
      const recipe = D.recipes.find(r => r.id === row?.id);
      if (recipe && recipe.premium && Array.isArray(row.steps) && row.steps.length > 0 && row.steps.length <= 30 && row.steps.every(s => typeof s === 'string' && s.length <= 8000)) { recipe.steps = [...row.steps]; recipe.guide = row.guide && Array.isArray(row.guide.steps) && row.guide.steps.length === row.steps.length && Array.isArray(row.guide.equipment) && Array.isArray(row.guide.before) ? row.guide : null; }
    }
  }
  function ensure() {
    if (owner === Cloud.storageKey) return;
    revision++;
    owner = Cloud.storageKey;
    D.recipes.forEach(r => { r.steps = [...originals.get(r.id).steps]; r.guide = originals.get(r.id).guide; });
    try { apply(JSON.parse(localStorage.getItem(key()) || '[]')); } catch {}
  }
  function ticket() { ensure(); return `${owner}:${revision}`; }
  function accept(rows, expected = ticket()) {
    if (expected !== ticket()) return false;
    apply(rows);
    try { localStorage.setItem(key(), JSON.stringify(D.recipes.filter(r => r.premium && r.steps.length).map(({ id, steps, guide }) => ({ id, steps, guide })))); } catch {}
    return true;
  }
  async function load(id) {
    ensure();
    const cached=D.recipes.find(r => r.id === id);
    if (cached?.steps.length && cached.guide) return;
    if (window.MietteRuntime?.cloud === false) { const e = new Error('Retrouvez les recettes Plus sur la version connectée.'); e.status = 402; throw e; }
    const expected = ticket();
    const result = await Cloud.request('recipes?id=' + encodeURIComponent(id));
    if (!accept(result.recipes, expected)) throw new Error('Le carnet ou le compte a changé. Rouvrez la recette.');
    if (!D.recipes.find(r => r.id === id)?.steps.length) throw new Error('La recette reçue est incomplète. Réessayez.');
  }
  function clear() { ensure(); revision++; try { localStorage.removeItem(key()); } catch {} D.recipes.forEach(r => { r.steps = [...originals.get(r.id).steps]; r.guide = originals.get(r.id).guide; }); }
  window.addEventListener('miette:cloud', ensure);
  ensure();
  return { ensure, accept, load, clear, ticket };
})();
