/* The complete workshop is a free discovery experience while billing is closed. */
window.MietteWorkshop = (() => {
  'use strict';
  const P = window.MiettePlus, D = window.MietteData, { icon } = window.MietteIcons;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = selector => document.querySelector(selector);
  const recipe = id => D.recipes.find(r => r.id === id);
  const dateLabel = date => new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const quantity = value => Number(value.toFixed(2)).toLocaleString('fr-FR');
  const mealLabel = meal => meal === 'lunch' ? 'Déjeuner' : 'Dîner';
  function create(host) {
    let owner, state, feedback = '', memoryOnly = false;
    const key = value => 'miette-workshop-v1:' + value;
    function ensure() {
      const current = host.owner();
      if (owner === current && state) return state;
      owner = current; feedback = ''; memoryOnly = false;
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(key(owner)) || 'null'); } catch { /* Start a fresh draft. */ }
      state = P.restore(raw, D.recipes, { start: host.range().start, vegetarian: host.notebook().vegetarian });
      return state;
    }
    function persist() {
      try { localStorage.setItem(key(owner), JSON.stringify(state)); memoryOnly = false; } catch { memoryOnly = true; }
    }
    function storageNote() {
      return memoryOnly ? 'Le brouillon reste dans cet onglet : votre navigateur ne peut pas le sauvegarder.' : 'Le brouillon et vos préférences sont conservés sur cet appareil. Les repas ajoutés au carnet suivent sa synchronisation habituelle.';
    }
    function selections(catalog, selected, name) {
      return `<div class="workshop-chips">${catalog.map(item => `<label class="workshop-chip"><input type="checkbox" name="${name}" value="${item.id}" ${selected.includes(item.id) ? 'checked' : ''}><span>${esc(item.label)}</span></label>`).join('')}</div>`;
    }
    function form() {
      const o = state.options, range = host.range();
      return `<form id="workshop-form" class="workshop-form"><div class="workshop-form-heading"><span class="workshop-step">01</span><div><h2>On part de vos envies.</h2><p>Quelques choix pour une semaine qui vous ressemble.</p></div></div><fieldset class="workshop-moods"><legend>Cette semaine, j’ai plutôt envie de…</legend>${P.moods.map(m => `<label><input type="radio" name="mood" value="${m.id}" ${o.mood === m.id ? 'checked' : ''}><span><b>${esc(m.label)}</b><small>${esc(m.description)}</small></span></label>`).join('')}</fieldset><div class="workshop-fields"><div class="field"><label for="workshop-start">Semaine du lundi</label><input class="text-input" type="date" id="workshop-start" name="start" value="${esc(o.start)}" min="${range.min}" max="${range.max}" step="7" required></div><div class="field"><label for="workshop-time">Temps par recette</label><select class="text-input" id="workshop-time" name="maxTime">${[[30, '30 min maximum'], [45, '45 min maximum'], [120, 'Tout mon temps']].map(([v, label]) => `<option value="${v}" ${o.maxTime === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label for="workshop-meals">Les repas à prévoir</label><select class="text-input" id="workshop-meals" name="meals"><option value="dinner" ${o.meals === 'dinner' ? 'selected' : ''}>7 dîners</option><option value="both" ${o.meals === 'both' ? 'selected' : ''}>7 déjeuners + 7 dîners</option></select></div></div><label class="workshop-vegetarian"><input type="checkbox" name="vegetarian" ${o.vegetarian ? 'checked' : ''}>Uniquement des recettes végétariennes</label><fieldset class="workshop-preferences"><legend>Ce qui ne me tente pas en ce moment</legend><p>Ces ingrédients seront écartés des recettes proposées. Ce filtre de goûts ne traite pas les allergies ni les traces.</p>${selections(P.dislikes, o.dislikes, 'dislikes')}</fieldset><fieldset class="workshop-preferences"><legend>Ce que j’ai déjà à la maison</legend><p>On privilégie les recettes qui utilisent ces ingrédients. Vous vérifierez les quantités dans les courses.</p>${selections(P.pantry, o.pantry, 'pantry')}</fieldset><div class="workshop-compose"><button class="btn btn-primary" type="submit">${icon('sparkle', 17)}${state.entries.length ? 'Recomposer ma semaine' : 'Composer ma semaine'}</button><span>Pour 2 personnes · Les plats épinglés sont conservés</span></div></form>`;
    }
    function summary() {
      const matches = state.entries.filter(e => P.pantryMatches(recipe(e.recipeId), state.options.pantry).length).length;
      const items = P.shopping(state.entries, D.recipes);
      return `<div class="workshop-metrics"><span><b>${state.entries.length}</b> repas prêts à choisir</span><span><b>${matches}</b> avec vos ingrédients</span><span><b>${items.length - state.owned.length}</b> articles à prévoir</span></div>`;
    }
    function cards() {
      const days = [...new Set(state.entries.map(e => e.date))], notebook = host.notebook();
      return `<div class="workshop-days">${days.map(date => `<section class="workshop-day"><h3>${dateLabel(date)}</h3>${state.entries.map((e, index) => ({ e, index })).filter(({ e }) => e.date === date).map(({ e, index }) => {
        const r = recipe(e.recipeId), matches = P.pantryMatches(r, state.options.pantry);
        const current = notebook.menus[e.date]?.[e.meal], managed = state.applied.some(p => p.date === e.date && p.meal === e.meal && p.recipeId === current);
        return `<article class="workshop-recipe ${e.locked ? 'is-pinned' : ''}" data-entry="${index}"><button class="workshop-recipe-open" data-action="workshop-recipe" data-id="${r.id}"><img src="assets/${r.image}.jpg" alt="" width="320" height="220" loading="lazy"><span><small>${mealLabel(e.meal)} · ${r.time} min</small><b>${esc(r.title)}</b><span class="workshop-match">${matches.length ? `${icon('check', 12)} Avec ${matches.map(m => esc(m.label.toLowerCase())).join(', ')}` : 'Voir les étapes & les précautions →'}</span></span></button><div class="workshop-recipe-actions"><button data-action="workshop-pin" data-index="${index}" aria-pressed="${e.locked}" aria-label="${e.locked ? 'Ne plus garder' : 'Garder'} ${esc(r.title)}">${icon('pin', 14)}${e.locked ? 'À garder' : 'Garder'}</button><button data-action="workshop-swap" data-index="${index}" aria-label="Changer ${esc(r.title)}" ${e.locked || state.dirty ? 'disabled' : ''}>${icon('refresh', 14)}Changer</button></div>${current && !managed ? '<p class="workshop-occupied">Un repas est déjà dans votre carnet. Il sera conservé.</p>' : ''}</article>`;
      }).join('')}</section>`).join('')}</div>`;
    }
    function shopping() {
      const items = P.shopping(state.entries, D.recipes);
      return `<section class="workshop-shopping" aria-labelledby="workshop-shopping-title"><div class="workshop-section-heading"><div><span class="eyebrow">03 · LE PANIER SUIT</span><h2 id="workshop-shopping-title">Vos courses, déjà rassemblées.</h2><p>Cochez « Déjà à la maison » si vous avez toute la quantité indiquée.</p></div><button class="btn btn-outline" data-action="workshop-shopping" ${state.dirty || items.length === state.owned.length ? 'disabled' : ''}>${icon('bag', 16)}Compléter ma liste</button></div><div class="workshop-aisles">${Object.entries(P.aisleLabels).map(([id, label]) => { const rows = items.filter(i => i.aisle === id); return rows.length ? `<section><h3>${label}</h3>${rows.map(i => `<label class="workshop-shopping-row ${state.owned.includes(i.key) ? 'is-owned' : ''}"><input type="checkbox" data-workshop-owned="${esc(i.key)}" ${state.owned.includes(i.key) ? 'checked' : ''} ${state.dirty ? 'disabled' : ''} aria-label="Déjà à la maison : ${esc(i.name)}, ${quantity(i.quantity)} ${esc(i.unit)}"><span>${esc(i.name)}<small>${quantity(i.quantity)} ${esc(i.unit)}</small></span></label>`).join('')}</section>` : ''; }).join('')}</div><p class="workshop-footnote">Les quantités identiques sont regroupées, en conservant les mentions de préparation. Compléter votre liste conserve les quantités déjà plus élevées et ne double pas les mêmes besoins.</p></section>`;
    }
    function results() {
      if (!state.entries.length) return `<div class="workshop-before"><div class="workshop-before-photos"><img src="assets/recipes/gnocchi.jpg" alt="" width="200" height="150"><img src="assets/recipes/curry.jpg" alt="" width="200" height="150"><img src="assets/recipes/tacos.jpg" alt="" width="200" height="150"></div><h2>Votre semaine prend forme ici.</h2><p>Choisissez vos préférences, puis découvrez vos plats, leur préparation et toutes les courses à prévoir.</p></div>`;
      const changes = P.applyPlan(host.notebook().menus, state.entries, D.recipes, state.applied);
      const count = changes.added + changes.updated;
      return `${state.dirty ? '<p class="workshop-dirty" role="status">Vos préférences ont changé. Recomposez la semaine pour les appliquer avant d’enregistrer ou d’exporter.</p>' : ''}<section class="workshop-menu" aria-labelledby="workshop-result-title"><div class="workshop-section-heading"><div><span class="eyebrow">02 · LE MENU PREND FORME</span><h2 id="workshop-result-title" tabindex="-1">Ça vous donne envie ?</h2><p>Gardez vos coups de cœur. Changez un plat, et les courses s’adaptent.</p></div><button class="btn btn-outline" data-action="workshop-regenerate">${icon('refresh', 16)}D’autres idées</button></div>${summary()}${cards()}<div class="workshop-save"><div><b>${count ? `${count} repas à ${changes.updated ? 'ajouter ou actualiser' : 'ajouter'} dans votre carnet` : 'Les créneaux de cette semaine sont déjà remplis'}</b><p>${changes.occupied ? `${changes.occupied} repas prévu(s) en dehors de cet atelier seront conservés.` : 'Vos repas ajoutés ici pourront être actualisés sans toucher aux autres.'}</p></div><button class="btn btn-primary" data-action="workshop-save" ${state.dirty || !count ? 'disabled' : ''}>${icon('calendar', 16)}${changes.updated ? 'Actualiser mon carnet' : 'Ajouter à mes menus'}</button></div></section>${shopping()}<section class="workshop-takeaway"><div class="workshop-takeaway-icon">${icon('book', 30)}</div><div><span class="eyebrow">04 · À EMPORTER, À PARTAGER</span><h2>Le carnet est prêt pour la cuisine.</h2><p>Le menu, les courses, les quantités et toutes les étapes dans un document à ouvrir, imprimer ou transmettre à la personne qui cuisine avec vous.</p></div><button class="btn btn-primary" data-action="workshop-export" ${state.dirty ? 'disabled' : ''}>${icon('download', 16)}Emporter mon carnet</button></section><section class="workshop-after"><div><span class="eyebrow">ET LA SEMAINE PROCHAINE ?</span><h2>Vos envies changent.<br>Votre organisation peut suivre.</h2><p>Découvrez l’offre Plus après avoir essayé l’atelier complet.</p></div><button class="btn btn-outline" data-action="plus-offer">Découvrir l’offre Plus ${icon('arrow', 16)}</button></section>`;
    }
    function render() {
      ensure();
      return `<div class="workshop-page"><div class="workshop-heading"><div><a class="btn-text" href="#plus">← L’atelier Plus</a><h1>Votre semaine, à votre façon.</h1><p>Les envies, les plats, les courses. On prépare tout au même endroit.</p></div><span class="workshop-demo">${icon('sparkle', 14)}Démo complète offerte</span></div><p class="workshop-discovery">Essayez toutes les fonctions ci-dessous sans compte ni carte bancaire. Aucun abonnement ne commence.</p>${form()}<p id="workshop-feedback" class="workshop-feedback" role="status">${esc(feedback)}</p><div id="workshop-results">${results()}</div><p class="workshop-footnote"><span id="workshop-storage-note">${storageNote()}</span> Les propositions sont des idées de cuisine pour deux personnes, sans prise en charge des allergies ni de vos besoins médicaux. Les précautions et sources restent dans chaque recette.</p></div>`;
    }
    function update(message = '') {
      feedback = message; persist();
      if ($('#workshop-results')) $('#workshop-results').innerHTML = results();
      if ($('#workshop-feedback')) $('#workshop-feedback').textContent = feedback;
      if ($('#workshop-storage-note')) $('#workshop-storage-note').textContent = storageNote();
    }
    function options(form) {
      const data = new FormData(form);
      return { start: String(data.get('start')), maxTime: Number(data.get('maxTime')), vegetarian: data.has('vegetarian'), meals: data.get('meals'), mood: data.get('mood'), pantry: data.getAll('pantry'), dislikes: data.getAll('dislikes') };
    }
    function submit(form) {
      ensure(); if (!form.reportValidity()) return;
      try {
        const prefs = P.preferences(options(form));
        const entries = P.compose(D.recipes, prefs, state.entries);
        state = { ...state, options: prefs, entries, owned: [], dirty: false };
        update(`${entries.length} repas proposés. Les courses sont prêtes à vérifier.`);
        form.querySelector('[type="submit"]').innerHTML = `${icon('sparkle', 17)}Recomposer ma semaine`;
        $('#workshop-result-title')?.focus();
      } catch (error) { feedback = error.message; $('#workshop-feedback').textContent = feedback; }
    }
    function change(event) {
      const target = event.target;
      if (target.closest('#workshop-form')) {
        ensure(); state.options = options(target.form); state.dirty = state.entries.length > 0;
        update(state.dirty ? 'Recomposez la semaine pour appliquer vos nouveaux choix.' : 'Vos préférences sont prêtes. Composez votre semaine.');
        return true;
      }
      if (target.matches('[data-workshop-owned]')) {
        ensure(); if (state.dirty) return true;
        const item = target.dataset.workshopOwned;
        if (!P.shopping(state.entries, D.recipes).some(i => i.key === item)) return true;
        state.owned = state.owned.filter(key => key !== item); if (target.checked) state.owned.push(item);
        update('Votre panier a été actualisé.');
        [...document.querySelectorAll('[data-workshop-owned]')].find(input => input.dataset.workshopOwned === item)?.focus({ preventScroll: true });
        return true;
      }
      return false;
    }
    function exportDocument() {
      const items = P.shopping(state.entries, D.recipes), required = items.filter(i => !state.owned.includes(i.key));
      const css = 'body{font:15px/1.6 system-ui,sans-serif;color:#354237;max-width:850px;margin:40px auto;padding:0 24px}h1,h2{font-family:Georgia,serif;color:#334d3d}h1{font-size:36px}h2{margin-top:32px}small{color:#625d50}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:9px;border-bottom:1px solid #ddd}ul,ol{padding-left:22px}li{margin:8px 0}article{break-before:page}a{color:#334d3d}aside{padding:15px;background:#f1eedf}button{padding:12px 20px;background:#496453;color:white;border:0;border-radius:8px;cursor:pointer}@media print{body{margin:0;max-width:none}button{display:none}a{color:inherit}}';
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ma semaine à cuisiner — ${esc(state.options.start)}</title><style>${css}</style></head><body><button onclick="window.print()">Imprimer / enregistrer en PDF</button><h1>Ma semaine à cuisiner.</h1><p>Semaine du ${esc(dateLabel(state.options.start))} · ${state.entries.length} repas · 2 personnes</p><p>Un carnet préparé dans l’atelier Plus. Les étapes et les quantités sont incluses pour cuisiner sans ouvrir l’application.</p><h2>Au menu</h2><table><thead><tr><th>Jour</th><th>Repas</th><th>Recette</th></tr></thead><tbody>${state.entries.map((e, index) => `<tr><td>${esc(dateLabel(e.date))}</td><td>${mealLabel(e.meal)}</td><td><a href="#recette-${index}">${esc(recipe(e.recipeId).title)}</a></td></tr>`).join('')}</tbody></table><h2>À prévoir dans les courses</h2>${Object.entries(P.aisleLabels).map(([id, label]) => { const list = required.filter(i => i.aisle === id); return list.length ? `<h3>${label}</h3><ul>${list.map(i => `<li>☐ ${esc(i.name)} — ${quantity(i.quantity)} ${esc(i.unit)}</li>`).join('')}</ul>` : ''; }).join('') || '<p>Tous les articles ont été cochés comme déjà disponibles.</p>'}${state.owned.length ? `<h3>Déjà à la maison, d’après vos coches</h3><ul>${items.filter(i => state.owned.includes(i.key)).map(i => `<li>${esc(i.name)} — ${quantity(i.quantity)} ${esc(i.unit)}</li>`).join('')}</ul>` : ''}${state.entries.map((e, index) => { const r = recipe(e.recipeId); return `<article id="recette-${index}"><small>${esc(dateLabel(e.date))} · ${mealLabel(e.meal)} · ${r.time} minutes · ${r.servings} personnes</small><h2>${esc(r.title)}</h2><h3>Ingrédients</h3><ul>${r.ingredients.map(i => `<li>${esc(i.name)} — ${quantity(i.quantity)} ${esc(i.unit)}</li>`).join('')}</ul><p><strong>Allergènes :</strong> ${esc(r.allergens)}</p><h3>En cuisine</h3><ol>${r.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol><aside><strong>Le repère grossesse</strong><p>${esc(r.safety)}</p></aside><p>Références : ${(r.sources || ['spf', 'toxo']).filter(id => D.sources[id]).map(id => `<a href="${esc(D.sources[id].url)}">${esc(D.sources[id].name)} — ${esc(D.sources[id].title)}</a>`).join(' · ')}</p></article>`; }).join('')}<p>Les temps sont indicatifs. Vérifiez la cuisson, l’étiquette, vos allergies et vos consignes médicales. Ces idées ne constituent pas un programme nutritionnel personnalisé.</p></body></html>`;
      host.download(`mon-carnet-de-cuisine-${state.options.start}.html`, html, 'text/html;charset=utf-8');
      update('Votre carnet contient le menu, les courses et toutes les recettes. Ouvrez-le pour l’imprimer ou l’enregistrer en PDF.');
      host.notify('Le carnet de cuisine est prêt à ouvrir.', 'download');
    }
    function click(trigger) {
      const action = trigger.dataset.action;
      if (!action?.startsWith('workshop-')) return false;
      ensure();
      try {
        if (action === 'workshop-regenerate') { const form = $('#workshop-form'); if (form) submit(form); return true; }
        if (action === 'workshop-recipe') { host.recipe(trigger.dataset.id); return true; }
        if (action === 'workshop-pin') {
          const index = Number(trigger.dataset.index), entry = state.entries[index];
          if (entry) { entry.locked = !entry.locked; update(entry.locked ? 'Ce plat sera gardé dans les prochaines propositions.' : 'Ce plat peut à nouveau changer.'); $(`[data-action="workshop-pin"][data-index="${index}"]`)?.focus({ preventScroll: true }); }
          return true;
        }
        if (state.dirty || !state.entries.length) return true;
        if (action === 'workshop-swap') {
          const index = Number(trigger.dataset.index);
          state.entries = P.swap(D.recipes, state.entries, index, state.options); state.owned = [];
          update('Une nouvelle idée, et les courses sont actualisées. Revérifiez ce que vous avez déjà.');
          $(`[data-action="workshop-swap"][data-index="${index}"]`)?.focus({ preventScroll: true });
        } else if (action === 'workshop-save') {
          const result = P.applyPlan(host.notebook().menus, state.entries, D.recipes, state.applied);
          state.applied = result.applied;
          if (result.added + result.updated) host.commit({ menus: result.menus });
          update(`${result.added} repas ajoutés, ${result.updated} actualisés.${result.occupied ? ` ${result.occupied} repas prévus ailleurs ont été conservés.` : ''} Retrouvez-les dans Mes menus.`);
          host.notify('Vos menus sont enregistrés dans le carnet.', 'check');
        } else if (action === 'workshop-shopping') {
          const required = P.shopping(state.entries, D.recipes).filter(i => !state.owned.includes(i.key));
          const shopping = P.mergeShopping(host.notebook().shopping, required, host.id);
          if (shopping.length > 500) throw new Error('Votre liste est pleine. Retirez quelques articles avant de la compléter.');
          host.commit({ shopping }); update('Votre liste de courses est complétée, sans doubler les mêmes besoins.');
          host.notify('Votre liste de courses est complétée.', 'bag');
        } else if (action === 'workshop-export') exportDocument();
      } catch (error) { update(error.message); host.notify(error.message, 'info'); }
      return true;
    }
    function stats() {
      ensure(); const items = P.shopping(state.entries, D.recipes);
      return { meals: state.entries.length, matches: state.entries.filter(e => P.pantryMatches(recipe(e.recipeId), state.options.pantry).length).length, items: items.length - state.owned.length, ready: !!state.entries.length && !state.dirty };
    }
    function clear() {
      ensure(); try { localStorage.removeItem(key(owner)); } catch { /* Keep only a fresh in-memory draft. */ }
      state = P.restore(null, D.recipes, { start: host.range().start, vegetarian: host.notebook().vegetarian }); feedback = '';
    }
    return { render, submit, change, click, stats, clear };
  }
  return { create };
})();
