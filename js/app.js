(() => {
  'use strict';
  const D = window.MietteData;
  const seoURL = path => window.MietteRuntime?.cloud === false ? new URL(path, window.MietteRuntime.appURL).href : path;
  const R = window.MietteRules;
  const API = window.MietteAPI;
  const Cloud = window.MietteCloud;
  const Plus = window.MiettePlus;
  const Billing = window.MietteBilling;
  const { icon, food: art } = window.MietteIcons;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Keep the original storage keys and transfer protocol so existing notebooks survive the rename.
  const STORAGE_KEY = 'miette-notebook-v1';
  const foodsById = new Map(D.foods.map(f => [f.id, f]));
  const recipesById = new Map(D.recipes.map(r => [r.id, r]));
  const productMap = new Map();
  const mealLabels = { lunch: 'Déjeuner', dinner: 'Dîner' };
  const recipeTypes = { all: 'Tous les repas', lunch: 'Déjeuner', dinner: 'Dîner', breakfast: 'Petit-déjeuner', snack: 'Goûter', dessert: 'Dessert', apero: 'À partager' };
  const recipePageSize = 12;
  const recipeHighlights = ['tacos-cabillaud', 'gnocchis-pesto', 'pancakes-citron-ricotta', 'burger-poulet-croustillant', 'brownie-chocolat-noisette', 'dhal-coco', 'bowl-patate-tahini', 'lasagnes-epinards-ricotta', 'soupe-minestrone', 'muffins-myrtille', 'houmous-betterave', 'sunny-bowl'];
  const recipeOrder = new Map([...recipeHighlights, ...D.recipes.filter(r => !recipeHighlights.includes(r.id)).map(r => r.id)].map((id, i) => [id, i]));
  const labels = { cesoir: 'Ce soir', accueil: 'Mon quotidien', aliments: 'Explorer les aliments', recettes: 'Idées de recettes', favoris: 'Mes favoris', menus: 'Mes menus', courses: 'Ma liste de courses', guide: 'Les bons repères', sources: 'Sources & méthode', profil: 'Mon espace', confidentialite: 'Mes données', plus: 'L’atelier Plus', atelier: 'Ma semaine à cuisiner' };
  let storageAvailable = true;
  let store = readStore();
  let route = getRoute();
  let apiState = { key: '', query: '', products: [], count: 0, page: 1, loading: false, error: '', hasMore: false, cached: false };
  let apiAbort = null;
  let requestGeneration = 0;
  let dialogContext = null;
  let cameraStream = null;
  let cameraGeneration = 0;
  let cameraTimer = null;
  let lastDialogTrigger = null;
  let installPrompt = null;
  let scannerControls = null;
  let scannerLoading = null;
  let authMode = 'login';
  let authBusy = false;
  let plusPlan = Plus.offer.defaultPlan;
  let checkoutBusy = false, billingMessage = '', pendingCheckoutSession = null;
  const RecipeAccess = window.MietteRecipeAccess;
  const Workshop = window.MietteWorkshop.create({
    owner: () => Cloud?.storageKey || STORAGE_KEY,
    notebook: () => store,
    range: () => ({ start: localDate(weekDates()[0]), min: localDate(monday(-52)), max: localDate(monday(52)) }),
    commit: patch => { Object.assign(store, patch); persist(); },
    recipe: recipeDetail, download: downloadFile, id: uniqueId, notify: toast,
    billing: () => Billing.state, offer: plusOffer, login: workshopLogin,
    generate: payload => {
      if (window.MietteRuntime?.cloud === false) { location.assign(new URL('#atelier', window.MietteRuntime.appURL)); return Promise.reject(new Error('Ouvrez la version connectée pour composer votre semaine.')); }
      if (!navigator.onLine) return Promise.reject(new Error('Une connexion est nécessaire pour proposer de nouveaux plats. Vos carnets enregistrés restent disponibles.'));
      const owner = Cloud.storageKey, recipeTicket = RecipeAccess.ticket();
      return Cloud.request('workshop', { method: 'POST', body: JSON.stringify(payload) }).then(result => { if (owner !== Cloud.storageKey) throw new Error('Le compte a changé. Relancez votre semaine.'); if (!RecipeAccess.accept(result.recipes, recipeTicket)) throw new Error('Le carnet a changé. Relancez votre semaine.'); Billing.refresh(); return result; });
    }
  });

  const Tonight = window.PoumTonight.create({
    owner: () => Cloud.storageKey, ready: () => !['checking', 'loading', 'unavailable'].includes(Cloud.state.status), page: () => route.page, vegetarian: () => store.vegetarian,
    request: body => Cloud.request('tonight', { method: 'POST', body: JSON.stringify(body) }), notify: toast,
    shopping: meal => {
      for (const i of meal.recipe.ingredients.filter(i => !meal.checked[i.index])) {
        const existing = store.shopping.find(x => !x.checked && R.normalize(x.name) === R.normalize(i.name) && x.unit === i.unit);
        if (existing) existing.quantity = Math.max(existing.quantity || 0, i.quantity);
        else store.shopping.push({ id: uniqueId(), name: i.name, quantity: i.quantity, unit: i.unit, checked: false });
      }
      persist();
    }
  });

  function readStore(provided) {
    const defaults = { name: '', vegetarian: false, favorites: [], products: [], menus: {}, shopping: [] };
    try {
      try { const testKey = 'miette-storage-check'; localStorage.setItem(testKey, '1'); localStorage.removeItem(testKey); }
      catch { storageAvailable = false; }
      const raw = provided || JSON.parse(localStorage.getItem(Cloud?.storageKey || STORAGE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return defaults;
      defaults.name = typeof raw.name === 'string' ? raw.name.slice(0, 30) : '';
      defaults.vegetarian = raw.vegetarian === true;
      if (Array.isArray(raw.products)) defaults.products = raw.products.slice(0, 100).map(API.toProduct).filter(Boolean);
      defaults.products.forEach(p => productMap.set(p.id, p));
      if (Array.isArray(raw.favorites)) defaults.favorites = [...new Set(raw.favorites.filter(v => typeof v === 'string' && /^(food|recipe):[\w-]+$/.test(v)))].slice(0, 300);
      if (raw.menus && typeof raw.menus === 'object') Object.entries(raw.menus).slice(0, 1000).forEach(([date, slots]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(date + 'T12:00:00Z').getTime()) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date || !slots || typeof slots !== 'object') return;
        defaults.menus[date] = {};
        ['lunch', 'dinner'].forEach(meal => { if (recipesById.has(slots[meal])) defaults.menus[date][meal] = slots[meal]; });
      });
      if (Array.isArray(raw.shopping)) defaults.shopping = [...new Map(raw.shopping.filter(v => v && typeof v.id === 'string' && /^[\w-]{1,100}$/.test(v.id) && typeof v.name === 'string' && v.name.trim()).slice(0, 500).map(v => [v.id, { id: v.id, name: v.name.slice(0, 150), quantity: typeof v.quantity === 'number' && Number.isFinite(v.quantity) ? Math.min(1000000, Math.max(0, v.quantity)) : 0, unit: typeof v.unit === 'string' ? v.unit.slice(0, 20) : '', checked: v.checked === true }])).values()];
      return defaults;
    } catch (_) { storageAvailable = false; return defaults; }
  }
  function persist() {
    try {
      store.products = [...productMap.values()].filter(p => store.favorites.includes('food:' + p.id)).slice(0, 100);
      localStorage.setItem(Cloud?.storageKey || STORAGE_KEY, JSON.stringify(store));
      Cloud?.changed();
      return true;
    } catch (_) {
      if (storageAvailable) toast('Votre navigateur ne peut plus enregistrer le carnet. Les changements restent disponibles dans cet onglet.', 'info');
      storageAvailable = false;
      Cloud?.changed();
      return false;
    }
  }
  function getRoute() {
    const [path, query = ''] = location.hash.slice(1).split('?');
    return { page: Object.hasOwn(labels, path) ? path : 'accueil', params: new URLSearchParams(query) };
  }
  function href(page, params = {}) {
    const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'all');
    const q = new URLSearchParams(entries).toString();
    return '#' + page + (q ? '?' + q : '');
  }
  function go(page, params = {}) {
    const next = href(page, params);
    if (location.hash === next) renderRoute(); else location.hash = next;
  }
  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function monday(weekOffset = 0) {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7);
    return d;
  }
  function weekOffset() { const n = Number(route.params.get('semaine') || 0); return Number.isFinite(n) ? Math.max(-52, Math.min(52, Math.trunc(n))) : 0; }
  function weekDates() { const first = monday(weekOffset()); return Array.from({ length: 7 }, (_, i) => { const d = new Date(first); d.setDate(d.getDate() + i); return d; }); }
  function number(value) { return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toLocaleString('fr-FR'); }
  function favorite(kind, id) { return store.favorites.includes(kind + ':' + id); }
  function badge(status) { const s = D.statuses[status] || D.statuses.unknown; return `<span class="status-badge status-${escape(status)}">${icon(s.icon, 12)}${s.label}</span>`; }
  function favoriteButton(kind, id) {
    const active = favorite(kind, id);
    return `<button class="favorite-button ${active ? 'is-favorite' : ''}" data-action="favorite" data-kind="${kind}" data-id="${escape(id)}" aria-label="${active ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${active}">${icon('heart', 14)}</button>`;
  }
  function sourceLink(id) {
    const s = D.sources[id];
    return s ? `<a class="source-link source-full" href="${s.url}" target="_blank" rel="noopener noreferrer"><span><b>${escape(s.name)}</b><small>${escape(s.title)}</small></span>${icon('external', 13)}</a>` : '';
  }
  function citations(ids) {
    return `<div class="claim-sources"><span>Sources :</span> ${[...new Set(ids)].map(id => {
      const s = D.sources[id];
      return s ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer" title="${escape(s.title)}">${escape(s.name)} ${icon('external', 11)}</a>` : '';
    }).join('')}</div>`;
  }
  function sourceFooter(ids) { return `<div class="sources-inline"><p>REPÈRES CONSULTÉS LE ${D.reviewed.toUpperCase()}</p>${[...new Set(ids)].map(sourceLink).join('')}</div>`; }
  function foodExplanation(f) {
    const e = f.evidence, p = D.profiles[e.profile];
    return `<section class="food-explanation" aria-labelledby="why-title"><h3 id="why-title">Pourquoi ce repère ?</h3><div class="advice-box ${f.status}"><p>${escape(e.why)}</p></div>${citations(e.sources)}<div class="evidence-mechanism"><h3>${escape(p.title)}</h3><p>${escape(p.mechanism)}</p>${citations(p.sources)}</div><div class="evidence-condition"><h3>Ce qui change la réponse</h3><p>${escape(p.condition)}</p>${e.note ? `<p class="evidence-note"><strong>Le repère en pratique.</strong> ${escape(e.note)}</p>` : ''}</div><p class="evidence-basis">${e.basis === 'specific' ? 'Synthèse Poum : cet aliment, ce type de produit ou cette préparation est cité dans les références.' : 'Application par Poum des recommandations générales à cette famille d’aliments ; les sources ne citent pas nécessairement cet aliment individuellement.'}</p></section>`;
  }
  function productFlag(flag) {
    const e = flag.explanation;
    return `<section class="risk-flag"><h4>${icon(D.statuses[flag.status].icon, 15)}${escape(flag.title)}</h4><p>${escape(flag.text)}</p><ul class="signal-trace" aria-label="Informations ayant déclenché ce signal">${flag.matches.map(m => `<li><b>${escape(m.label)}</b> : <span>${escape(m.term)}</span></li>`).join('')}</ul><details class="signal-explanation"><summary>Pourquoi cette précaution ?</summary><p>${escape(e.mechanism)}</p><p>${escape(e.condition)}</p>${citations(flag.sources)}</details></section>`;
  }
  function guideIntro(text) {
    return `<div class="guide-intro"><p>${text}</p><a class="btn-text" href="#sources">Lire les sources ${icon('arrow', 14)}</a></div>`;
  }
  function foodCard(f) {
    return `<article class="food-card" data-category="${escape(f.category)}">
      ${favoriteButton('food', f.id)}
      <button class="food-card-open" data-action="food" data-id="${escape(f.id)}" aria-label="Voir les précautions : ${escape(f.name)}">
        <div class="food-art-wrap">${f.origin === 'off' && f.image_front_small_url ? `<img class="product-image" src="${escape(f.image_front_small_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : art(f.art)}</div>
        <div class="food-card-content"><h3>${escape(f.name)}</h3>${badge(f.status)}<p>${escape(f.origin === 'off' && f.brands ? f.brands : f.summary)}</p></div>
      </button>
    </article>`;
  }
  function recipeCard(r) {
    return `<article class="recipe-card">${favoriteButton('recipe', r.id)}<button class="recipe-card-open" data-action="recipe" data-id="${r.id}">
      <div class="recipe-photo"><img src="assets/${r.image}.jpg" alt="" loading="lazy"><span class="recipe-time">${icon('clock', 12)} ${r.time} min</span><span class="recipe-access-tag ${r.premium ? 'is-plus' : 'is-free'}">${r.premium ? 'Plus' : 'Recette gratuite'}</span></div>
      <div class="recipe-card-content"><h3>${r.title}</h3>${route.page === 'recettes' ? `<p class="recipe-intro">${r.subtitle}</p>` : ''}<div class="recipe-tags"><span>${icon(r.vegetarian ? 'leaf' : 'recipe', 12)}${r.tags[0]}</span><span>${r.tags[1]}</span></div><p class="recipe-pregnancy-note">${icon('book', 13)}Précautions grossesse dans la fiche</p></div>
    </button></article>`;
  }
  function heading(title, subtitle, extra = '') { return `<div class="page-heading subpage-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${extra}</div>`; }
  function empty(title, description, link = '', iconName = 'leaf') { return `<div class="empty-state">${icon(iconName, 30)}<h2>${title}</h2><p>${description}</p>${link}</div>`; }

  function sidebar() {
    const links = [['accueil', 'home', 'Accueil'], ['cesoir', 'recipe', 'Ce soir'], ['aliments', 'search', 'Les aliments'], ['recettes', 'recipe', 'Les recettes']];
    const notebook = [['favoris', 'heart', 'Mes favoris'], ['menus', 'calendar', 'Mes menus'], ['courses', 'bag', 'Mes courses'], ['atelier', 'calendar', 'Préparer ma semaine']];
    const nav = ([page, symbol, label]) => `<a href="#${page}" class="nav-link ${route.page === page ? 'active' : ''}" ${route.page === page ? 'aria-current="page"' : ''}>${icon(symbol, 18)}<span>${label}</span>${page === 'favoris' && store.favorites.length ? `<span class="nav-count">${store.favorites.length}</span>` : ''}</a>`;
    return `<button class="icon-button sidebar-close" data-action="close-menu" aria-label="Fermer le menu">${icon('close')}</button>
      <a class="brand" href="#accueil" aria-label="Poum, accueil"><img src="assets/brand/mark.svg" alt="" width="32" height="32"><span class="wordmark">poum</span></a><p class="brand-tagline">Ta grossesse, à ton rythme.</p>
      <nav aria-label="Navigation principale"><p class="nav-label">Pour commencer</p>${links.map(nav).join('')}<p class="nav-label secondary">Mon carnet</p>${notebook.map(nav).join('')}<p class="nav-label secondary">À lire</p>${nav(['guide', 'book', 'Précautions grossesse'])}${nav(['sources', 'shield', 'Sources & méthode'])}</nav>
      <div class="sidebar-bottom"><a class="sidebar-plus" href="#plus"><span>${Billing.active ? 'Mon abonnement' : 'Les menus avec Plus'}</span>${icon('arrow', 16)}</a><p>20 recettes, les aliments et votre carnet restent gratuits.</p></div>`;
  }
  function topbar() {
    return `<button class="mobile-menu" data-action="menu" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="sidebar">${icon('menu', 22)}</button><div class="breadcrumb"><a class="brand-home" href="#accueil"><img src="assets/brand/mark.svg" alt="" width="32" height="32"><span>Poum<small>Alimentation & grossesse</small></span></a><span aria-hidden="true">/</span><b>${labels[route.page]}</b></div><div class="topbar-right"><a href="#plus" class="topbar-plus">${Billing.active ? 'Mon accès Plus' : 'Plus'}</a><a href="#profil" class="profile-trigger" aria-label="Mon compte et mes préférences"><span class="avatar">${store.name ? escape(store.name.charAt(0).toUpperCase()) : icon('user', 17)}</span><span>${escape(store.name || (Cloud.state.user ? 'Mon compte' : 'Se connecter'))}</span></a></div>`;
  }
  function footer() {
    return `<footer class="footer"><span><span class="footer-brand">poum</span> · Alimentation & grossesse</span><div class="footer-links"><a href="${seoURL('/alimentation-grossesse/')}">Guide grossesse</a><a href="${seoURL('/sources-et-methode/')}">Sources & méthode</a><a href="#confidentialite">Vos données</a><a href="#plus">Plus</a></div></footer>`;
  }
  function migrationNote() {
    const runtime = window.MietteRuntime;
    if (runtime?.cloud !== false || !runtime.appURL) return '';
    return `<aside class="migration-note"><div><b>Poum a une nouvelle maison.</b><p>Compte, carnet synchronisé et scan photo : retrouvez la version connectée.</p></div><div class="dialog-actions"><a class="btn btn-primary" href="${escape(runtime.appURL)}">Ouvrir l’application ${icon('arrow', 15)}</a><button class="btn btn-outline" data-action="transfer-notebook">Transférer mon carnet</button></div></aside>`;
  }
  function transferNotebook() {
    const runtime = window.MietteRuntime;
    if (runtime?.cloud !== false || !runtime.appURL) return;
    const target = new URL(runtime.appURL);
    const nonce = crypto.randomUUID();
    target.hash = 'profil?transfer=' + nonce;
    const child = window.open(target.href, '_blank');
    if (!child) { toast('Autorisez l’ouverture du nouvel onglet, ou exportez votre carnet depuis « Vos données ».', 'info'); return; }
    const receive = event => {
      if (event.source !== child || event.origin !== target.origin || event.data?.type !== 'miette:ready' || event.data.nonce !== nonce) return;
      child.postMessage({ type: 'miette:transfer', nonce, application: 'Miette', version: 1, notebook: store }, target.origin);
      window.removeEventListener('message', receive); clearTimeout(timeout);
    };
    const timeout = setTimeout(() => window.removeEventListener('message', receive), 120000);
    window.addEventListener('message', receive);
  }
  function receiveTransfer() {
    const nonce = route.params.get('transfer');
    if (!nonce || !/^[\w-]{20,60}$/.test(nonce) || !window.opener || window.MietteRuntime?.cloud === false) return;
    const sender = window.opener;
    const receive = event => {
      if (event.source !== sender || event.origin !== 'https://poilon.com' || event.data?.type !== 'miette:transfer' || event.data.nonce !== nonce) return;
      window.removeEventListener('message', receive); clearTimeout(timeout);
      history.replaceState(null, '', location.pathname + '#profil'); route = getRoute();
      window.opener = null;
      importNotebook(new Blob([JSON.stringify(event.data)], { type: 'application/json' }));
    };
    const timeout = setTimeout(() => { window.removeEventListener('message', receive); toast('Le transfert a expiré. Vous pouvez aussi importer un export JSON depuis « Vos données ».', 'info'); }, 60000);
    window.addEventListener('message', receive);
    sender.postMessage({ type: 'miette:ready', nonce }, 'https://poilon.com');
  }
  function searchForm(id, value = '', source = 'guide') {
    return `<form id="${id}" class="search-box" role="search">${icon('search', 21)}<label class="sr-only" for="${id}-input">${source === 'off' ? 'Nom, marque ou code-barres du produit' : 'Rechercher un aliment'}</label><input id="${id}-input" name="q" type="search" placeholder="${source === 'off' ? 'Un produit, une marque ou un code-barres…' : 'Rechercher un aliment…'}" value="${escape(value)}" maxlength="150" autocomplete="off"><button type="button" class="search-scan" data-action="scan" aria-label="Rechercher par code-barres" title="Rechercher par code-barres">${icon('scan', 20)}</button><button class="btn btn-primary" type="submit">Rechercher ${icon('arrow', 15)}</button></form>`;
  }
  function homePage() {
    const featuredRecipes = recipeHighlights.map(id => recipesById.get(id)).filter(r => !store.vegetarian || r.vegetarian).slice(0, 3);
    const tonight = recipesById.get('lasagnes-epinards-ricotta');
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<div class="home-dateline"><span>${store.name ? `Bonjour ${escape(store.name)}.` : 'Bonjour.'}</span><time datetime="${localDate()}">${date}</time></div>
      <section class="home-editorial" aria-labelledby="home-title"><div class="home-search-panel"><div class="pregnancy-signature"><span class="section-kicker">À table pendant la grossesse</span></div><h1 id="home-title"><em>Enceinte,</em><br>je peux en manger&nbsp;?</h1><p>Les aliments, les précautions et les recettes pour manger enceinte.</p>${searchForm('home-search')}<button class="home-plus-shortcut" data-action="plus-offer"><span>100 recettes, vos menus et les courses</span><b>Avec Plus ${icon('arrow', 14)}</b></button><div class="suggestions"><span>Par exemple</span>${['Ananas', 'Mozzarella', 'Café'].map(q => `<a class="suggestion" href="${href('aliments', { q })}">${q}</a>`).join('')}</div><a class="home-guide-link" href="#aliments">${D.foods.length} aliments expliqués pour la grossesse ${icon('arrow', 16)}</a><p class="home-source-note"><a href="#sources">Des conseils expliqués et sourcés.</a></p></div>
      <figure class="home-illustration"><img src="assets/brand/table-maternite-v4-640.webp" srcset="assets/brand/table-maternite-v4-320.webp 320w, assets/brand/table-maternite-v4-640.webp 640w" sizes="(max-width: 600px) 103px, 430px" alt="Illustration d’une femme enceinte à table, la main posée sur son ventre" width="1254" height="1254" fetchpriority="high"></figure></section>${Tonight.homeCard()}<div class="home-after-hero"><figure class="tonight-feature"><button data-action="recipe" data-id="${tonight.id}" aria-label="Voir la recette : ${escape(tonight.title)}"><img class="home-food-photo" src="assets/${tonight.image}.jpg" alt="Un plat de lasagnes gratinées" loading="lazy" width="760" height="530"><span class="tonight-copy"><span class="section-kicker">Une recette pour ce soir</span><strong>${escape(tonight.title)}</strong><span>${tonight.time} min · Pour 2 personnes ${icon('arrow', 17)}</span></span></button><figcaption>Photo d’inspiration · Précautions dans la fiche.</figcaption></figure>${premiumNudge('home')}</div>
      <section class="home-foods" aria-labelledby="search-title"><div class="section-heading"><div><h2 id="search-title">Et ça, pendant la grossesse ?</h2></div><a href="#aliments" class="btn-text">Tout le guide ${icon('arrow', 15)}</a></div><div class="food-grid">${D.foods.slice(0, 4).map(foodCard).join('')}</div></section>
      <aside class="kitchen-note"><span class="section-kicker">Les gestes pendant la grossesse</span><p><strong>Les fruits et légumes, même épluchés ?</strong> Lavez-les à l’eau potable avant de les éplucher ou de les couper.</p><a href="#guide" class="btn-text">Les gestes à connaître ${icon('arrow', 14)}</a></aside>
      <section class="recipes-section" aria-labelledby="recipes-title"><div class="section-heading"><div><h2 id="recipes-title">Des idées pour manger enceinte</h2><p>Les précautions de préparation accompagnent chacune des ${D.recipes.length} recettes.</p></div><a class="btn-text" href="#recettes">Toutes les recettes ${icon('arrow', 15)}</a></div><div class="recipe-grid">${featuredRecipes.map(recipeCard).join('')}</div></section>
      <p class="home-footer-note">Ces repères sont généraux. Votre sage-femme ou médecin peut les adapter à votre situation. <a href="#sources">En savoir plus</a></p>`;
  }
  function familyFilters() {
    const category = route.params.get('categorie');
    const families = category === 'produce' ? [['all', 'Tous'], ['fruit', 'Fruits'], ['vegetable', 'Légumes'], ['herb', 'Herbes aromatiques']] : category === 'seasoning' ? [['all', 'Tous'], ['spice', 'Épices'], ['blend', 'Mélanges'], ['herb', 'Aromates'], ['condiment', 'Sauces & condiments']] : null;
    if (!families) return '';
    return `<div class="food-families" role="group" aria-label="${category === 'produce' ? 'Famille de fruits et légumes' : 'Famille d’épices et aromates'}">${families.map(([id, label]) => `<button class="category-chip ${(route.params.get('famille') || 'all') === id ? 'active' : ''}" data-action="food-family" data-family="${id}" aria-pressed="${(route.params.get('famille') || 'all') === id}">${label}</button>`).join('')}</div>${category === 'seasoning' ? '<div class="seasoning-note">Une épice dans un plat, une infusion et un extrait concentré peuvent appeler des conseils différents. Chaque fiche précise la forme et l’usage concernés.</div>' : ''}`;
  }
  function explorePage() {
    const source = route.params.get('source') === 'off' ? 'off' : 'guide';
    const q = route.params.get('q') || '';
    return `${heading('Les aliments pendant la grossesse', 'Ce qui est possible, les précautions à prendre et les gestes en cuisine.')}${guideIntro(`${D.foods.length} fiches, dont ${D.foods.filter(f => f.category === 'produce').length} fruits, légumes et herbes. Pourquoi c’est compatible, à limiter ou à éviter : chaque repère est expliqué et sourcé.`)}
      <div class="tabs" role="group" aria-label="Source de la recherche"><a href="${href('aliments', { q, source: 'guide' })}" class="tab ${source === 'guide' ? 'active' : ''}" ${source === 'guide' ? 'aria-current="true"' : ''}>${icon('leaf', 16)}Le guide des aliments</a><a href="${href('aliments', { q, source: 'off' })}" class="tab ${source === 'off' ? 'active' : ''}" ${source === 'off' ? 'aria-current="true"' : ''}>${icon('scan', 16)}Les produits en rayon</a></div>
      ${searchForm('explore-search', q, source)}
      ${source === 'guide' ? `<div class="category-list" role="group" aria-label="Catégorie d’aliments">${D.categories.map(c => `<button class="category-chip ${(route.params.get('categorie') || 'all') === c.id ? 'active' : ''}" data-action="category" data-category="${c.id}" aria-pressed="${(route.params.get('categorie') || 'all') === c.id}">${icon(c.icon, 16)}${c.label}</button>`).join('')}</div>${familyFilters()}<div class="filter-row" role="group" aria-label="Filtrer les précautions"><span class="filter-label">Afficher :</span>${[['all', 'Tous'], ...Object.entries(D.statuses).map(([k, v]) => [k, v.label])].map(([id, label]) => `<button class="filter-chip ${(route.params.get('statut') || 'all') === id ? 'active' : ''}" data-action="status" data-filter="${id}" aria-pressed="${(route.params.get('statut') || 'all') === id}">${label}</button>`).join('')}</div><div id="food-results" aria-live="polite">${guideResults()}</div><div class="legend">${icon('info', 15)}<span><b>Compatible</b> signifie « dans les conditions de préparation indiquées ». Ouvrez la fiche pour les connaître.</span></div>` : `<div class="suggestions"><span>Recherche par nom, marque ou code-barres · Sur validation uniquement</span></div><div class="off-note">${icon('info', 19)}<p>Les fiches <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a> sont collaboratives. Poum repère certaines précautions, mais ne peut pas certifier qu’un produit convient à la grossesse. Vérifiez toujours l’emballage.</p></div><div id="off-results" aria-live="polite" aria-busy="${apiState.loading}">${offResults()}</div>`}`;
  }
  function guideResults() {
    const q = R.normalize(route.params.get('q') || '');
    const category = route.params.get('categorie') || 'all';
    const status = route.params.get('statut') || 'all';
    const family = ['produce', 'seasoning'].includes(category) ? route.params.get('famille') || 'all' : 'all';
    const matches = D.foods.filter(f => (family === 'all' || (category === 'seasoning' ? f.seasoningFamily : f.family) === family) && (category === 'all' || f.category === category || (category === 'seasoning' && f.seasoningFamily)) && (status === 'all' || f.status === status) && (!q || q.split(' ').every(part => R.normalize(f.name + ' ' + f.aliases).split(/[^a-z0-9]+/).some(word => word.startsWith(part)))));
    const limit = Math.max(48, Math.min(D.foods.length, (Number(route.params.get('afficher')) || 48)));
    const visible = matches.slice(0, limit);
    return `<div class="results-meta"><span>${matches.length} aliment${matches.length > 1 ? 's' : ''} ${q ? `pour « ${escape(route.params.get('q'))} »` : 'pour mieux vous repérer'}</span><span>Guide consultable hors connexion</span></div>${matches.length ? `<div class="food-grid explore-grid">${visible.map(foodCard).join('')}</div>${visible.length < matches.length ? `<div class="load-more"><button class="btn btn-outline" data-action="more-foods">Voir plus d’aliments (${visible.length}/${matches.length}) ${icon('plus', 15)}</button></div>` : ''}` : empty('Cette envie mérite une recherche.', 'Aucun aliment du guide ne correspond à ces filtres. Essayez un nom plus simple ou cherchez le produit dans Open Food Facts.', `<a class="btn btn-primary" href="${href('aliments', { source: 'off', q: route.params.get('q') || '' })}">Chercher un produit ${icon('arrow', 16)}</a>`, 'search')}`;
  }
  function offResults() {
    const q = route.params.get('q') || '';
    if (!q) return `<div class="off-empty"><div class="off-empty-icon">${icon('scan', 29)}</div><h3>Votre rayon, à portée de main.</h3><p>Recherchez parmi les produits de la base mondiale Open Food Facts, ou saisissez le code-barres de votre emballage.</p><button class="btn btn-secondary" data-action="scan">${icon('scan', 16)}Utiliser un code-barres</button></div>`;
    if (apiState.loading && !apiState.products.length) return `<p class="loading-caption">À la recherche de « ${escape(q)} » dans Open Food Facts…</p><div class="food-grid explore-grid">${Array.from({ length: 4 }, () => '<div class="skeleton" aria-hidden="true"></div>').join('')}</div>`;
    const error = apiState.error ? `<div class="error-panel" role="alert"><h3>La recherche n’a pas abouti.</h3><p>${escape(apiState.error)}</p><button class="btn btn-outline" data-action="retry-api">${icon('refresh', 15)}Réessayer</button></div>` : '';
    if (!apiState.products.length) return error || empty('Aucun produit trouvé.', 'Vérifiez le nom ou le code-barres. La base est collaborative : tous les produits ne sont pas encore renseignés.', `<a href="${href('aliments', { q })}" class="btn btn-secondary">Chercher dans le guide ${icon('arrow', 15)}</a>`, 'search');
    return `${error}<div class="results-meta"><span>${apiState.products.length} produits affichés · ${apiState.count.toLocaleString('fr-FR')} trouvés</span><span>${apiState.cached ? 'Résultats en cache · moins de 24 h' : 'Données Open Food Facts'}</span></div><div class="food-grid explore-grid">${apiState.products.map(foodCard).join('')}</div>${apiState.hasMore ? `<div class="load-more"><button class="btn btn-outline" data-action="more-products" ${apiState.loading ? 'disabled' : ''}>${apiState.loading ? '<span class="spinner"></span> Recherche en cours…' : `Voir plus de produits ${icon('plus', 15)}`}</button></div>` : ''}<p class="legal-copy small">Données : Open Food Facts, licence ODbL. Images des produits : CC BY-SA. Les fiches restent à vérifier sur l’emballage.</p>`;
  }
  async function searchAPI(more = false) {
    const q = route.params.get('q') || '';
    if (!q) return;
    if (apiAbort) apiAbort.abort();
    apiAbort = new AbortController();
    const generation = ++requestGeneration;
    const page = more ? apiState.page + 1 : 1;
    if (!more) apiState = { key: q, query: q, products: [], count: 0, page: 1, loading: true, error: '', hasMore: false, cached: false };
    else { apiState.loading = true; apiState.error = ''; }
    updateAPIResults();
    try {
      const result = await API.request(q, page, apiAbort.signal);
      if (generation !== requestGeneration) return;
      result.products.forEach(p => productMap.set(p.id, p));
      const combined = more ? [...apiState.products, ...result.products] : result.products;
      apiState = { ...result, key: q, query: q, products: [...new Map(combined.map(p => [p.id, p])).values()], loading: false, error: '' };
    } catch (err) {
      if (generation !== requestGeneration || err.name === 'AbortError') return;
      apiState.loading = false; apiState.error = err.message;
    }
    if (generation === requestGeneration) updateAPIResults();
  }
  function updateAPIResults() { const el = $('#off-results'); if (el) { el.setAttribute('aria-busy', String(apiState.loading)); el.innerHTML = offResults(); } }
  function recipeSettings() {
    const requestedType = route.params.get('type');
    return {
      type: Object.hasOwn(recipeTypes, requestedType) ? requestedType : 'all',
      collection: D.recipeCollections.some(c => c.id === route.params.get('collection')) ? route.params.get('collection') : 'all',
      vegetarian: route.params.get('vegetarien') === '1' || (store.vegetarian && !route.params.has('vegetarien')),
      duration: [20, 30, 45].includes(Number(route.params.get('duree'))) ? Number(route.params.get('duree')) : 0,
      sort: ['rapide', 'az'].includes(route.params.get('tri')) ? route.params.get('tri') : 'inspiration',
      access: ['free', 'plus'].includes(route.params.get('acces')) ? route.params.get('acces') : 'all',
      q: R.normalize(route.params.get('q') || '').trim()
    };
  }
  function recipeMatches(recipe, query) {
    const text = R.normalize(recipe.title + ' ' + recipe.ingredients.map(i => i.name).join(' '));
    return query.split(/\s+/).filter(Boolean).every(word => text.includes(word));
  }
  function filteredRecipes() {
    const s = recipeSettings();
    return D.recipes.filter(r => (s.access === 'all' || (s.access === 'plus') === r.premium) && (!s.vegetarian || r.vegetarian) && (s.type === 'all' || r.type === s.type) && (s.collection === 'all' || r.collection === s.collection) && (!s.duration || r.time <= s.duration) && recipeMatches(r, s.q))
      .sort((a, b) => s.sort === 'rapide' ? a.time - b.time || a.title.localeCompare(b.title, 'fr') : s.sort === 'az' ? a.title.localeCompare(b.title, 'fr') : recipeOrder.get(a.id) - recipeOrder.get(b.id));
  }
  function recipeResults() {
    const recipes = filteredRecipes();
    const requestedPage = Number(route.params.get('page') || 1);
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(Math.ceil(D.recipes.length / recipePageSize), Math.trunc(requestedPage))) : 1;
    const visible = recipes.slice(0, page * recipePageSize);
    return `<div class="results-meta"><span id="recipe-count" role="status">${recipes.length} recette${recipes.length > 1 ? 's' : ''} pour se faire plaisir</span><span>Portions ajustables · 1 à 8 personnes</span></div>${recipes.length ? `<div class="recipe-grid">${visible.map(recipeCard).join('')}</div><div class="recipe-pagination"><p>${visible.length} sur ${recipes.length} recettes</p>${visible.length < recipes.length ? `<button class="btn btn-outline" data-action="more-recipes">Encore des bonnes idées ${icon('plus', 16)}</button>` : `<span class="recipe-end">${icon('heart', 14)}Vous avez fait le tour de ces envies.</span>`}</div>` : empty('Une autre petite envie ?', 'Essayez un autre ingrédient ou élargissez les filtres.', '<button class="btn btn-secondary" data-action="reset-recipes">Réinitialiser les filtres</button>', 'recipe')}`;
  }
  function recipePage() {
    const s = recipeSettings();
    return `<div class="recipes-page"><section class="recipe-welcome" aria-labelledby="recipe-welcome-title"><div><span class="section-kicker">Cuisine & grossesse</span><h1 id="recipe-welcome-title">Enceinte, on mange quoi&nbsp;?</h1><p>Un plat, un ingrédient, une idée pour ce soir. Les précautions grossesse accompagnent chaque recette.</p><span class="recipe-welcome-note">${D.freeRecipeCount} recettes gratuites · ${D.recipes.length - D.freeRecipeCount} avec Plus</span></div><img class="recipe-sketch" src="assets/brand/carnet-cuisine-v4-640.webp" srcset="assets/brand/carnet-cuisine-v4-320.webp 320w, assets/brand/carnet-cuisine-v4-640.webp 640w" sizes="(max-width: 600px) 75px, 250px" alt="" width="1536" height="1024" loading="lazy"></section>
      ${premiumNudge('recipes')}<section class="recipe-collection-section" aria-labelledby="collections-title"><div class="section-heading"><div><h2 id="collections-title">Les collections</h2><p>Du petit-déjeuner au dîner.</p></div><button class="btn-text" data-action="recipe-collection" data-collection="all" aria-pressed="${s.collection === 'all'}">Tout explorer ${icon('arrow', 15)}</button></div><div class="recipe-collections" role="group" aria-label="Collections de recettes">${D.recipeCollections.map(c => `<button class="recipe-collection ${s.collection === c.id ? 'active' : ''}" data-action="recipe-collection" data-collection="${c.id}" aria-pressed="${s.collection === c.id}"><img src="assets/${c.image}.jpg" alt="" loading="lazy" width="180" height="120"><span><b>${c.label}</b><small>${D.recipes.filter(r => r.collection === c.id).length} recettes ${icon('arrow', 12)}</small></span></button>`).join('')}</div></section>
      <div class="recipe-access-filters" role="group" aria-label="Accès aux recettes">${[['all', 'Toutes'], ['free', '20 gratuites'], ['plus', '80 Plus']].map(([id, label]) => `<button class="category-chip ${s.access === id ? 'active' : ''}" data-action="recipe-access-filter" data-access="${id}" aria-pressed="${s.access === id}">${label}</button>`).join('')}</div><form id="recipe-search" class="search-box" role="search">${icon('search', 20)}<label class="sr-only" for="recipe-query">Rechercher une recette ou un ingrédient</label><input id="recipe-query" name="q" type="search" maxlength="100" value="${escape(route.params.get('q') || '')}" placeholder="Un ingrédient, un plat… chocolat, tacos, courgette"><button class="btn btn-primary" type="submit">Rechercher ${icon('arrow', 15)}</button></form>
      <div class="category-list recipe-filters" role="group" aria-label="Type de repas">${Object.entries(recipeTypes).map(([id, label]) => `<button class="category-chip ${s.type === id ? 'active' : ''}" data-action="recipe-type" data-type="${id}" aria-pressed="${s.type === id}">${label}</button>`).join('')}</div>
      <div class="recipe-toolbar"><button class="category-chip ${s.vegetarian ? 'active' : ''}" data-action="vegetarian" aria-pressed="${s.vegetarian}">${icon('leaf', 15)}Végétarien</button><div class="recipe-select"><label for="recipe-duration">${icon('clock', 14)}Temps total</label><select id="recipe-duration"><option value="0">J’ai le temps</option>${[20, 30, 45].map(n => `<option value="${n}" ${s.duration === n ? 'selected' : ''}>${n} min maximum</option>`).join('')}</select></div><div class="recipe-select"><label for="recipe-sort">Trier par</label><select id="recipe-sort"><option value="inspiration">Nos inspirations</option><option value="rapide" ${s.sort === 'rapide' ? 'selected' : ''}>Les plus rapides</option><option value="az" ${s.sort === 'az' ? 'selected' : ''}>Nom, de A à Z</option></select></div></div>
      <div id="recipe-active-filters">${recipeActiveFilters()}</div><div id="recipe-results">${recipeResults()}</div><p class="photo-caption">Photos d’inspiration. Les ingrédients et les préparations à suivre figurent dans les fiches.</p></div>`;
  }
  function recipeActiveFilters() {
    const s = recipeSettings();
    const collection = D.recipeCollections.find(c => c.id === s.collection);
    const labels = [collection?.label, s.type !== 'all' && recipeTypes[s.type], s.duration && `${s.duration} min maximum`, s.vegetarian && 'Végétarien', s.q && `« ${route.params.get('q')} »`].filter(Boolean);
    return labels.length ? `<div class="recipe-active"><span>${labels.map(escape).join(' · ')}</span><button class="btn-text" data-action="reset-recipes">Tout effacer ${icon('close', 12)}</button></div>` : '';
  }
  function updateRecipeFilters(changes) {
    const params = { ...Object.fromEntries(route.params), ...changes, page: null };
    history.replaceState(null, '', href('recettes', params));
    route = getRoute();
    const s = recipeSettings();
    document.querySelectorAll('[data-action="recipe-access-filter"]').forEach(button => { const active = button.dataset.access === s.access; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    document.querySelectorAll('[data-action="recipe-collection"], [data-action="recipe-type"], [data-action="vegetarian"]').forEach(button => {
      const active = button.dataset.action === 'recipe-collection' ? button.dataset.collection === s.collection : button.dataset.action === 'recipe-type' ? button.dataset.type === s.type : s.vegetarian;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    $('#recipe-active-filters').innerHTML = recipeActiveFilters();
    $('#recipe-results').innerHTML = recipeResults();
  }
  function favoritesPage() {
    const foods = store.favorites.filter(f => f.startsWith('food:')).map(f => foodsById.get(f.slice(5)) || productMap.get(f.slice(5))).filter(Boolean);
    const recipes = store.favorites.filter(f => f.startsWith('recipe:')).map(f => recipesById.get(f.slice(7))).filter(Boolean);
    return `${heading('Mes favoris', 'Les aliments et les recettes que vous avez gardés.')}${premiumNudge('favorites')}${!foods.length && !recipes.length ? empty('Vous n’avez pas encore de favoris.', 'Utilisez le cœur sur une fiche pour la retrouver ici.', '<a class="btn btn-primary" href="#aliments">Explorer les aliments ' + icon('arrow', 16) + '</a>', 'heart') : `${foods.length ? `<div class="section-heading"><h2>Mes aliments <span class="muted small">(${foods.length})</span></h2></div><div class="food-grid explore-grid">${foods.map(foodCard).join('')}</div>` : ''}${recipes.length ? `<section class="recipes-section"><div class="section-heading"><h2>Mes recettes <span class="muted small">(${recipes.length})</span></h2></div><div class="recipe-grid">${recipes.map(recipeCard).join('')}</div></section>` : ''}`}`;
  }
  function plusStamp() { return `<span class="plus-stamp">poum <b>plus</b></span>`; }
  function plusPrice(plan) { return (plan.cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }); }
  function plusTerms() {
    const plan = Plus.offer.plans.find(p => p.id === plusPlan);
    return `<strong>${plusPrice(plan)} ${plan.cadence}.</strong> ${escape(plan.terms)}`;
  }
  function plusPlans(prefix) {
    return `<fieldset class="plus-plans"><legend>Les formules proposées</legend>${Plus.offer.plans.map(plan => `<label class="plus-plan" for="${prefix}-${plan.id}"><input id="${prefix}-${plan.id}" type="radio" name="plus-plan-${prefix}" value="${plan.id}" data-plus-plan ${plusPlan === plan.id ? 'checked' : ''}><span class="plus-plan-copy"><span class="plus-plan-name">${plan.name}${plan.id === 'pass' ? '<small>Un seul paiement</small>' : ''}</span><span class="plus-price">${plusPrice(plan)} <small>${plan.cadence}</small></span><span class="plus-plan-caption">${plan.id === 'pass' ? '14,20 € de moins que 9 mensualités' : 'Pour la durée qui vous convient'}</span></span></label>`).join('')}</fieldset><p class="plus-terms" data-plus-terms aria-live="polite">${plusTerms()}</p>`;
  }
  function billingCta() {
    const b = Billing.state, plan = Plus.offer.plans.find(p => p.id === plusPlan);
    if (Billing.active) return `<button class="btn btn-primary plus-cta" data-action="plus-preview" data-billing-cta>Ouvrir mon atelier Plus ${icon('arrow', 16)}</button>`;
    if (!b.loaded) return '<button class="btn btn-primary plus-cta" data-billing-cta disabled>Chargement de l’offre…</button>';
    if (b.mode === 'error') return '<button class="btn btn-primary plus-cta" data-action="billing-refresh" data-billing-cta>Réessayer la connexion à Plus</button>';
    if (b.mode !== 'mirror' && !b.configured) return `<button class="btn btn-primary plus-cta" data-action="plus-preview" data-billing-cta>Essayer l’atelier offert ${icon('arrow', 16)}</button>`;
    if (b.canManage && b.access.subscriptionStatus && !['canceled', 'incomplete_expired'].includes(b.access.subscriptionStatus)) return '<button class="btn btn-primary plus-cta" data-action="billing-portal" data-billing-cta>Gérer mon abonnement et mon paiement</button>';
    return `<button class="btn btn-primary plus-cta" data-action="billing-checkout" data-billing-cta ${checkoutBusy ? 'disabled' : ''}>${icon('lock', 15)}${checkoutBusy ? 'Ouverture du paiement…' : `${b.mode === 'test' ? 'Tester' : 'Choisir'} ${plan.id === 'pass' ? `le pass à ${plusPrice(plan)}` : `Plus à ${plusPrice(plan)}/mois`}`}</button>`;
  }
  function billingNote() {
    const b = Billing.state;
    if (b.mode === 'test') return '<p class="plus-launch-note"><strong>Mode test Stripe.</strong> Aucun prélèvement réel. Les montants servent à vérifier le parcours de paiement.</p>';
    if (b.mode === 'error') return '<p class="plus-launch-note">Le statut des paiements est momentanément indisponible. Réessayez dans un instant.</p>';
    if (b.loaded && !b.configured && b.mode !== 'mirror') return '<p class="plus-launch-note">L’atelier reste offert pendant l’ouverture des paiements, ainsi que les recettes Plus. Aucun abonnement ne commence sans achat.</p>';
    return '<p class="plus-launch-note">Le paiement s’effectue sur Stripe. Retrouvez vos factures et la gestion du renouvellement dans votre compte Poum.</p>';
  }
  function billingFeedback() { return `<div class="billing-return"><p data-billing-feedback class="billing-feedback" role="status">${escape(billingMessage || Billing.state.error)}</p>${pendingCheckoutSession && !Cloud.state.user ? '<a class="btn btn-primary" href="#profil?retour=achat">Me connecter pour retrouver mon achat</a>' : ''}</div>`; }
  function memberPanel() {
    const b = Billing.state, active = Billing.active;
    const until = b.access.until ? new Date(b.access.until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    return `<section class="member-panel"><div class="member-symbol">${icon('calendar', 28)}</div><div><span class="eyebrow">${active ? 'Votre accès Plus' : 'VOTRE ABONNEMENT'}</span><h2>${active ? 'Votre atelier est disponible.' : 'Retrouvez votre accès Plus.'}</h2><p>${active ? b.access.plan === 'pass' ? `Votre pass est actif jusqu’au ${until}, sans renouvellement automatique.` : b.access.cancelAtPeriodEnd ? `Le renouvellement est arrêté. Plus reste accessible jusqu’au ${until}.` : `Votre abonnement est actif. Période payée jusqu’au ${until}.` : b.access.subscriptionStatus === 'past_due' ? 'Le paiement doit être mis à jour pour retrouver les nouvelles semaines.' : 'Vos menus enregistrés restent accessibles. Vous pouvez gérer vos achats depuis Stripe.'}</p><div class="dialog-actions">${active ? '<a class="btn btn-primary" href="#atelier">Préparer ma prochaine semaine</a>' : ''}${b.canManage ? '<button class="btn btn-outline" data-action="billing-portal">Mon abonnement & mes factures</button><button class="btn-text" data-action="billing-restore">Actualiser mon accès</button>' : ''}</div></div></section>`;
  }
  function premiumNudge(place = 'home') {
    const copy = {
      home: ['Les repas de la semaine, au même endroit.', '100 recettes, vos menus et les courses avec Plus.'],
      recipes: ['Toutes les recettes. Et les menus qui vont avec.', '20 recettes gratuites pour commencer, 80 de plus avec l’abonnement.'],
      favorites: ['Et pour les prochains repas ?', 'Préparez une semaine de menus que vous pourrez ajuster.'],
      shopping: ['Partir des menus pour faire les courses', 'L’atelier regroupe les ingrédients et les quantités de la semaine.'],
      recipe: ['Cette recette, puis toute la semaine.', 'Avec Plus : les 100 préparations, vos menus et leurs courses.']
    }[place];
    return `<aside class="premium-nudge premium-nudge-${place}" data-premium-place="${place}"><div>${plusStamp()}<h2>${copy[0]}</h2><p>${copy[1]}</p><span class="premium-nudge-caption">${Billing.active ? 'Votre atelier Plus est ouvert' : place === 'recipes' ? 'Première semaine offerte · 4,90 €/mois' : 'Première semaine offerte · Plus : 4,90 €/mois ou 29,90 € les 9 mois'}</span></div><div class="premium-actions">${Billing.active ? '<a class="btn btn-primary" href="#atelier">Ouvrir mon atelier</a>' : `<button class="btn btn-primary" data-action="plus-offer">Découvrir Plus ${icon('arrow', 16)}</button>${place === 'home' ? '<button class="btn-text" data-action="plus-example">Voir un exemple</button>' : ''}`}</div></aside>`;
  }
  async function startCheckout() {
    if (checkoutBusy) return;
    if (route.page === 'cesoir') { try { sessionStorage.setItem('poum-dinner-checkout', String(Date.now() + 3600000)); } catch {} }
    if (Billing.state.mode === 'mirror') { location.assign(new URL('#plus?acheter=' + plusPlan, window.MietteRuntime.appURL)); return; }
    if (!Cloud.state.user) { authMode = 'signup'; go('profil', { retour: 'plus', formule: plusPlan }); toast('Un compte permet de retrouver votre achat et vos semaines.', 'lock'); return; }
    checkoutBusy = true; billingMessage = '';
    document.querySelectorAll('[data-billing-cta]').forEach(el => { el.outerHTML = billingCta(); });
    try { const result = await Billing.action('checkout', { plan: plusPlan }); Billing.redirect(result.url); }
    catch (error) {
      billingMessage = error.message; toast(error.message, 'info');
      if (['already_active', 'manage_subscription'].includes(error.data?.code)) await Billing.refresh();
    } finally {
      checkoutBusy = false; document.querySelectorAll('[data-billing-cta]').forEach(el => { el.outerHTML = billingCta(); });
      document.querySelectorAll('[data-billing-feedback]').forEach(el => { el.textContent = billingMessage; });
    }
  }
  async function billingPortal() {
    if (checkoutBusy) return;
    checkoutBusy = true;
    try { const result = await Billing.action('portal'); Billing.redirect(result.url); }
    catch (error) { billingMessage = error.message; toast(error.message, 'info'); document.querySelectorAll('[data-billing-feedback]').forEach(el => { el.textContent = billingMessage; }); }
    finally { checkoutBusy = false; }
  }
  function workshopLogin(value) {
    try { sessionStorage.setItem('miamama-workshop-intent', JSON.stringify(value)); } catch {}
    authMode = 'signup'; go('profil', { retour: 'atelier' });
    Cloud.refreshSession().catch(() => {});
  }
  async function resumeCommerce() {
    if (!Cloud.state.user) return;
    await Billing.refresh();
    if (pendingCheckoutSession) {
      const session = pendingCheckoutSession;
      billingMessage = 'Votre paiement est en cours de vérification…'; go('plus');
      try { const result = await Billing.action('confirm', { session }); billingMessage = result.access.active ? 'Votre accès Plus est actif. Votre prochaine semaine vous attend.' : 'Stripe n’a pas encore confirmé le paiement. Vous pouvez actualiser votre accès dans un instant.'; }
      catch (error) { billingMessage = error.message; if (error.status !== 403) { rerender(true); return; } }
      pendingCheckoutSession = null; try { sessionStorage.removeItem('miamama-checkout-return'); } catch {}
      let dinnerReturn = false; try { dinnerReturn = Number(sessionStorage.getItem('poum-dinner-checkout')) > Date.now(); if (Billing.active) sessionStorage.removeItem('poum-dinner-checkout'); } catch {}
      if (Billing.active && dinnerReturn) { go('cesoir'); return; }
      rerender(true); return;
    }
    const destination = route.params.get('retour');
    if (destination === 'plus') { plusPlan = Plus.offer.plans.some(p => p.id === route.params.get('formule')) ? route.params.get('formule') : plusPlan; go('plus'); await startCheckout(); }
    if (destination === 'atelier') {
      let intent; try { intent = JSON.parse(sessionStorage.getItem('miamama-workshop-intent') || 'null'); sessionStorage.removeItem('miamama-workshop-intent'); } catch {}
      Workshop.resume(intent); go('atelier');
      requestAnimationFrame(() => { if (intent && $('#workshop-form')) Workshop.submit($('#workshop-form')); });
    }
  }
  function plusOffer() {
    if (Billing.active) { go(route.page === 'cesoir' ? 'cesoir' : 'atelier'); return; }
    const stats = Workshop.stats();
    openDialog(`<div class="dialog-content plus-dialog offer-dialog">${plusStamp()}<h2 id="dialog-title">Les recettes, les menus, les courses. Tout au même endroit.</h2><p class="plus-lead">Avec Plus, retrouvez les 100 recettes complètes et préparez vos semaines pendant la grossesse selon vos goûts et votre temps de cuisine.</p>${stats.ready ? `<div class="offer-proof"><b>Dans votre semaine</b><div><span><strong>${stats.meals}</strong> repas</span><span><strong>${stats.matches}</strong> avec vos ingrédients</span><span><strong>${stats.items}</strong> articles à prévoir</span></div></div>` : '<div class="offer-dialog-photo"><img src="assets/recipes/gnocchi.jpg" alt="Gnocchis dorés, une des recettes à composer dans l’atelier." width="600" height="220"><span>Un exemple de plat proposé dans l’atelier.</span></div>'}<ul class="plus-benefits"><li>Les dîners selon vos envies, avec les courses partagées et le relais avec un proche</li><li>${icon('check', 17)}80 recettes complètes en plus des 20 gratuites</li><li>${icon('check', 17)}7 dîners ou 14 repas selon vos préférences</li><li>${icon('check', 17)}Des recettes qui utilisent les ingrédients du placard</li><li>${icon('check', 17)}Remplacement des plats et quantités recalculées</li><li>${icon('check', 17)}Le carnet avec les recettes et les courses</li></ul>${plusPlans('dialog')}${billingNote()}${billingCta()}${billingFeedback()}<button class="btn-text plus-try" data-action="plus-preview">${stats.ready ? 'Retrouver ma semaine' : 'Commencer par ma semaine offerte'}</button><button class="btn-text plus-dismiss" data-action="close-dialog">Continuer gratuitement</button><p class="plus-free-note">Les ${D.foods.length} fiches, Open Food Facts, ${D.freeRecipeCount} recettes complètes et le carnet restent gratuits. Les précautions de toutes les recettes restent publiques.</p></div>`, { type: 'plus-offer' });
  }
  function plusPage() {
    if (Billing.active) return `${heading('Votre abonnement Plus', 'Préparer les menus, retrouver les courses, gérer votre abonnement.')}${billingFeedback()}${memberPanel()}${premiumNudge('home')}`;
    const examples = ['gnocchis-pesto', 'dhal-coco', 'tacos-cabillaud'].map(id => recipesById.get(id));
    return `<div class="offer-page">${billingFeedback()}${Billing.state.canManage ? memberPanel() : ''}
      <section class="offer-hero"><div class="offer-hero-copy">${plusStamp()}<h1>Enceinte, de quoi cuisiner<br>toute la semaine.</h1><p>Quand les goûts changent ou que cuisiner prend trop de temps, l’atelier propose des repas avec les ingrédients que vous aimez et ceux qu’il reste dans le placard.</p><p><strong>100 recettes complètes, des menus modifiables et une liste de courses regroupée.</strong> Les précautions grossesse accompagnent chaque plat.</p><p class="offer-upfront-price">4,90 € / mois <span>ou 29,90 € en une fois pour 9 mois</span></p><button class="btn btn-primary offer-buy" data-action="plus-offer">Choisir mon accès Plus ${icon('arrow', 16)}</button><button class="btn btn-outline offer-primary" data-action="plus-preview">Essayer ma semaine offerte ${icon('arrow', 17)}</button><small>Avec un compte gratuit, sans carte bancaire.</small><button class="btn-text offer-example-button" data-action="plus-example">D’abord, voir un exemple ${icon('arrow', 14)}</button></div>
      <div class="week-sample"><div class="week-sample-heading"><span>Le carnet de la semaine</span><small>Un exemple</small></div><img class="week-sample-photo" src="assets/recipes/gnocchi.jpg" alt="Une poêlée de gnocchis" width="760" height="530">${examples.map((r, i) => `<button class="week-sample-row" data-action="recipe" data-id="${r.id}"><span>${['Lun.', 'Mar.', 'Mer.'][i]}</span><span><b>${escape(r.title)}</b><small>${r.time} minutes</small></span>${icon('arrow', 15)}</button>`).join('')}<button class="btn-text week-sample-more" data-action="plus-example">Voir les sept dîners ${icon('arrow', 14)}</button></div></section>
      <section class="offer-pricing-section" aria-labelledby="offer-price-title"><div class="offer-pricing-copy"><span class="section-kicker">Ce que comprend Plus</span><h2 id="offer-price-title">Des menus qu’on peut changer.</h2><ul class="offer-inclusions"><li><b>Les 100 recettes complètes.</b><p>80 préparations supplémentaires : brunchs, plats au four, dîners rapides et desserts. Les recettes ouvertes sont conservées sur votre appareil.</p></li><li><b>7 dîners ou 14 repas, pour deux.</b><p>Avec votre temps de cuisine, les ingrédients à utiliser et ceux que vous préférez écarter.</p></li><li><b>Un autre plat si celui-ci ne vous tente pas.</b><p>Gardez vos favoris, remplacez une recette. Les quantités des courses sont recalculées.</p></li><li><b>La liste et les recettes à emporter.</b><p>Cochez ce que vous avez déjà, puis téléchargez le carnet pour cuisiner ou le partager.</p></li></ul><p class="offer-honesty">Le guide des aliments, Open Food Facts, ${D.freeRecipeCount} recettes complètes et vos carnets enregistrés restent gratuits. L’atelier propose des idées de cuisine ; il ne prend pas en charge les allergies ou un régime médical.</p></div><div class="plus-offer-panel"><h3>Choisir sa formule</h3>${plusPlans('page')}${billingNote()}${billingCta()}<p class="plus-reassurance">Le pass est payé une seule fois. Le mensuel se résilie depuis votre compte.</p></div></section>
      <section class="plus-faq" aria-labelledby="plus-faq-title"><h2 id="plus-faq-title">Les questions pratiques</h2><details><summary>Qu’est-ce qui est offert ?</summary><p>20 recettes complètes et tous les repères alimentaires restent gratuits. La première semaine composée inclut les préparations de tous les plats proposés, même ceux de Plus, sans carte bancaire. Plus ouvre ensuite les 80 autres recettes à la demande et les nouvelles semaines de menus.</p></details><details><summary>Si un plat ne me plaît pas ?</summary><p>Remplacez-le dans l’atelier. Vous pouvez aussi épingler les plats à conserver avant de demander d’autres idées. Votre première semaine offerte reste modifiable.</p></details><details><summary>Comment récupérer les recettes ?</summary><p>Le carnet se télécharge dans un document HTML qui s’ouvre sans connexion. Il contient le menu, les courses, les ingrédients, les étapes et les précautions. Vous pouvez l’imprimer ou l’enregistrer en PDF depuis votre navigateur.</p></details><details><summary>Et le paiement ?</summary><p>Il s’effectue chez Stripe, après connexion à votre compte. Le mensuel se renouvelle automatiquement ; la résiliation arrête la prochaine échéance. Le pass donne neuf mois d’accès sans renouvellement. Vos factures sont disponibles dans votre compte.</p></details></section></div>`;
  }
  function plusPlannerBanner() {
    return `<section class="plus-planner-banner"><div>${plusStamp()}<h2>Besoin d’idées pour cette semaine ?</h2><p>L’atelier propose des repas et regroupe les courses. Vous pourrez changer les plats avant de les enregistrer.</p></div><div class="plus-banner-actions"><button class="btn btn-outline" data-action="plus-preview">Préparer ma semaine ${icon('arrow', 15)}</button><a class="btn-text" href="#plus">L’offre Plus</a></div></section>`;
  }
  function plannerPage() {
    const dates = weekDates();
    const start = dates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const end = dates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    let count = 0;
    dates.forEach(d => { count += Object.values(store.menus[localDate(d)] || {}).filter(id => recipesById.has(id)).length; });
    return `${heading('Mes menus', 'Choisissez les recettes à prévoir pour chaque jour.')}${plusPlannerBanner()}<div class="planner-top"><div class="week-controls"><a href="${href('menus', { semaine: weekOffset() - 1 })}" class="icon-button" aria-label="Semaine précédente">${icon('chevron', 16).replace('<svg', '<svg class="rotate"')}</a><span>${start} — ${end}</span><a href="${href('menus', { semaine: weekOffset() + 1 })}" class="icon-button" aria-label="Semaine suivante">${icon('chevron', 16)}</a></div><a href="#menus" class="btn btn-outline">Cette semaine</a></div><div class="planner-grid">${dates.map(d => {
      const date = localDate(d);
      return `<section class="planner-day" aria-label="${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}"><div class="day-heading ${date === localDate() ? 'today' : ''}"><span>${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span><b>${d.getDate()}</b></div>${Object.entries(mealLabels).map(([meal, label]) => {
        const r = recipesById.get(store.menus[date]?.[meal]);
        return `<div class="meal-slot"><span class="meal-slot-label">${label}</span>${r ? `<button class="icon-button remove-meal" data-action="remove-meal" data-date="${date}" data-meal="${meal}" aria-label="Retirer ${escape(r.title)} du ${label.toLowerCase()} du ${date}">${icon('close', 12)}</button><button class="planned-recipe" data-action="recipe" data-id="${r.id}"><img src="assets/${r.image}.jpg" alt="" loading="lazy"><b>${r.title}</b></button>` : `<button class="add-meal" data-action="pick-recipe" data-date="${date}" data-meal="${meal}" aria-label="Ajouter le ${label.toLowerCase()} du ${date}">${icon('plus', 18)}Choisir une recette</button>`}</div>`;
      }).join('')}</section>`;
    }).join('')}</div><div class="planner-info"><div><strong>${count ? `${count} repas au programme` : 'Aucun repas prévu cette semaine'}</strong>Les recettes sont prévues pour deux personnes. Ce carnet organise vos envies ; il ne prescrit pas un régime alimentaire.</div><button class="btn btn-primary" data-action="week-shopping" ${!count ? 'disabled' : ''}>${icon('bag', 16)}Préparer mes courses</button></div>`;
  }
  function shoppingPage() {
    const done = store.shopping.filter(i => i.checked).length;
    return `${heading('Ma liste de courses', 'Ajoutez les ingrédients d’une recette ou écrivez votre propre liste.')}${premiumNudge('shopping')}<div class="shopping-layout"><section><form id="shopping-add" class="shopping-add"><label class="sr-only" for="shopping-input">Ajouter un article à la liste</label><input class="text-input" id="shopping-input" name="item" placeholder="Ajouter un article…" maxlength="150" required><button class="btn btn-primary" type="submit">${icon('plus', 16)}Ajouter</button></form><p class="shopping-count" id="shopping-count">${done} sur ${store.shopping.length} article${store.shopping.length > 1 ? 's' : ''} dans votre panier</p>${store.shopping.length ? `<div class="shopping-list">${store.shopping.map(i => `<div class="shopping-item"><input id="item-${escape(i.id)}" type="checkbox" data-shopping-id="${escape(i.id)}" ${i.checked ? 'checked' : ''}><label for="item-${escape(i.id)}">${escape(i.name)}<span>${i.quantity ? `${number(i.quantity)} ${escape(i.unit)}` : ''}</span></label><button class="icon-button" data-action="remove-item" data-id="${escape(i.id)}" aria-label="Supprimer ${escape(i.name)}">${icon('close', 14)}</button></div>`).join('')}</div>` : empty('Votre liste est vide.', 'Ajoutez les ingrédients d’une recette ou de vos menus en un geste.', '<a href="#recettes" class="btn btn-secondary">Trouver une recette ' + icon('arrow', 15) + '</a>', 'bag')}</section><aside class="shopping-aside">${icon('bag', 31)}<h3>Depuis une recette ou un menu</h3><p>Ajoutez les ingrédients depuis une recette ou depuis votre semaine de menus. Les quantités identiques s’additionnent.</p><button class="btn btn-outline" data-action="download-shopping">${icon('download', 15)}Exporter ma liste</button><button class="btn btn-outline" data-action="clear-checked">${icon('check', 15)}Retirer les articles cochés</button><a href="#menus" class="btn-text">Organiser mes menus ${icon('arrow', 15)}</a></aside></div>`;
  }
  function guidePage() {
    const cards = [
      ['drop', 'Un lavage tout en attention.', 'Lavez fruits, légumes et herbes à l’eau potable. Retirez la terre avant de les éplucher ou les couper. Au restaurant, si la préparation est incertaine, préférez les légumes cuits.', 'toxo'],
      ['fire', 'Bien cuit, jusqu’au cœur.', 'Viandes et poissons se mangent entièrement cuits. Pour les œufs, le blanc et le jaune doivent être fermes. Une marinade, un simple réchauffage ou une congélation ne remplace pas une cuisson adaptée.', 'ministry'],
      ['fridge', 'Le froid a son importance.', 'Maintenez le réfrigérateur à 4 °C maximum. Respectez la date limite et les consignes après ouverture. Réfrigérez rapidement les restes et réchauffez-les uniformément.', 'spf'],
      ['milk', 'Tous les fromages sont différents.', 'Les pâtes pressées cuites, sans croûte, sont possibles. Le lait pasteurisé ne suffit pas à rendre compatible un fromage à pâte molle comme le brie. Lisez la fiche de chaque famille.', 'agriculture'],
      ['fish', 'Du poisson, et de la variété.', 'Variez les espèces et limitez les poissons prédateurs comme le thon, même en conserve. Évitez notamment l’espadon et le requin. La cuisson ne retire pas le mercure.', 'ameli'],
      ['cup', 'Un œil sur ce qu’on boit.', 'Le repère est zéro alcool. Pour la caféine, Poum retient la limite EFSA de 200 mg par jour pendant la grossesse, toutes sources additionnées. L’eau potable reste la boisson à privilégier.', 'efsa']
    ];
    return `${heading('Les précautions en cuisine', 'Lavage, cuisson, conservation : les gestes à connaître pendant la grossesse.')}<div class="guide-grid">${cards.map(([symbol, title, text, source]) => `<article class="guide-card"><div class="tip-icon">${icon(symbol, 21)}</div><h2>${title}</h2><p>${text}</p>${sourceLink(source)}</article>`).join('')}</div><section class="faq-section"><h2>Les questions qui reviennent.</h2>${[
      ['Je suis immunisée contre la toxoplasmose. Est-ce que tout change ?', 'L’immunité à la toxoplasmose ne protège pas de la listériose, de la salmonellose ni des contaminants. Les repères de Poum ne relâchent donc pas les autres précautions. Votre sage-femme ou médecin pourra préciser celles qui vous concernent.'],
      ['Pourquoi un produit reste-t-il « À vérifier » ?', 'Open Food Facts est une base collaborative. Le nom, les ingrédients ou la catégorie ne précisent pas toujours la pasteurisation, la cuisson ou la conservation. Une absence d’alerte détectée ne prouve pas la compatibilité d’un produit.'],
      ['Un bon Nutri-Score signifie-t-il que je peux en manger ?', 'Le Nutri-Score renseigne sur la composition nutritionnelle générale. Il ne certifie ni la sécurité microbiologique, ni la cuisson, ni la compatibilité avec la grossesse. Poum ne l’utilise pas pour autoriser un aliment.'],
      ['Ces conseils sont-ils personnalisés pour ma grossesse ?', 'Non. Le guide donne des repères généraux français. Il ne prend pas en charge les allergies, le diabète gestationnel, les traitements ou une situation médicale particulière. Pour les adapter, parlez-en à votre professionnel de santé.'],
      ['J’ai déjà mangé un aliment indiqué « À éviter ».', 'Cette mention ne signifie pas que vous êtes infectée. En cas d’inquiétude, de fièvre ou d’autres symptômes, contactez votre sage-femme ou médecin et précisez l’aliment consommé. Poum ne peut pas évaluer une exposition individuelle.'],
      ['Est-ce que Poum fonctionne sans Internet ?', 'Après une première ouverture depuis un hébergement HTTPS ou localhost, le guide, les recettes et votre carnet sont mis en cache pour une utilisation hors connexion. Une nouvelle recherche Open Food Facts nécessite Internet ; les résultats déjà consultés peuvent rester disponibles en cache pendant 24 heures.']
    ].map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</section><div class="home-footer-note">${icon('book', 23)}<p>Les sources et la méthode sont accessibles à tout moment. <a href="#sources">Voir les références et les limites du guide</a></p></div>`;
  }
  function sourcesPage() {
    return `${heading('Sources & méthode', 'Les références utilisées pour écrire les fiches et les limites du guide.')}<div class="advice-box"><p><strong>Poum est un outil d’information générale.</strong> Les fiches éditoriales sont préparées à partir des recommandations publiques ci-dessous. Elles n’ont pas fait l’objet d’une validation clinique indépendante et ne remplacent pas un avis médical.</p><p>Références consultées le ${D.reviewed}. Pays de référence : France. Les recommandations peuvent évoluer. Les références britanniques et américaines complètent des points identifiés dans les fiches ; le repère caféine retenu est celui de l’EFSA.</p></div><div class="sources-list">${Object.values(D.sources).map(s => `<a class="source-row" href="${s.url}" target="_blank" rel="noopener noreferrer"><div><b>${s.name}</b><span>${s.title}</span></div>${icon('external', 18)}</a>`).join('')}</div><div class="legal-copy"><h3>Deux sources, deux niveaux d’information</h3><p>Le guide local comporte ${D.foods.length} aliments et familles alimentaires avec leurs conditions de préparation. Il n’est pas exhaustif. La recherche de produits interroge la base mondiale Open Food Facts à la demande ; elle ne télécharge pas tous les produits.</p><p>Pour un produit Open Food Facts, des règles repèrent certains termes de la dénomination, des catégories et des ingrédients en français ou en anglais. Les règles sont partielles, peuvent manquer une information ou interpréter un terme à tort. La cuisson réelle, la chaîne du froid, les rappels de lots et la qualité du lavage ne peuvent pas être vérifiés. Aucun produit n’est automatiquement déclaré « Compatible ».</p><h3>Des explications, pas seulement une couleur</h3><p>Chaque fiche précise la forme de l’aliment, le mécanisme du risque ou le motif de compatibilité, ce que change la préparation et les sources correspondantes. La mention « application des recommandations générales » distingue une synthèse pour une famille d’aliments d’un aliment explicitement cité par une autorité.</p><h3>Comprendre les indications</h3>${Object.values(D.statuses).map(s => `<p><strong>${s.label}.</strong> ${s.description}</p>`).join('')}<h3>Recettes et photographie</h3><p>Les ${D.recipes.length} recettes sont des propositions culinaires originales. Les temps de cuisson sont indicatifs ; vérifiez toujours la cuisson complète et les indications du fabricant. Elles ne constituent pas un programme nutritionnel individualisé. Les photos sont des images d’inspiration et peuvent différer du plat décrit.</p><p>Photographies : <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">Unsplash</a>. Les illustrations de la maman à table et du carnet ont été créées avec un outil de génération d’images. Elles sont décoratives. Les scènes des versions précédentes restent archivées. Identité et pictogrammes vectoriels créés pour Poum. Polices DM Sans et Lora sous licence SIL Open Font License.</p><h3>Open Food Facts et réutilisation</h3><p>Les données de produits appartiennent à la base collaborative <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a>, sous <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">licence ODbL</a>. Les contenus individuels sont sous Database Contents License et les images de produits sous CC BY-SA. Chaque fiche contient un lien vers sa source. Ces données sont distinctes du guide Poum.</p></div>`;
  }
  function accountPanel() {
    const state = Cloud.state;
    const statusLabels = { checking: 'Vérification de la connexion…', loading: 'Ouverture de votre carnet…', saving: 'Enregistrement en ligne…', synced: 'Carnet synchronisé', pending: 'Modifications à synchroniser', offline: 'Hors connexion · enregistré sur cet appareil', error: 'Synchronisation à reprendre', conflict: 'Deux versions à rapprocher', local: 'Carnet sur cet appareil', unavailable: 'Connexion au serveur indisponible' };
    const intro = `<div class="account-heading"><span class="account-symbol">${icon('cloud', 25)}</span><div><span class="eyebrow">Connexion & sauvegarde</span><h2>${state.user ? 'Votre compte' : 'Retrouver mon carnet sur un autre appareil'}</h2></div></div>`;
    if (state.user) return `<section class="account-panel">${intro}<p class="account-email">${escape(state.user.email || state.user.name)}</p><p class="cloud-status" role="status">${icon(state.status === 'synced' ? 'check' : 'refresh', 15)}${statusLabels[state.status] || statusLabels.local}</p>${state.error ? `<p class="account-error" role="alert">${escape(state.error)} Votre copie locale est conservée.</p>` : ''}${state.savedAt ? `<p class="small muted">Dernière sauvegarde : ${new Date(state.savedAt).toLocaleString('fr-FR')}</p>` : ''}${state.conflict ? `<div class="sync-conflict"><h3>Le carnet a aussi changé ailleurs.</h3><p>Des modifications concernent les mêmes éléments. Choisissez la version à conserver pour éviter un remplacement automatique.</p><div class="dialog-actions"><button class="btn btn-primary" data-action="resolve-sync" data-choice="local">Garder celle de cet appareil</button><button class="btn btn-outline" data-action="resolve-sync" data-choice="remote">Garder celle en ligne</button></div></div>` : ''}<div class="dialog-actions"><button class="btn btn-primary" data-action="sync-now">${icon('refresh', 15)}Synchroniser</button><button class="btn btn-outline" data-action="sign-out">Se déconnecter</button></div><p class="small muted">Les favoris, les menus, les courses et vos préférences sont liés à ce compte. Les 20 recettes gratuites restent accessibles sans compte.</p><p id="auth-feedback" class="scanner-status" role="status"></p></section>`;
    if (state.configured === false && window.MietteRuntime?.appURL) return `<section class="account-panel">${intro}<p>La version connectée de Poum vous permet de retrouver votre carnet sur vos autres appareils.</p><a class="btn btn-primary" href="${escape(window.MietteRuntime.appURL)}#profil">Ouvrir la version connectée ${icon('arrow', 15)}</a><p class="small muted">Vous pouvez exporter votre carnet ici, puis l’importer dans la nouvelle version.</p></section>`;
    if (state.configured === false) return '';
    if (state.status === 'checking' || state.status === 'unavailable' || state.status === 'offline') return `<section class="account-panel">${intro}<p class="cloud-status" role="status">${statusLabels[state.status]}</p><p class="small muted">Votre carnet local et vos recettes restent accessibles. Une connexion internet est nécessaire pour ouvrir un compte ou synchroniser.</p>${state.status !== 'checking' ? '<button class="btn btn-outline" data-action="cloud-retry">Réessayer la connexion</button>' : ''}</section>`;
    const mode = route.params.get('token') ? 'reset' : authMode;
    const labels = { login: 'Se connecter', signup: 'Créer mon compte', forgot: 'Recevoir le lien de récupération', reset: 'Enregistrer le nouveau mot de passe' };
    return `<section class="account-panel">${intro}<p>Retrouvez vos favoris, vos menus et votre liste de courses sur votre téléphone et votre ordinateur.</p><div class="account-tabs" role="group" aria-label="Connexion ou inscription"><button class="btn ${mode === 'login' ? 'btn-primary' : 'btn-outline'}" data-action="auth-mode" data-mode="login">Se connecter</button><button class="btn ${mode === 'signup' ? 'btn-primary' : 'btn-outline'}" data-action="auth-mode" data-mode="signup">Créer un compte</button></div><form id="auth-form" data-mode="${mode}">
      ${mode === 'signup' ? '<div class="field"><label for="auth-name">Votre prénom ou surnom</label><input class="text-input" id="auth-name" name="name" maxlength="30" autocomplete="given-name" required></div>' : ''}
      ${mode !== 'reset' ? '<div class="field"><label for="auth-email">Adresse e-mail</label><input class="text-input" id="auth-email" name="email" type="email" autocomplete="email" maxlength="254" required></div>' : ''}
      ${mode !== 'forgot' ? `<div class="field"><label for="auth-password">${mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}</label><input class="text-input" id="auth-password" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="${mode === 'login' ? 1 : 10}" maxlength="128" required>${mode !== 'login' ? '<p class="field-hint">Au moins 10 caractères.</p>' : ''}</div>` : '<p class="small muted">Nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>'}
      ${['signup', 'reset'].includes(mode) ? '<div class="field"><label for="auth-confirm">Confirmer le mot de passe</label><input class="text-input" id="auth-confirm" name="confirm" type="password" autocomplete="new-password" maxlength="128" required></div>' : ''}
      ${mode === 'login' || mode === 'signup' ? '<label class="check-label account-import"><input name="import" type="checkbox" checked> Ajouter le carnet de cet appareil à mon compte</label>' : ''}
      <p id="auth-feedback" class="scanner-status" role="status"></p><button class="btn btn-primary" type="submit">${labels[mode]} ${icon('arrow', 15)}</button>${mode === 'login' ? '<button class="btn-text forgot-link" type="button" data-action="auth-mode" data-mode="forgot">Mot de passe oublié ?</button>' : ''}</form><p class="small muted account-note">Le compte est facultatif. <a href="#confidentialite">Comment sont utilisées mes données ?</a></p></section>`;
  }
  function renderAccount(force = false) {
    const panel = $('#account-panel');
    if (!panel || (!force && !authBusy && $('#auth-form')?.contains(document.activeElement))) return;
    panel.innerHTML = accountPanel();
  }
  async function submitAuth(form, data) {
    if (authBusy) return;
    const mode = form.dataset.mode;
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const feedback = $('#auth-feedback');
    if (['signup', 'reset'].includes(mode) && password !== data.get('confirm')) { feedback.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
    authBusy = true;
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    feedback.textContent = 'Connexion en cours…';
    const callbacks = location.origin + location.pathname + '#profil';
    try {
      if (mode === 'forgot') {
        await Cloud.request('auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email, redirectTo: location.origin + location.pathname + '?password-reset=1#profil' }) });
        if ($('#auth-feedback')) $('#auth-feedback').textContent = 'Si cette adresse possède un compte, un e-mail de récupération va arriver. Pensez aux courriers indésirables.';
      } else if (mode === 'reset') {
        await Cloud.request('auth/reset-password', { method: 'POST', body: JSON.stringify({ token: route.params.get('token'), newPassword: password }) });
        authMode = 'login'; go('profil'); toast('Mot de passe mis à jour. Vous pouvez vous connecter.');
      } else {
        await Cloud.request('auth/' + (mode === 'signup' ? 'sign-up/email' : 'sign-in/email'), { method: 'POST', body: JSON.stringify({ email, password, ...(mode === 'signup' ? { name: String(data.get('name')).trim().slice(0, 30) } : {}), ...(mode === 'signup' && location.protocol === 'https:' ? { callbackURL: callbacks } : {}) }) });
        await Cloud.refreshSession(data.get('import') === 'on');
        if (Cloud.state.user) { renderAccount(); toast('Vous êtes connecté·e.', 'heart'); await resumeCommerce(); }
        else { renderAccount(); if ($('#auth-feedback')) $('#auth-feedback').textContent = 'Vérifiez votre boîte e-mail pour confirmer le compte, puis connectez-vous.'; }
      }
    } catch (error) {
      const messages = { INVALID_EMAIL_OR_PASSWORD: 'L’adresse e-mail ou le mot de passe est incorrect.', USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Cette adresse possède déjà un compte. Connectez-vous ou utilisez le lien de récupération.', EMAIL_NOT_VERIFIED: 'Confirmez votre adresse avec le lien reçu par e-mail avant de vous connecter.', INVALID_TOKEN: 'Ce lien a expiré. Demandez un nouveau lien de récupération.', PASSWORD_TOO_SHORT: 'Choisissez un mot de passe d’au moins 10 caractères.', TOO_MANY_REQUESTS: 'Plusieurs tentatives ont été effectuées. Réessayez dans une minute.' };
      if ($('#auth-feedback')) $('#auth-feedback').textContent = messages[error.data?.code] || error.message;
    } finally { authBusy = false; if (button.isConnected) button.disabled = false; }
  }
  function installationPanel() {
    const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<section class="install-panel"><div class="account-heading"><span class="account-symbol">${icon('download', 23)}</span><div><span class="eyebrow">Installer l’application</span><h2>${installed ? 'Poum est installée.' : 'Poum sur votre écran d’accueil.'}</h2></div></div><p>${installed ? 'Retrouvez l’application depuis son icône, comme vos autres applications.' : 'Ouvrez Poum comme une application, avec les aliments du guide et les recettes disponibles hors connexion après leur premier chargement.'}</p>${installPrompt ? `<button class="btn btn-primary" data-action="install">${icon('download', 16)}Installer Poum</button>` : !installed ? '<ol class="install-steps"><li><b>Sur iPhone ou iPad :</b> ouvrez ce site dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».</li><li><b>Sur Android :</b> ouvrez le menu de Chrome, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».</li><li><b>Sur ordinateur :</b> utilisez l’icône d’installation dans la barre d’adresse de Chrome ou Edge, si elle apparaît.</li></ol>' : ''}</section>`;
  }
  function loadScanner() {
    if (window.MietteScanner) return Promise.resolve();
    if (!scannerLoading) scannerLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'js/scanner.js';
      script.onload = resolve;
      script.onerror = () => { scannerLoading = null; script.remove(); reject(new Error('Le lecteur de code-barres ne peut pas être chargé.')); };
      document.head.append(script);
    });
    return scannerLoading;
  }
  async function readBarcodePhoto(file) {
    ++cameraGeneration;
    const status = $('#barcode-error');
    if (!status) return;
    if (file.size > 20000000 || !file.type.startsWith('image/')) { status.textContent = 'Choisissez une photo de moins de 20 Mo.'; return; }
    status.textContent = 'Lecture du code-barres sur votre appareil…';
    try {
      stopCamera(); const currentGeneration = cameraGeneration;
      await loadScanner();
      const code = await window.MietteScanner.image(file);
      if (currentGeneration !== cameraGeneration || dialogContext?.type !== 'scanner') return;
      if (!R.isValidBarcode(code)) throw new Error('invalid');
      $('#detail-dialog').close(); go('aliments', { source: 'off', q: code });
    } catch {
      if (dialogContext?.type === 'scanner') status.textContent = 'Aucun code lisible. Essayez une photo nette, de face, où le code-barres entier est visible, ou saisissez les chiffres.';
    }
  }
  function profilePage() {
    return `${route.params.has('retour') || pendingCheckoutSession ? '<div class="checkout-account-note"><b>Se connecter pour continuer</b><p>Connectez-vous ou créez votre compte pour retrouver votre accès Plus. Aucun paiement n’est effectué sur ce formulaire.</p></div>' : ''}<div id="account-panel">${accountPanel()}</div>${heading('Mes préférences', 'Votre prénom et vos choix de recettes.')}<form id="profile-form" class="profile-panel"><div class="field"><label for="profile-name">Votre prénom ou surnom</label><input class="text-input" id="profile-name" name="name" value="${escape(store.name)}" maxlength="30" placeholder="Comment vous appelle-t-on ?" autocomplete="given-name"><p class="field-hint">Facultatif. Enregistré sur cet appareil et synchronisé si vous êtes connectée.</p></div><div class="field"><label class="check-label" for="profile-vegetarian"><input type="checkbox" id="profile-vegetarian" name="vegetarian" ${store.vegetarian ? 'checked' : ''}> Privilégier les recettes végétariennes</label><p class="field-hint">Ce filtre ne gère pas les allergies ni les besoins médicaux.</p></div><div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', 15)}Enregistrer</button><a class="btn-text" href="#confidentialite">Mes données ${icon('arrow', 15)}</a></div></form>${Billing.state.canManage ? memberPanel() : premiumNudge('home')}${installationPanel()}`;
  }
  async function importNotebook(file) {
    try {
      if (file.size > 2500000) throw new Error('Le fichier est trop volumineux. Choisissez un export Poum.');
      const data = JSON.parse(await file.text());
      const n = data.notebook;
      if (!['Poum', 'Miamama', 'Nidelle', 'Miette'].includes(data.application) || data.version !== 1 || !n || typeof n.name !== 'string' || !Array.isArray(n.favorites) || !Array.isArray(n.shopping) || !n.menus || typeof n.menus !== 'object') throw new Error('Ce fichier n’est pas un export Poum valide.');
      openDialog(`<div class="dialog-content"><h2 id="dialog-title">Importer ce carnet ?</h2><p>${n.favorites.length} favoris, ${n.shopping.length} articles et ${Object.keys(n.menus).length} jours de menus.</p><p class="muted small">Le carnet actuel sera remplacé. Exportez-le d’abord si vous souhaitez en garder une copie.</p><div class="dialog-actions"><button class="btn btn-primary" data-action="confirm-import">Importer le carnet</button><button class="btn btn-outline" data-action="close-dialog">Annuler</button></div></div>`, { type: 'import', notebook: n });
    } catch (error) { toast(error instanceof SyntaxError ? 'Le fichier JSON est illisible.' : error.message, 'info'); }
  }
  function privacyPage() {
    return `${heading('Vos données', 'Ce qui reste sur votre appareil et ce qui est associé à votre compte.')}<div class="profile-panel legal-copy"><h3>Sans compte</h3><p>Votre prénom facultatif, la préférence végétarienne, les favoris, les menus et la liste de courses restent dans le stockage local de ce navigateur. Une copie exportée vous permet de les conserver ou de changer d’appareil.</p><h3>Avec un compte</h3><p>La connexion est gérée par Neon Auth. Les mots de passe sont traités par ce service d’authentification ; ils ne sont pas enregistrés dans le carnet. Votre carnet est sauvegardé dans la base PostgreSQL dédiée à Poum et associé à votre compte. Le serveur vérifie la connexion avant chaque accès au carnet. Vous pouvez vous déconnecter depuis Mon espace.</p><p>Une copie reste sur l’appareil pour continuer hors connexion. Les modifications sont synchronisées au retour du réseau. Si les mêmes éléments ont changé sur deux appareils, Poum vous demande quelle version conserver.</p><h3>Recettes ouvertes</h3><p>Les préparations obtenues avec Plus, pendant la semaine offerte ou au lancement sont conservées sur cet appareil, séparément pour chaque compte, pour les relire hors connexion. Elles ne se synchronisent pas automatiquement. Effacer le carnet efface aussi ces téléchargements.</p><h3>Brouillon de l’atelier</h3><p>Vos envies, préférences culinaires, ingrédients disponibles et propositions de menus sont conservés sur cet appareil, séparément pour chaque compte. Ces choix sont transmis au serveur Poum pour composer une proposition, sans les envoyer à Stripe. Le brouillon complet ne se synchronise pas. Les repas ajoutés au carnet et les articles ajoutés aux courses suivent sa synchronisation habituelle. Effacer le carnet efface aussi ce brouillon.</p><h3>Ce soir et les repas partagés</h3><p>Vos envies culinaires, dîners choisis et courses partagées sont enregistrés dans la base Poum. Sans compte, un cookie fonctionnel aléatoire permet de retrouver cet espace sur ce navigateur pendant un an ; avec un compte, les dîners sont associés à votre compte. Le transfert des dîners préparés sans compte se fait uniquement avec le bouton prévu dans Ce soir.</p><p>Le lien de relais donne accès à un seul repas, ses ingrédients, sa préparation et ses précautions. Toute personne possédant ce lien peut cocher les courses et modifier son état de préparation pendant 30 jours, sauf désactivation anticipée. Il ne donne accès ni à votre nom, ni à votre profil ou aux autres dîners. Seule une empreinte du lien est enregistrée dans la base. Les préférences ne sont transmises à aucun service de génération externe.</p><p>Une copie du dernier dîner reste sur cet appareil pour la consultation hors connexion. Les modifications de courses partagées demandent une connexion. La copie ajoutée au carnet de courses est indépendante du repas partagé. Le fichier « Exporter mon carnet » ne contient pas cet espace séparé. Vous pouvez <a href="#cesoir">effacer vos dîners dans Ce soir</a> ; cela supprime les repas et désactive leurs liens. Le fait que le premier essai a été utilisé est conservé. La suppression du compte efface également ses dîners.</p><h3>Poum Plus et les paiements</h3><p>Si vous achetez Plus, Stripe reçoit votre adresse e-mail, votre nom si vous l’avez renseigné et un identifiant de compte pour associer votre achat. Les informations de carte sont saisies chez Stripe et ne passent pas par Poum. Notre base conserve les références de l’achat, son état et la date de fin d’accès. La date de votre première semaine offerte est associée à votre compte. Vos goûts, vos recherches et votre carnet ne sont pas transmis à Stripe.</p><p>Vous retrouvez vos factures et la résiliation dans Mon espace. La suppression du compte arrête les abonnements Poum actifs et supprime leurs références de notre base ; les factures et données de paiement traitées par Stripe suivent sa <a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer">politique de confidentialité</a>.</p><h3>Recherche de produits et caméra</h3><p>Les noms recherchés et les codes-barres sont transmis au serveur Poum sur Vercel, puis à Open Food Facts. Les fiches publiques peuvent être mises en cache. Les images des produits viennent d’Open Food Facts. Votre carnet et votre adresse e-mail ne lui sont pas transmis.</p><p>Les images de caméra et les photos de codes-barres sont analysées sur votre appareil. Elles ne sont ni envoyées au serveur ni enregistrées dans le carnet. La caméra est arrêtée à la fermeture du scanner. Poum ne contient ni publicité ni mesure d’audience.</p><h3>Exporter ou importer</h3><p>Le fichier JSON contient les préférences, favoris, menus et courses. Il ne contient ni mot de passe ni session de connexion.</p><div class="dialog-actions"><button class="btn btn-secondary" data-action="export-data">${icon('download', 16)}Exporter mon carnet</button><button class="btn btn-outline" data-action="import-data">${icon('upload', 16)}Importer un carnet</button></div><input type="file" id="notebook-file" accept="application/json,.json" hidden><p id="import-status" role="status"></p><h3>Effacer le carnet</h3><p>${Cloud.state.user ? 'Le carnet sera vidé sur cet appareil et dans votre compte lors de la synchronisation. Le compte de connexion restera disponible.' : 'Le carnet et le cache des recherches seront effacés de ce navigateur.'} Vous pouvez exporter une copie avant cette action.</p><button class="btn btn-outline" data-action="reset-data">${icon('trash', 16)}Effacer mon carnet</button>${Cloud.state.user ? '<h3>Supprimer le compte</h3><p>La suppression arrête vos abonnements Poum actifs, puis efface le compte de connexion et son carnet en ligne. Le carnet sans compte de cet appareil reste séparé.</p><button class="btn btn-outline" data-action="delete-account">Supprimer mon compte</button>' : ''}</div>`;
  }
  function renderRoute(keepDialog = false) {
    RecipeAccess.ensure();
    const oldPage = route.page;
    route = getRoute();
    if (keepDialog !== true && $('#detail-dialog').open) $('#detail-dialog').close();
    closeMenu();
    const isOFF = route.page === 'aliments' && route.params.get('source') === 'off';
    if (!isOFF && apiState.loading) {
      apiAbort?.abort(); requestGeneration++; apiState.loading = false; apiState.key = '';
    }
    $('#sidebar').innerHTML = sidebar();
    $('#topbar').innerHTML = topbar();
    const pages = { cesoir: Tonight.render, accueil: homePage, aliments: explorePage, recettes: recipePage, favoris: favoritesPage, menus: plannerPage, courses: shoppingPage, guide: guidePage, sources: sourcesPage, profil: profilePage, confidentialite: privacyPage, plus: plusPage, atelier: Workshop.render };
    $('#main').innerHTML = `<div class="page-content">${pages[route.page]()}</div>${footer()}`;
    syncSidebar();
    Tonight.enter();
    document.title = route.page === 'accueil' ? 'Que peut-on manger enceinte ? Aliments et recettes | Poum' : `${labels[route.page]} — Poum`;
    if (oldPage !== route.page) window.scrollTo({ top: 0, behavior: 'instant' });
    if (isOFF) {
      const q = route.params.get('q') || '';
      if (!q) { apiAbort?.abort(); requestGeneration++; apiState = { key: '', products: [], loading: false, error: '', count: 0 }; }
      else if (q !== apiState.key || (apiState.error && !apiState.products.length)) searchAPI();
    }
  }
  function rerender(keepDialog = false) { const y = window.scrollY; renderRoute(keepDialog); window.scrollTo({ top: y, behavior: 'instant' }); }
  function replaceNotebook(notebook, { preserveEdits = false } = {}) {
    const active = document.activeElement;
    const form = preserveEdits && active?.matches('input,textarea,select') && active.closest('#profile-form,#shopping-add,#home-search,#explore-search,#recipe-search,#workshop-form');
    const draft = form ? [...form.querySelectorAll('input[id]:not([type="file"]),select[id],textarea[id]')].map(input => ({ id: input.id, value: input.value, checked: input.checked })) : [];
    const focus = form ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
    productMap.clear(); store = readStore(notebook); rerender(preserveEdits);
    for (const saved of draft) { const input = document.getElementById(saved.id); if (input) { input.value = saved.value; input.checked = saved.checked; } }
    if (focus) { const input = document.getElementById(focus.id); input?.focus({ preventScroll: true }); if (input && typeof focus.start === 'number') input.setSelectionRange(focus.start, focus.end); }
    if ($('#detail-dialog').open) document.body.style.overflow = 'hidden';
  }
  function openDialog(content, context) {
    stopCamera();
    const dialog = $('#detail-dialog');
    // Keep the live region in the modal's top layer, including when its contents refresh.
    const notifications = $('#toasts');
    if (!dialog.open) lastDialogTrigger = document.activeElement;
    dialogContext = context;
    dialog.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="Fermer la fiche" autofocus>${icon('close', 19)}</button>${content}`;
    dialog.append(notifications);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function foodDetail(id) {
    const f = foodsById.get(id) || productMap.get(id);
    if (!f) { toast('Cette fiche n’est plus disponible.', 'info'); return; }
    const isOFF = f.origin === 'off';
    const related = D.recipes.filter(r => r.foods.includes(id)).slice(0, 2);
    const top = `<div class="dialog-food-top"><div class="dialog-food-art">${isOFF && f.image_front_small_url ? `<img src="${escape(f.image_front_small_url)}" alt="${escape(f.name)}" referrerpolicy="no-referrer">` : art(f.art)}</div><div class="dialog-food-heading"><span class="eyebrow">${isOFF ? 'PRODUIT OPEN FOOD FACTS' : 'LE GUIDE POUM'}</span><h2 id="dialog-title">${escape(f.name)}</h2>${badge(f.status)}<p>${escape(isOFF ? [f.brands, f.quantity].filter(Boolean).join(' · ') : f.summary)}</p></div></div>`;
    let body;
    if (isOFF) {
      const a = f.analysis;
      const nutrition = [['energy-kcal_100g', 'Énergie', 'kcal'], ['fat_100g', 'Matières grasses', 'g'], ['sugars_100g', 'Sucres', 'g'], ['proteins_100g', 'Protéines', 'g'], ['fiber_100g', 'Fibres', 'g'], ['salt_100g', 'Sel', 'g']].filter(([key]) => Number.isFinite(f.nutriments[key]));
      body = `<div class="advice-box ${f.status}"><p><strong>Cette fiche ne certifie pas la compatibilité avec la grossesse.</strong></p><p>${escape(a.reason)} Les informations sont collaboratives et peuvent être incomplètes. Lisez l’étiquette et demandez conseil en cas de doute.</p></div>${a.missing.length ? `<p class="missing-data">${icon('info', 14)} ${a.missing.map(escape).join(' · ')}</p>` : ''}<h3>${a.flags.length ? 'Les points à vérifier' : 'Pas de précaution reconnue automatiquement'}</h3>${a.flags.length ? a.flags.map(productFlag).join('') : '<p class="ingredient-text">L’absence de signal détecté ne prouve pas l’absence de risque. Vérifiez la préparation, le traitement thermique, la conservation et la liste complète des ingrédients.</p>'}<div class="product-unknowns"><h3>Ce que la fiche ne peut pas confirmer</h3><ul>${a.unknowns.map(t => `<li>${escape(t)}</li>`).join('')}</ul><p>Les termes ci-dessus sont normalisés pour la détection ; ils ne remplacent pas le texte de l’étiquette.</p></div>${sourceFooter(a.sources)}<h3>Les ingrédients renseignés</h3><p class="ingredient-text">${escape(f.ingredients_text_fr || f.ingredients_text || 'La liste des ingrédients n’est pas renseignée. Consultez l’emballage.')}</p><p class="allergens"><strong>Allergènes déclarés :</strong> ${f.allergens_tags.length ? escape(f.allergens_tags.map(t => t.replace(/^\w{2}:/, '')).join(', ')) : 'Non renseignés — cela ne signifie pas qu’il n’y en a pas.'} Vérifiez l’étiquette.</p>${nutrition.length ? `<h3>Valeurs déclarées pour 100 g / 100 ml</h3><div class="nutrition-grid">${nutrition.map(([k, label, unit]) => `<div class="nutrition-item"><b>${number(f.nutriments[k])} ${unit}</b><span>${label}</span></div>`).join('')}</div><p class="dialog-disclaimer">Ces valeurs nutritionnelles ne déterminent pas la sécurité du produit pendant la grossesse.</p>` : ''}<div class="sources-inline"><p>CODE-BARRES : ${escape(f.code)} · DONNÉES COLLABORATIVES ODBL</p><a class="source-link" href="https://world.openfoodfacts.org/product/${encodeURIComponent(f.code)}" target="_blank" rel="noopener noreferrer">Voir la fiche originale Open Food Facts ${icon('external', 13)}</a></div>`;
    } else {
      body = `<p><a class="btn btn-outline" href="${seoURL(window.PoumRoutes.food(f))}">Lire et partager la fiche complète</a></p>${foodExplanation(f)}<h3>${icon('recipe', 17)} Dans votre cuisine</h3><ul class="preparation-list">${f.preparation.map(t => `<li>${icon('check', 17)}<span>${escape(t)}</span></li>`).join('')}</ul>${related.length ? `<h3>Et si on le cuisinait ?</h3><div class="mini-recipes">${related.map(r => `<button class="mini-recipe" data-action="recipe" data-id="${r.id}"><img src="assets/${r.image}.jpg" alt=""><span>${r.title}</span></button>`).join('')}</div>` : ''}${sourceFooter(f.sources)}`;
    }
    openDialog(`<div class="dialog-content">${top}${body}<div class="dialog-actions"><button class="btn btn-secondary" data-action="favorite" data-kind="food" data-id="${escape(id)}">${icon('heart', 16)}${favorite('food', id) ? 'Retirer des favoris' : 'Garder dans mes favoris'}</button>${!isOFF ? `<button class="btn btn-outline" data-action="find-product" data-query="${escape(f.name)}">${icon('scan', 16)}Chercher un produit</button>` : ''}</div><p class="dialog-disclaimer">Repères généraux. La conservation, la préparation, vos allergies et votre situation personnelle restent à prendre en compte. Un doute ? Votre sage-femme ou médecin peut vous aider.</p></div>`, { type: 'food', id });
  }
  function recipePreview(r, message, loading = false) {
    openDialog(`<img class="dialog-recipe-photo" src="assets/${r.image}.jpg" alt="Photo d’inspiration culinaire"><div class="dialog-content"><span class="eyebrow">Recette Plus · ${r.time} minutes</span><h2 id="dialog-title">${escape(r.title)}</h2><section class="recipe-paywall"><h3>${loading ? 'Ouverture de la préparation…' : 'Cette recette fait partie de Plus'}</h3><p role="status">${escape(message)}</p>${loading ? '' : `<p>Les 80 recettes Plus, les menus automatiques et leurs courses : <b>4,90 €/mois</b> ou <b>29,90 € pour 9 mois</b>.</p><button class="btn btn-primary" data-action="plus-offer">Découvrir l’accès Plus</button><button class="btn-text" data-action="recipe" data-id="${r.id}">Déjà abonnée ? Réessayer l’ouverture</button><a class="btn-text" href="${window.MietteRuntime?.cloud === false ? escape(window.MietteRuntime.appURL) : ''}#profil">Me connecter à mon compte</a>`}</section><h3>Les ingrédients</h3><ul class="ingredients-list">${r.ingredients.map(i => `<li>${escape(i.name)}<b>${number(i.quantity)} ${escape(i.unit)}</b></li>`).join('')}</ul><p class="allergens"><strong>Allergènes :</strong> ${escape(r.allergens)}</p><div class="advice-box"><strong>Pendant la grossesse</strong><p>${escape(r.safety)}</p></div>${sourceFooter(r.sources || ['spf', 'toxo'])}<p class="small muted">Les ingrédients, allergènes, précautions et sources restent accessibles gratuitement. Plus donne accès aux étapes de préparation.</p></div>`, { type: loading ? 'recipe-loading' : 'recipe-preview', id: r.id });
  }
  async function recipeDetail(id, servings = 2) {
    RecipeAccess.ensure();
    const r = recipesById.get(id); if (!r) return;
    if (!r.steps.length) {
      recipePreview(r, 'Vérification de votre accès à cette recette.', true);
      const context = dialogContext;
      try { await RecipeAccess.load(id); }
      catch (error) { if (dialogContext === context && $('#detail-dialog').open) recipePreview(r, error.message); return; }
      if (dialogContext !== context || !$('#detail-dialog').open) return;
    }
    renderRecipeDetail(id, servings);
  }
  function renderRecipeDetail(id, servings = 2) {
    const r = recipesById.get(id); if (!r) return;
    const portions = Math.max(1, Math.min(8, servings));
    openDialog(`<img class="dialog-recipe-photo" src="assets/${r.image}.jpg" alt="Photo d’inspiration culinaire"><div class="dialog-content"><span class="eyebrow">La recette</span><h2 id="dialog-title">${r.title}</h2><div class="dialog-recipe-meta"><span>${icon('clock', 15)}${r.time} minutes</span><span>${icon('users', 15)}${portions} personne${portions > 1 ? 's' : ''}</span><span>${icon(r.vegetarian ? 'leaf' : 'recipe', 15)}${r.tags[0]}</span></div><div class="servings-control"><h3>Ingrédients</h3><div class="stepper"><button data-action="servings" data-delta="-1" aria-label="Réduire le nombre de portions" ${portions === 1 ? 'disabled' : ''}>${icon('minus', 13)}</button><span aria-live="polite">${portions} pers.</span><button data-action="servings" data-delta="1" aria-label="Augmenter le nombre de portions" ${portions === 8 ? 'disabled' : ''}>${icon('plus', 13)}</button></div></div><ul class="ingredients-list">${r.ingredients.map(i => `<li>${i.name}<b>${number(i.quantity * portions / r.servings)} ${i.unit}</b></li>`).join('')}</ul><p class="allergens"><strong>Allergènes :</strong> ${r.allergens}</p>${portions !== r.servings ? `<p class="portion-note">Quantités ajustées pour ${portions} personne${portions > 1 ? 's' : ''}. Adaptez aussi le nombre de moules et de fournées : les étapes décrivent la recette de base pour ${r.servings} personnes.</p>` : ''}<h3>Préparation</h3><ol class="steps-list">${r.steps.map(t => `<li>${escape(t)}</li>`).join('')}</ol><div class="advice-box">${icon('shield', 16)} <strong>Pendant la grossesse</strong><p>${r.safety}</p></div><div class="dialog-actions"><button class="btn btn-primary" data-action="recipe-shopping" data-id="${r.id}" data-servings="${portions}">${icon('bag', 16)}Ajouter à mes courses</button><button class="btn btn-outline" data-action="plan-recipe" data-id="${r.id}">${icon('calendar', 16)}Au menu</button><button class="btn btn-outline" data-action="favorite" data-kind="recipe" data-id="${r.id}">${icon('heart', 16)}${favorite('recipe', r.id) ? 'Retirer' : 'Garder'}</button></div><p class="dialog-disclaimer">Temps de cuisson indicatifs. Suivez les ingrédients écrits, les précautions et vos consignes médicales. Les photos illustrent une idée de plat.</p>${sourceFooter(r.sources || ['spf', 'toxo'])}${premiumNudge('recipe')}</div>`, { type: 'recipe', id, servings: portions });
  }
  function toggleFavorite(kind, id) {
    if (!['food', 'recipe'].includes(kind)) return;
    if (kind === 'food' && !foodsById.has(id) && !productMap.has(id)) return;
    if (kind === 'recipe' && !recipesById.has(id)) return;
    const key = kind + ':' + id;
    const active = favorite(kind, id);
    store.favorites = active ? store.favorites.filter(f => f !== key) : [...store.favorites, key];
    persist();
    document.querySelectorAll('[data-action="favorite"]').forEach(btn => {
      if (btn.dataset.kind !== kind || btn.dataset.id !== id) return;
      if (btn.classList.contains('favorite-button')) {
        btn.classList.toggle('is-favorite', !active);
        btn.setAttribute('aria-pressed', String(!active));
        btn.setAttribute('aria-label', active ? 'Ajouter aux favoris' : 'Retirer des favoris');
      } else btn.innerHTML = icon('heart', 16) + (active ? 'Garder dans mes favoris' : 'Retirer des favoris');
    });
    $('#sidebar').innerHTML = sidebar();
    if (route.page === 'favoris' && !$('#detail-dialog').open) rerender();
    toast(active ? 'Retiré des favoris.' : 'Ajouté aux favoris.', 'heart');
  }
  function pickRecipe(date, meal) {
    const recipes = store.vegetarian ? D.recipes.filter(r => r.vegetarian) : D.recipes;
    openDialog(`<div class="dialog-content"><span class="eyebrow">MON MENU</span><h2 id="dialog-title">Une envie pour ${meal === 'dinner' ? 'le dîner' : 'le déjeuner'} ?</h2><p class="muted small">${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · recettes pour deux personnes</p><div class="picker-search field"><label for="picker-query">Trouver un plat ou un ingrédient</label><input class="text-input" id="picker-query" type="search" maxlength="100" placeholder="Curry, gnocchis, poulet…"></div><p id="picker-count" class="muted small" role="status">${recipes.length} recettes à choisir</p><div class="picker-list">${recipes.map(r => `<button class="picker-recipe" data-action="assign-recipe" data-id="${r.id}" data-date="${date}" data-meal="${meal}"><img src="assets/${r.image}.jpg" alt="" loading="lazy" width="68" height="52"><div><b>${r.title}</b><span>${r.time} min · ${r.vegetarian ? 'Végétarien' : 'Viande ou poisson'}</span></div>${icon('plus', 17)}</button>`).join('')}</div></div>`, { type: 'picker' });
  }
  function planRecipe(id) {
    const r = recipesById.get(id); if (!r) return;
    openDialog(`<div class="dialog-content"><span class="eyebrow">Ajouter à mes menus</span><h2 id="dialog-title">On le cuisine quand ?</h2><p class="muted small">${r.title} · menu pour deux personnes</p><form id="plan-recipe-form" data-id="${r.id}"><div class="picker-fields"><div class="field"><label for="meal-date">Le jour</label><input class="text-input" id="meal-date" type="date" name="date" value="${localDate()}" required></div><div class="field"><label for="meal-type">Le repas</label><select class="text-input" id="meal-type" name="meal"><option value="lunch">Déjeuner</option><option value="dinner">Dîner</option></select></div></div><p id="meal-replace-note" class="muted small">${store.menus[localDate()]?.lunch ? 'Un repas est déjà prévu à cette date. Il sera remplacé.' : 'Le repas sera ajouté à votre carnet de menus.'}</p><button class="btn btn-primary" type="submit" style="margin-top:18px">${icon('calendar', 16)}Ajouter à mon menu</button></form></div>`, { type: 'plan', id });
  }
  function assignRecipe(id, date, meal) {
    if (!recipesById.has(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Object.hasOwn(mealLabels, meal)) return;
    if (!store.menus[date]) store.menus[date] = {};
    store.menus[date][meal] = id;
    persist(); $('#detail-dialog').close();
    if (route.page === 'menus') rerender();
    toast('Une bonne idée ajoutée à votre menu.', 'calendar');
  }
  function addIngredients(recipes) {
    let count = 0;
    recipes.forEach(({ recipe, servings }) => recipe.ingredients.forEach(i => {
      const amount = Number((i.quantity * servings / recipe.servings).toFixed(2));
      const key = R.normalize(i.name) + '|' + i.unit;
      const existing = store.shopping.find(item => !item.checked && R.normalize(item.name) + '|' + item.unit === key);
      if (existing) existing.quantity = Number((existing.quantity + amount).toFixed(2));
      else store.shopping.push({ id: uniqueId(), name: i.name, quantity: amount, unit: i.unit, checked: false });
      count++;
    }));
    persist(); toast(`${count} ingrédients ajoutés à votre liste de courses.`, 'bag');
  }
  function uniqueId() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function downloadFile(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function toast(message, symbol = 'check') {
    const div = document.createElement('div'); div.className = 'toast'; div.innerHTML = icon(symbol, 17) + '<span>' + escape(message) + '</span>';
    $('#toasts').append(div);
    setTimeout(() => div.remove(), 4600);
  }
  function closeMenu() {
    $('#sidebar')?.classList.remove('is-open'); $('.mobile-overlay')?.classList.remove('is-open');
    $('[data-action="menu"]')?.setAttribute('aria-expanded', 'false');
    if (!$('#detail-dialog')?.open) document.body.style.overflow = '';
    syncSidebar();
  }
  function syncSidebar() {
    const sidebar = $('#sidebar'); if (!sidebar) return;
    const hidden = window.matchMedia('(max-width:760px)').matches && !sidebar.classList.contains('is-open');
    sidebar.inert = hidden;
    sidebar.setAttribute('aria-hidden', String(hidden));
  }
  function scannerDialog() {
    const capable = Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
    openDialog(`<div class="dialog-content"><span class="eyebrow">Recherche de produit</span><h2 id="dialog-title">Scanner un code-barres</h2><p class="muted small">Saisissez les chiffres de l’emballage pour retrouver sa fiche Open Food Facts.</p><form id="barcode-form" class="barcode-form"><label class="sr-only" for="barcode-input">Code-barres à 8, 12, 13 ou 14 chiffres</label><input class="text-input" id="barcode-input" name="code" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="Ex. 3017620422003" required><button class="btn btn-primary" type="submit">Rechercher ${icon('arrow', 15)}</button></form><p id="barcode-error" class="scanner-status" role="alert"></p><input type="file" id="barcode-photo" accept="image/*" hidden><button class="btn btn-outline" data-action="barcode-photo">${icon('camera', 16)}Lire une photo du code-barres</button>${capable ? `<div class="scanner-view" id="scanner-view" hidden></div><button class="btn btn-secondary" data-action="start-camera">${icon('camera', 16)}Utiliser la caméra</button><p class="scanner-status" id="camera-status">La caméra reste sur votre appareil. Aucune image n’est transmise.</p>` : `<div class="off-note" style="margin-top:23px">${icon('info', 17)}<p>La lecture caméra n’est pas disponible dans ce navigateur. La saisie du code-barres fonctionne toujours. Vous pouvez lire une photo du code-barres ou ouvrir Poum dans le navigateur de votre téléphone.</p></div>`}</div>`, { type: 'scanner' });
  }
  function stopCamera() {
    cameraGeneration++;
    scannerControls?.stop(); scannerControls = null;
    if (cameraTimer) clearTimeout(cameraTimer);
    cameraTimer = null;
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    // ZXing can attach a stream before its camera() promise returns the controls.
    const video = $('#scanner-video');
    if (video) { video.srcObject?.getTracks().forEach(t => t.stop()); video.srcObject = null; }
  }
  async function startCamera() {
    const generation = ++cameraGeneration;
    const button = $('[data-action="start-camera"]');
    const status = $('#camera-status');
    if (!button || !status) return;
    button.disabled = true; status.textContent = 'Ouverture de la caméra…';
    try {
      const supported = typeof window.BarcodeDetector?.getSupportedFormats === 'function' ? await BarcodeDetector.getSupportedFormats().catch(() => []) : [];
      if (!supported.includes('ean_13')) {
        await loadScanner();
        if (generation !== cameraGeneration || dialogContext?.type !== 'scanner') return;
        const view = $('#scanner-view'); view.hidden = false;
        view.innerHTML = '<video id="scanner-video" autoplay muted playsinline></video><div class="scanner-frame"></div>';
        const video = $('#scanner-video');
        const controls = await window.MietteScanner.camera(video, (code, control) => {
          if (generation !== cameraGeneration || !R.isValidBarcode(code)) return;
          control.stop(); stopCamera(); $('#detail-dialog').close(); go('aliments', { source: 'off', q: code });
        });
        if (generation !== cameraGeneration) { controls.stop(); return; }
        scannerControls = controls; cameraStream = video.srcObject;
        status.textContent = 'Placez le code-barres dans le cadre, avec suffisamment de lumière.';
        button.innerHTML = icon('camera', 16) + 'Caméra active';
        return;
      }
      const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'].filter(f => supported.includes(f));
      if (!formats.length) throw new Error('formats');
      const detector = new BarcodeDetector({ formats });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (generation !== cameraGeneration || !$('#detail-dialog').open || dialogContext?.type !== 'scanner') { stream.getTracks().forEach(t => t.stop()); return; }
      cameraStream = stream;
      const view = $('#scanner-view'); view.hidden = false;
      view.innerHTML = '<video id="scanner-video" autoplay muted playsinline></video><div class="scanner-frame"></div>';
      const video = $('#scanner-video'); video.srcObject = stream; await video.play();
      status.textContent = 'Placez le code-barres dans le cadre, avec suffisamment de lumière.';
      button.innerHTML = icon('camera', 16) + 'Caméra active';
      const scan = async () => {
        if (generation !== cameraGeneration) return;
        try {
          const codes = await detector.detect(video);
          if (generation !== cameraGeneration) return;
          const code = codes.find(c => R.isValidBarcode(c.rawValue));
          if (code) { stopCamera(); $('#detail-dialog').close(); go('aliments', { source: 'off', q: code.rawValue }); return; }
        } catch (_) { /* A frame can be unavailable while the camera is focusing. */ }
        if (generation === cameraGeneration) cameraTimer = setTimeout(scan, 450);
      };
      scan();
    } catch (err) {
      if (generation !== cameraGeneration) return;
      stopCamera();
      if ($('#camera-status')) $('#camera-status').textContent = err.name === 'NotAllowedError' ? 'L’accès à la caméra a été refusé. Vous pouvez saisir le code-barres ci-dessus.' : 'La caméra ou la lecture des codes n’est pas disponible. Saisissez le code-barres ci-dessus.';
      button.disabled = false; button.innerHTML = icon('camera', 16) + 'Réessayer la caméra';
    }
  }

  document.addEventListener('click', event => {
    if (Tonight.statusClick(event)) return;
    const trigger = event.target.closest('[data-action]');
    if (!trigger || trigger.disabled) return;
    const { action, id, kind } = trigger.dataset;
    const params = Object.fromEntries(route.params);
    if (Tonight.click(trigger) || Workshop.click(trigger)) return;
    switch (action) {
      case 'food': foodDetail(id); break;
      case 'recipe': recipeDetail(id); break;
      case 'favorite': toggleFavorite(kind, id); break;
      case 'close-dialog': $('#detail-dialog').close(); break;
      case 'menu': $('#sidebar').classList.add('is-open'); $('.mobile-overlay').classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); syncSidebar(); document.body.style.overflow = 'hidden'; $('.sidebar-close').focus(); break;
      case 'close-menu': closeMenu(); $('[data-action="menu"]')?.focus(); break;
      case 'category': go('aliments', { ...params, categorie: trigger.dataset.category, famille: null, afficher: null }); break;
      case 'food-family': go('aliments', { ...params, famille: trigger.dataset.family, afficher: null }); break;
      case 'more-foods': {
        const shown = document.querySelectorAll('#food-results .food-card').length;
        route.params.set('afficher', String(shown + 48));
        history.replaceState(null, '', href('aliments', Object.fromEntries(route.params)));
        $('#food-results').innerHTML = guideResults();
        document.querySelectorAll('#food-results .food-card-open')[shown]?.focus({ preventScroll: true });
        break;
      }
      case 'status': go('aliments', { ...params, statut: trigger.dataset.filter, afficher: null }); break;
      case 'recipe-access-filter': updateRecipeFilters({ acces: trigger.dataset.access }); break;
      case 'recipe-type': updateRecipeFilters({ type: trigger.dataset.type }); break;
      case 'recipe-collection': updateRecipeFilters({ collection: trigger.dataset.collection }); break;
      case 'vegetarian': updateRecipeFilters({ vegetarien: recipeSettings().vegetarian ? '0' : '1' }); break;
      case 'reset-recipes': go('recettes', { vegetarien: '0' }); break;
      case 'more-recipes': {
        const shown = document.querySelectorAll('#recipe-results .recipe-card').length;
        route.params.set('page', String(Math.floor(shown / recipePageSize) + 1));
        history.replaceState(null, '', href('recettes', Object.fromEntries(route.params)));
        $('#recipe-results').innerHTML = recipeResults();
        document.querySelectorAll('#recipe-results .recipe-card-open')[shown]?.focus({ preventScroll: true });
        break;
      }
      case 'find-product': $('#detail-dialog').close(); go('aliments', { source: 'off', q: trigger.dataset.query }); break;
      case 'retry-api': searchAPI(Boolean(apiState.products.length)); break;
      case 'more-products': searchAPI(true); break;
      case 'scan': scannerDialog(); break;
      case 'start-camera': startCamera(); break;
      case 'barcode-photo': $('#barcode-photo')?.click(); break;
      case 'servings': if (dialogContext?.type === 'recipe') { const scroll = $('#detail-dialog').scrollTop; const delta = Number(trigger.dataset.delta); recipeDetail(dialogContext.id, dialogContext.servings + delta); $('#detail-dialog').scrollTop = scroll; $(`[data-action="servings"][data-delta="${delta}"]`)?.focus({ preventScroll: true }); } break;
      case 'recipe-shopping': { const recipe = recipesById.get(id); if (recipe) addIngredients([{ recipe, servings: Number(trigger.dataset.servings) || 2 }]); break; }
      case 'plan-recipe': planRecipe(id); break;
      case 'plus-offer': plusOffer(); break;
      case 'plus-example': Workshop.example(); go('atelier'); break;
      case 'billing-checkout': startCheckout(); break;
      case 'billing-portal': billingPortal(); break;
      case 'billing-refresh': Billing.refresh(); break;
      case 'billing-restore': Billing.action('refresh').then(() => { billingMessage = Billing.active ? 'Votre accès Plus est à jour.' : 'Aucun accès actif confirmé pour le moment.'; rerender(true); }).catch(error => toast(error.message, 'info')); break;
      case 'plus-preview': go('atelier', { semaine: weekOffset() || null }); break;
      case 'pick-recipe': pickRecipe(trigger.dataset.date, trigger.dataset.meal); break;
      case 'assign-recipe': assignRecipe(id, trigger.dataset.date, trigger.dataset.meal); break;
      case 'remove-meal': if (store.menus[trigger.dataset.date]) { delete store.menus[trigger.dataset.date][trigger.dataset.meal]; persist(); rerender(); toast('Le créneau est de nouveau libre.', 'calendar'); } break;
      case 'week-shopping': { const recipes = weekDates().flatMap(d => Object.values(store.menus[localDate(d)] || {}).map(rid => recipesById.get(rid)).filter(Boolean)).map(recipe => ({ recipe, servings: recipe.servings })); if (recipes.length) { addIngredients(recipes); go('courses'); } break; }
      case 'remove-item': store.shopping = store.shopping.filter(i => i.id !== id); persist(); rerender(); break;
      case 'clear-checked': { const count = store.shopping.filter(i => i.checked).length; store.shopping = store.shopping.filter(i => !i.checked); persist(); rerender(); toast(count ? `${count} articles cochés retirés.` : 'Aucun article n’est encore coché.', 'bag'); break; }
      case 'download-shopping': if (!store.shopping.length) { toast('Ajoutez quelques articles avant d’exporter.', 'info'); break; } downloadFile('poum-mes-courses.txt', 'POUM — MA LISTE DE COURSES\n\n' + store.shopping.map(i => `[${i.checked ? 'x' : ' '}] ${i.name}${i.quantity ? ` — ${number(i.quantity)} ${i.unit}` : ''}`).join('\n'), 'text/plain;charset=utf-8'); toast('Votre liste est prête à emporter.', 'download'); break;
      case 'import-data': $('#notebook-file')?.click(); break;
      case 'transfer-notebook': transferNotebook(); break;
      case 'confirm-import': { const imported = dialogContext?.notebook; if (imported) { store = readStore(imported); persist(); $('#detail-dialog').close(); rerender(); toast('Le carnet a été importé.', 'check'); } break; }
      case 'export-data': downloadFile('poum-mon-carnet.json', JSON.stringify({ application: 'Poum', version: 1, exportedAt: new Date().toISOString(), notebook: store }, null, 2), 'application/json'); toast('Votre carnet a été exporté.', 'download'); break;
      case 'reset-data': openDialog('<div class="dialog-content"><h2 id="dialog-title">Effacer votre carnet ?</h2><p class="muted small">Votre prénom, vos favoris, vos menus et vos courses seront effacés. Si vous êtes connectée, le carnet vide sera aussi synchronisé avec votre compte. Vous pouvez exporter votre carnet avant cette action.</p><div class="dialog-actions"><button class="btn btn-outline" data-action="close-dialog">Garder mon carnet</button><button class="btn btn-primary" data-action="confirm-reset">Effacer les données</button></div></div>', { type: 'reset' }); break;
      case 'confirm-reset': store = { name: '', vegetarian: false, favorites: [], products: [], menus: {}, shopping: [] }; Workshop.clear(); RecipeAccess.clear(); productMap.clear(); persist(); API.clearCache(); apiState = { key: '', products: [], loading: false, count: 0 }; $('#detail-dialog').close(); rerender(); toast('Votre carnet a été effacé de ce navigateur.', 'check'); break;
      case 'auth-mode': authMode = trigger.dataset.mode; if (route.params.has('token')) go('profil'); else renderAccount(true); break;
      case 'delete-account': openDialog('<div class="dialog-content"><h2 id="dialog-title">Supprimer votre compte ?</h2><p>Votre compte, ses sessions et son carnet en ligne seront supprimés définitivement. Les abonnements Poum associés seront arrêtés pour éviter de nouveaux prélèvements. Vous pouvez exporter le carnet avant de continuer.</p><form id="delete-account-form"><div class="field"><label for="delete-password">Confirmer avec votre mot de passe</label><input class="text-input" id="delete-password" name="password" type="password" autocomplete="current-password" required maxlength="128"></div><p id="delete-feedback" role="alert"></p><div class="dialog-actions"><button type="button" class="btn btn-outline" data-action="close-dialog">Annuler</button><button type="submit" class="btn btn-primary">Supprimer définitivement mon compte</button></div></form></div>', { type: 'delete-account' }); break;
      case 'cloud-retry': Cloud.retry(); break;
      case 'sync-now': Cloud.sync(); break;
      case 'resolve-sync': Cloud.resolve(trigger.dataset.choice); break;
      case 'sign-out': Cloud.signOut().catch(error => toast(error.message, 'info')); break;
      case 'install': if (installPrompt) { installPrompt.prompt(); installPrompt.userChoice.finally(() => { installPrompt = null; if (route.page === 'profil') rerender(); }); } break;
    }
  });
  document.addEventListener('submit', event => {
    if (Tonight.submit(event)) return;
    const form = event.target;
    const data = new FormData(form);
    const known = ['home-search', 'explore-search', 'recipe-search', 'shopping-add', 'profile-form', 'plan-recipe-form', 'barcode-form', 'auth-form', 'delete-account-form', 'workshop-form'];
    if (!known.includes(form.id)) return;
    event.preventDefault();
    if (form.id === 'workshop-form') { Workshop.submit(form); return; }
    if (form.id === 'delete-account-form') {
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      const dinnerOwner = Cloud.storageKey;
      Cloud.deleteAccount(String(data.get('password'))).then(() => { Tonight.forget(dinnerOwner); $('#detail-dialog').close(); toast('Votre compte et son carnet en ligne ont été supprimés.', 'check'); }).catch(error => { if ($('#delete-feedback')) $('#delete-feedback').textContent = error.message; }).finally(() => { button.disabled = false; });
      return;
    }
    if (form.id === 'auth-form') { submitAuth(form, data); return; }
    if (form.id === 'home-search' || form.id === 'explore-search') {
      const q = String(data.get('q') || '').trim();
      const numeric = /^\d[\d\s-]+$/.test(q);
      const terms = R.normalize(q).split(' ').filter(Boolean);
      const knownFood = D.foods.some(f => terms.every(term => R.normalize(f.name + ' ' + f.aliases).split(/[^a-z0-9]+/).some(word => word.startsWith(term))));
      const source = numeric || (form.id === 'home-search' && !knownFood && q.length > 1) || (form.id === 'explore-search' && route.params.get('source') === 'off') ? 'off' : 'guide';
      go('aliments', { ...(form.id === 'explore-search' ? Object.fromEntries(route.params) : {}), q, source });
    } else if (form.id === 'recipe-search') updateRecipeFilters({ q: String(data.get('q') || '').trim() });
    else if (form.id === 'shopping-add') {
      const name = String(data.get('item') || '').trim(); if (!name) return;
      store.shopping.push({ id: uniqueId(), name: name.slice(0, 150), quantity: 0, unit: '', checked: false }); persist(); rerender(); $('#shopping-input')?.focus();
    } else if (form.id === 'profile-form') {
      store.name = String(data.get('name') || '').trim().slice(0, 30); store.vegetarian = data.get('vegetarian') === 'on';
      persist(); rerender(); toast('Votre espace est à votre image.', 'leaf');
    } else if (form.id === 'plan-recipe-form') assignRecipe(form.dataset.id, String(data.get('date')), String(data.get('meal')));
    else if (form.id === 'barcode-form') {
      const q = String(data.get('code') || '').replace(/[\s-]/g, '');
      if (!R.isValidBarcode(q)) { $('#barcode-error').textContent = 'Vérifiez les chiffres : un code valide comporte 8, 12, 13 ou 14 chiffres et une clé de contrôle correcte.'; $('#barcode-input').focus(); return; }
      $('#detail-dialog').close(); go('aliments', { source: 'off', q });
    }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'recipe-query') updateRecipeFilters({ q: event.target.value.trim() });
    if (event.target.id === 'picker-query') {
      const query = R.normalize(event.target.value);
      let count = 0;
      document.querySelectorAll('.picker-recipe').forEach(button => {
        const match = recipeMatches(recipesById.get(button.dataset.id), query);
        button.hidden = !match;
        if (match) count++;
      });
      $('#picker-count').textContent = count ? `${count} recette${count > 1 ? 's' : ''} à choisir` : 'Aucune recette : essayez un autre ingrédient.';
    }
    if (event.target.id === 'explore-search-input' && route.params.get('source') !== 'off') {
      const value = event.target.value.trim();
      route.params.delete('afficher');
      if (value) route.params.set('q', value); else route.params.delete('q');
      history.replaceState(null, '', href('aliments', Object.fromEntries(route.params)));
      $('#food-results').innerHTML = guideResults();
    }
  });
  document.addEventListener('change', event => {
    if (Tonight.change(event)) return;
    if (event.target.matches('[data-plus-plan]') && Plus.offer.plans.some(p => p.id === event.target.value)) {
      plusPlan = event.target.value;
      document.querySelectorAll('[data-plus-plan]').forEach(input => { input.checked = input.value === plusPlan; });
      document.querySelectorAll('[data-plus-terms]').forEach(el => { el.innerHTML = plusTerms(); });
      document.querySelectorAll('[data-billing-cta]').forEach(el => { el.outerHTML = billingCta(); });
    }
    if (Workshop.change(event)) return;
    if (event.target.id === 'notebook-file' && event.target.files[0]) importNotebook(event.target.files[0]);
    if (event.target.id === 'barcode-photo' && event.target.files[0]) readBarcodePhoto(event.target.files[0]);
    if (event.target.id === 'recipe-duration') updateRecipeFilters({ duree: Number(event.target.value) || null });
    if (event.target.id === 'recipe-sort') updateRecipeFilters({ tri: event.target.value });
    if (event.target.matches('[data-shopping-id]')) {
      const item = store.shopping.find(i => i.id === event.target.dataset.shoppingId);
      if (item) { item.checked = event.target.checked; persist(); $('#shopping-count').textContent = `${store.shopping.filter(i => i.checked).length} sur ${store.shopping.length} articles dans votre panier`; }
    }
    if (event.target.id === 'meal-date' || event.target.id === 'meal-type') {
      const date = $('#meal-date').value; const meal = $('#meal-type').value;
      $('#meal-replace-note').textContent = store.menus[date]?.[meal] ? 'Un repas est déjà prévu à cette date. Il sera remplacé.' : 'Le repas sera ajouté à votre carnet de menus.';
    }
  });
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.classList.contains('product-image')) {
      event.target.parentElement.innerHTML = art('bowl');
    }
  }, true);
  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#sidebar')?.classList.contains('is-open')) { closeMenu(); $('[data-action="menu"]')?.focus(); }
    if (event.key === 'Tab' && $('#sidebar')?.classList.contains('is-open')) {
      const focusables = [...$('#sidebar').querySelectorAll('button,a[href]')].filter(el => el.getClientRects().length);
      const first = focusables[0], last = focusables.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'k' && !$('#detail-dialog').open) { event.preventDefault(); if (!$('#explore-search-input') && !$('#home-search-input')) go('aliments'); else ($('#explore-search-input') || $('#home-search-input')).focus(); }
  });
  function updateOnline() {
    const el = $('#connection-status');
    el.innerHTML = navigator.onLine ? '' : `<div class="offline-banner">${icon('offline', 14)}Vous êtes hors connexion. Le guide et votre carnet restent à vos côtés.</div>`;
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (route.page === 'profil') rerender(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dialogContext?.type === 'scanner') { stopCamera(); if ($('#camera-status')) $('#camera-status').textContent = 'Caméra mise en pause. Fermez et rouvrez le scanner pour reprendre.'; } });
  window.addEventListener('pagehide', stopCamera);
  window.matchMedia('(max-width:760px)').addEventListener('change', () => { closeMenu(); syncSidebar(); });
  $('#app').innerHTML = `<aside id="sidebar" class="sidebar"></aside><button class="mobile-overlay" data-action="close-menu" aria-label="Fermer le menu" tabindex="-1"></button><div class="app-shell"><header id="topbar" class="topbar"></header><div id="connection-status" aria-live="polite"></div>${migrationNote()}${!storageAvailable ? '<div class="storage-notice">Le stockage local n’est pas disponible. Votre carnet restera dans cet onglet jusqu’à sa fermeture.</div>' : ''}<main id="main" class="main" tabindex="-1"></main></div>`;
  const dialog = $('#detail-dialog');
  dialog.addEventListener('close', () => {
    document.body.append($('#toasts'));
    stopCamera(); dialogContext = null; document.body.style.overflow = '';
    if (lastDialogTrigger?.isConnected) lastDialogTrigger.focus({ preventScroll: true });
    if (route.page === 'favoris') { const y = window.scrollY; $('#main').innerHTML = `<div class="page-content">${favoritesPage()}</div>${footer()}`; window.scrollTo({ top: y, behavior: 'instant' }); }
  });
  dialog.addEventListener('click', e => { if (e.target === dialog) { const box = dialog.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close(); } });
  const resetToken = new URLSearchParams(location.search).get('token');
  if (resetToken && new URLSearchParams(location.search).has('password-reset')) {
    history.replaceState(null, '', location.pathname + href('profil', { token: resetToken })); route = getRoute();
  }
  const returnParams = new URLSearchParams(location.search);
  try { const saved = JSON.parse(sessionStorage.getItem('miamama-checkout-return') || 'null'); if (saved && saved.expires > Date.now()) pendingCheckoutSession = saved.session; } catch {}
  if (returnParams.get('checkout') === 'success') {
    const incoming = returnParams.get('session_id');
    if (/^cs_(?:test_|live_)?[a-zA-Z0-9_]{10,240}$/.test(incoming || '')) { pendingCheckoutSession = incoming; try { sessionStorage.setItem('miamama-checkout-return', JSON.stringify({ session: incoming, expires: Date.now() + 3600000 })); } catch {} }
    billingMessage = 'Connectez-vous au compte utilisé pour vérifier et retrouver votre achat.';
  } else if (returnParams.get('checkout') === 'cancelled') billingMessage = 'Le paiement a été interrompu. Votre carnet est toujours là.';
  if (pendingCheckoutSession && !billingMessage) billingMessage = 'Connectez-vous au compte utilisé pour retrouver votre achat.';
  const returningPortal = returnParams.get('billing') === 'updated';
  if (returnParams.has('checkout') || returningPortal) history.replaceState(null, '', location.pathname + location.hash);
  renderRoute(); updateOnline();
  window.addEventListener('miette:cloud', () => { Tonight.enter(); renderAccount(); if ($('#topbar')) $('#topbar').innerHTML = topbar(); });
  window.addEventListener('miamama:billing', () => {
    Tonight.enter();
    document.querySelectorAll('[data-premium-place]').forEach(el => { el.outerHTML = premiumNudge(el.dataset.premiumPlace); });
    if ($('#topbar')) $('#topbar').innerHTML = topbar();
    if (['plus', 'atelier', 'profil'].includes(route.page) && !authBusy) replaceNotebook(store, { preserveEdits: true });
  });
  Cloud?.init({ read: () => store, replace: replaceNotebook }).then(async () => {
    receiveTransfer(); await Billing.init();
    if (pendingCheckoutSession && Cloud.state.user) await resumeCommerce();
    if (returningPortal && Cloud.state.user) Billing.action('refresh').catch(error => toast(error.message, 'info'));
    if (route.params.has('acheter') && Plus.offer.plans.some(p => p.id === route.params.get('acheter'))) { plusPlan = route.params.get('acheter'); await startCheckout(); }
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* The application also works without installation. */ }));
  }
})();
