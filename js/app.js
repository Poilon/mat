(() => {
  'use strict';
  const D = window.MietteData;
  const R = window.MietteRules;
  const API = window.MietteAPI;
  const Cloud = window.MietteCloud;
  const Plus = window.MiettePlus;
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
  const labels = { accueil: 'Mon quotidien', aliments: 'Explorer les aliments', recettes: 'Idées de recettes', favoris: 'Mes favoris', menus: 'Mes menus', courses: 'Ma liste de courses', guide: 'Les bons repères', sources: 'Sources & méthode', profil: 'Mon espace', confidentialite: 'Mes données', plus: 'Nidelle Plus' };
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
  let plusDraft = null;

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
    return `<section class="food-explanation" aria-labelledby="why-title"><h3 id="why-title">Pourquoi ce repère ?</h3><div class="advice-box ${f.status}"><p>${escape(e.why)}</p></div>${citations(e.sources)}<div class="evidence-mechanism"><h3>${escape(p.title)}</h3><p>${escape(p.mechanism)}</p>${citations(p.sources)}</div><div class="evidence-condition"><h3>Ce qui change la réponse</h3><p>${escape(p.condition)}</p>${e.note ? `<p class="evidence-note"><strong>Le repère en pratique.</strong> ${escape(e.note)}</p>` : ''}</div><p class="evidence-basis">${e.basis === 'specific' ? 'Synthèse Nidelle : cet aliment, ce type de produit ou cette préparation est cité dans les références.' : 'Application par Nidelle des recommandations générales à cette famille d’aliments ; les sources ne citent pas nécessairement cet aliment individuellement.'}</p></section>`;
  }
  function productFlag(flag) {
    const e = flag.explanation;
    return `<section class="risk-flag"><h4>${icon(D.statuses[flag.status].icon, 15)}${escape(flag.title)}</h4><p>${escape(flag.text)}</p><ul class="signal-trace" aria-label="Informations ayant déclenché ce signal">${flag.matches.map(m => `<li><b>${escape(m.label)}</b> : <span>${escape(m.term)}</span></li>`).join('')}</ul><details class="signal-explanation"><summary>Pourquoi cette précaution ?</summary><p>${escape(e.mechanism)}</p><p>${escape(e.condition)}</p>${citations(flag.sources)}</details></section>`;
  }
  function illustratedIntro(title, text, imageName = 'pregnancy-foods') {
    return `<section class="illustrated-intro"><div><span class="eyebrow">VOTRE GROSSESSE, À VOTRE RYTHME</span><h2>${title}</h2><p>${text}</p></div><img src="assets/brand/${imageName}.webp" alt="" width="700" height="700"></section>`;
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
      <div class="recipe-photo"><img src="assets/${r.image}.jpg" alt="" loading="lazy"><span class="recipe-time">${icon('clock', 12)} ${r.time} min</span></div>
      <div class="recipe-card-content"><h3>${r.title}</h3>${route.page === 'recettes' ? `<p class="recipe-intro">${r.subtitle}</p>` : ''}<div class="recipe-tags"><span>${icon(r.vegetarian ? 'leaf' : 'recipe', 12)}${r.tags[0]}</span><span>${r.tags[1]}</span></div></div>
    </button></article>`;
  }
  function heading(title, subtitle, extra = '') { return `<div class="page-heading subpage-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${extra}</div>`; }
  function empty(title, description, link = '', iconName = 'leaf') { return `<div class="empty-state">${['favoris', 'menus', 'courses'].includes(route.page) ? '<img class="empty-illustration" src="assets/brand/pregnancy-notebook.webp" alt="" width="700" height="700">' : icon(iconName, 38)}<h2>${title}</h2><p>${description}</p>${link}</div>`; }

  function sidebar() {
    const links = [['accueil', 'home', 'Mon quotidien'], ['aliments', 'search', 'Explorer les aliments'], ['recettes', 'recipe', 'Idées de recettes']];
    const notebook = [['favoris', 'heart', 'Mes favoris'], ['menus', 'calendar', 'Mes menus'], ['courses', 'bag', 'Ma liste de courses']];
    const nav = ([page, symbol, label]) => `<a href="#${page}" class="nav-link ${route.page === page ? 'active' : ''}" ${route.page === page ? 'aria-current="page"' : ''}>${icon(symbol, 18)}<span>${label}</span>${page === 'favoris' && store.favorites.length ? `<span class="nav-count">${store.favorites.length}</span>` : ''}</a>`;
    return `<button class="icon-button sidebar-close" data-action="close-menu" aria-label="Fermer le menu">${icon('close')}</button>
      <a class="brand" href="#accueil" aria-label="Nidelle, accueil"><img src="assets/brand/mark.svg" alt="" width="37" height="37"><span class="wordmark">nidelle</span></a><p class="brand-tagline">Votre assiette & votre grossesse.</p>
      <nav aria-label="Navigation principale"><p class="nav-label">AU QUOTIDIEN</p>${links.map(nav).join('')}<p class="nav-label secondary">MON PETIT CARNET</p>${notebook.map(nav).join('')}<p class="nav-label secondary">POUR M’ACCOMPAGNER</p>${nav(['guide', 'book', 'Les bons repères'])}${nav(['plus', 'sparkle', 'Découvrir Nidelle Plus'])}</nav>
      <div class="sidebar-bottom"><div class="sidebar-note"><img src="assets/brand/pregnancy-notebook.webp" alt="" width="700" height="700"><h3>Un jour à la fois.</h3><p>Des petits repères,<br>pour ces grands mois.</p></div><a class="sidebar-help" href="#sources">${icon('shield', 14)}Des repères, en toute transparence</a></div>`;
  }
  function topbar() {
    return `<button class="mobile-menu" data-action="menu" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="sidebar">${icon('menu', 22)}</button><div class="breadcrumb">${icon('leaf', 16)}<span>Nidelle</span>${icon('chevron', 11)}<b>${labels[route.page]}</b></div><div class="topbar-right"><span class="topbar-note">${icon('heart', 13)}À vos côtés pendant la grossesse</span><a href="#profil" class="profile-trigger" aria-label="Mon compte et mes préférences"><span class="avatar">${escape(store.name ? store.name.charAt(0).toUpperCase() : 'N')}</span><span>${escape(store.name || (Cloud.state.user ? 'Mon compte' : 'Se connecter'))}</span>${icon('down', 13)}</a></div>`;
  }
  function footer() {
    return `<footer class="footer"><span><span class="footer-brand">nidelle</span> &nbsp; Votre assiette & votre grossesse <span class="footer-heart">♡</span></span><div class="footer-links"><a href="#plus">Nidelle Plus</a><a href="#sources">Sources & méthode</a><a href="#confidentialite">Vos données</a><span>© 2026 Nidelle</span></div></footer>`;
  }
  function migrationNote() {
    const runtime = window.MietteRuntime;
    if (runtime?.cloud !== false || !runtime.appURL) return '';
    return `<aside class="migration-note"><div><b>Nidelle a une nouvelle maison.</b><p>Compte, carnet synchronisé et scan photo : retrouvez la version connectée.</p></div><div class="dialog-actions"><a class="btn btn-primary" href="${escape(runtime.appURL)}">Ouvrir l’application ${icon('arrow', 15)}</a><button class="btn btn-outline" data-action="transfer-notebook">Transférer mon carnet</button></div></aside>`;
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
    return `<form id="${id}" class="search-box" role="search">${icon('search', 21)}<label class="sr-only" for="${id}-input">${source === 'off' ? 'Nom, marque ou code-barres du produit' : 'Rechercher un aliment'}</label><input id="${id}-input" name="q" type="search" placeholder="${source === 'off' ? 'Un produit, une marque ou un code-barres…' : 'Un aliment, une envie, une petite question…'}" value="${escape(value)}" maxlength="150" autocomplete="off"><button type="button" class="search-scan" data-action="scan" aria-label="Rechercher par code-barres" title="Rechercher par code-barres">${icon('scan', 20)}</button><button class="btn btn-primary" type="submit">Rechercher ${icon('arrow', 15)}</button></form>`;
  }
  function homePage() {
    const featuredRecipes = recipeHighlights.map(id => recipesById.get(id)).filter(r => !store.vegetarian || r.vegetarian).slice(0, 3);
    return `<div class="page-heading"><div><h1>${store.name ? `Bonjour ${escape(store.name)},` : 'Bonjour, vous.'} ${icon('sun', 23)}</h1><p>Une nouvelle journée pour prendre soin de vous, et de bébé.</p></div><span class="heading-pill">${icon('leaf', 13)} À votre rythme, à chaque trimestre</span></div>
      <section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><span class="eyebrow">${icon('sparkle', 13)} VOTRE COMPAGNON DE GROSSESSE</span><h2 id="hero-title">Bien dans l’assiette.<br><em>Bien dans votre grossesse.</em></h2><p>Une envie, un doute, une petite faim ? Des repères sourcés et des recettes gourmandes pour prendre soin de vous, un repas après l’autre.</p><div class="hero-actions"><a class="btn btn-primary" href="#aliments">Explorer les aliments ${icon('arrow', 16)}</a><a class="btn-text" href="#recettes">En cuisine ${icon('chevron', 13)}</a></div></div><div class="hero-visual"><img class="pregnancy-hero" src="assets/brand/pregnancy-hero.webp" alt="Illustration d’une femme enceinte prenant un moment pour elle à table" fetchpriority="high" width="1000" height="1000"><div class="hero-badge"><div class="badge-icon">${icon('heart', 19)}</div><div><b>Pour vous, et le petit cœur qui grandit.</b><span>De la douceur, sans pression.</span></div></div></div></section>
      <div class="trust-row"><span>${icon('shield', 13)}Recommandations publiques citées</span><span>${icon('globe', 13)}Recherche Open Food Facts</span><span>${icon('lock', 13)}Votre carnet, avec ou sans compte</span></div>
      <section aria-labelledby="search-title"><div class="section-heading"><div><h2 id="search-title">Et ça, je peux en manger ?</h2><p>Les bons repères, à portée de fourchette.</p></div><a href="#aliments" class="btn-text">Tout explorer ${icon('arrow', 15)}</a></div>${searchForm('home-search')}<div class="suggestions"><span>Une petite envie de…</span>${['Patate douce', 'Ananas', 'Mozzarella', 'Café'].map(q => `<a class="suggestion" href="${href('aliments', { q })}">${q}</a>`).join('')}</div>
      <div class="home-content-grid"><div><div class="popular-heading"><h3>Souvent dans vos assiettes</h3><span>Le guide Nidelle</span></div><div class="food-grid">${D.foods.slice(0, 4).map(foodCard).join('')}</div></div><div class="tip-card"><div class="tip-icon">${icon('leaf', 20)}</div><div class="tip-text"><p class="eyebrow">LE PETIT REPÈRE DU JOUR</p><h3>Le cru, ça se prépare.</h3><p>Fruits, légumes, herbes fraîches : un lavage soigneux à l’eau potable, même avant de les éplucher.</p></div><a href="#guide" class="btn-text">Les bons gestes ${icon('arrow', 13)}</a></div></div></section>
      <section class="recipes-section" aria-labelledby="recipes-title"><div class="section-heading"><div><h2 id="recipes-title">Un peu d’inspiration au menu</h2><p>${D.recipes.length} recettes, des petits matins aux grandes envies.</p></div><a class="btn-text" href="#recettes">Toutes les recettes ${icon('arrow', 15)}</a></div><div class="recipe-grid">${featuredRecipes.map(recipeCard).join('')}</div></section>
      <div class="home-footer-note">${icon('heart', 25)}<p>Chaque grossesse est unique. Nidelle vous donne des repères généraux ; votre sage-femme ou médecin vous accompagne personnellement. <a href="#sources">Comprendre nos conseils</a></p></div>`;
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
    return `${heading('Et ça, enceinte, je peux ?', 'Des explications pour comprendre, des gestes simples pour cuisiner.')}${illustratedIntro('Vos envies ont leur place.', `${D.foods.length} fiches, dont ${D.foods.filter(f => f.category === 'produce').length} fruits, légumes et herbes. Pourquoi c’est compatible, à limiter ou à éviter : chaque repère est expliqué et sourcé.`)}
      <div class="tabs" role="group" aria-label="Source de la recherche"><a href="${href('aliments', { q, source: 'guide' })}" class="tab ${source === 'guide' ? 'active' : ''}" ${source === 'guide' ? 'aria-current="true"' : ''}>${icon('leaf', 16)}Le guide des aliments</a><a href="${href('aliments', { q, source: 'off' })}" class="tab ${source === 'off' ? 'active' : ''}" ${source === 'off' ? 'aria-current="true"' : ''}>${icon('scan', 16)}Les produits en rayon</a></div>
      ${searchForm('explore-search', q, source)}
      ${source === 'guide' ? `<div class="category-list" role="group" aria-label="Catégorie d’aliments">${D.categories.map(c => `<button class="category-chip ${(route.params.get('categorie') || 'all') === c.id ? 'active' : ''}" data-action="category" data-category="${c.id}" aria-pressed="${(route.params.get('categorie') || 'all') === c.id}">${icon(c.icon, 16)}${c.label}</button>`).join('')}</div>${familyFilters()}<div class="filter-row" role="group" aria-label="Filtrer les précautions"><span class="filter-label">Afficher :</span>${[['all', 'Tous'], ...Object.entries(D.statuses).map(([k, v]) => [k, v.label])].map(([id, label]) => `<button class="filter-chip ${(route.params.get('statut') || 'all') === id ? 'active' : ''}" data-action="status" data-filter="${id}" aria-pressed="${(route.params.get('statut') || 'all') === id}">${label}</button>`).join('')}</div><div id="food-results" aria-live="polite">${guideResults()}</div><div class="legend">${icon('info', 15)}<span><b>Compatible</b> signifie « dans les conditions de préparation indiquées ». Ouvrez la fiche pour les connaître.</span></div>` : `<div class="suggestions"><span>Recherche par nom, marque ou code-barres · Sur validation uniquement</span></div><div class="off-note">${icon('info', 19)}<p>Les fiches <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a> sont collaboratives. Nidelle repère certaines précautions, mais ne peut pas certifier qu’un produit convient à la grossesse. Vérifiez toujours l’emballage.</p></div><div id="off-results" aria-live="polite" aria-busy="${apiState.loading}">${offResults()}</div>`}`;
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
      q: R.normalize(route.params.get('q') || '').trim()
    };
  }
  function recipeMatches(recipe, query) {
    const text = R.normalize(recipe.title + ' ' + recipe.ingredients.map(i => i.name).join(' '));
    return query.split(/\s+/).filter(Boolean).every(word => text.includes(word));
  }
  function filteredRecipes() {
    const s = recipeSettings();
    return D.recipes.filter(r => (!s.vegetarian || r.vegetarian) && (s.type === 'all' || r.type === s.type) && (s.collection === 'all' || r.collection === s.collection) && (!s.duration || r.time <= s.duration) && recipeMatches(r, s.q))
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
    return `<div class="recipes-page"><section class="recipe-welcome" aria-labelledby="recipe-welcome-title"><div><span class="eyebrow">LE GRAND CARNET GOURMAND</span><h1 id="recipe-welcome-title">${D.recipes.length} façons<br>de se <em>régaler.</em></h1><p>Des brunchs qui donnent envie de se lever, des dîners à partager et une petite place pour le dessert.</p><span class="recipe-welcome-note">${icon('shield', 15)}Les précautions grossesse dans chaque fiche</span></div><div class="recipe-welcome-photos" aria-hidden="true"><img src="assets/recipes/tacos.jpg" alt="" width="760" height="530"><img src="assets/recipes/pancakes.jpg" alt="" width="760" height="530"><span>${icon('heart', 19)} Fait maison, avec amour.</span></div></section>
      <section class="recipe-collection-section" aria-labelledby="collections-title"><div class="section-heading"><div><h2 id="collections-title">De quoi avez-vous envie ?</h2><p>${D.recipeCollections.length} collections pour trouver l’inspiration.</p></div><button class="btn-text" data-action="recipe-collection" data-collection="all" aria-pressed="${s.collection === 'all'}">Tout explorer ${icon('arrow', 15)}</button></div><div class="recipe-collections" role="group" aria-label="Collections de recettes">${D.recipeCollections.map(c => `<button class="recipe-collection ${s.collection === c.id ? 'active' : ''}" data-action="recipe-collection" data-collection="${c.id}" aria-pressed="${s.collection === c.id}"><img src="assets/${c.image}.jpg" alt="" loading="lazy" width="180" height="120"><span><b>${c.label}</b><small>${D.recipes.filter(r => r.collection === c.id).length} recettes ${icon('arrow', 12)}</small></span></button>`).join('')}</div></section>
      <form id="recipe-search" class="search-box" role="search">${icon('search', 20)}<label class="sr-only" for="recipe-query">Rechercher une recette ou un ingrédient</label><input id="recipe-query" name="q" type="search" maxlength="100" value="${escape(route.params.get('q') || '')}" placeholder="Un ingrédient, un plat… chocolat, tacos, courgette"><button class="btn btn-primary" type="submit">Rechercher ${icon('arrow', 15)}</button></form>
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
    return `${heading('Vos petits coups de cœur.', 'Les aliments et les recettes que vous voulez retrouver, tout simplement.')}${!foods.length && !recipes.length ? empty('Votre carnet n’attend que vous.', 'Touchez le petit cœur sur une fiche aliment ou une recette pour la retrouver ici.', '<a class="btn btn-primary" href="#aliments">Explorer les aliments ' + icon('arrow', 16) + '</a>', 'heart') : `${foods.length ? `<div class="section-heading"><h2>Mes aliments <span class="muted small">(${foods.length})</span></h2></div><div class="food-grid explore-grid">${foods.map(foodCard).join('')}</div>` : ''}${recipes.length ? `<section class="recipes-section"><div class="section-heading"><h2>Mes recettes <span class="muted small">(${recipes.length})</span></h2></div><div class="recipe-grid">${recipes.map(recipeCard).join('')}</div></section>` : ''}`}`;
  }
  function plusStamp() { return `<span class="plus-stamp">${icon('sparkle', 14)}nidelle <b>plus</b></span>`; }
  function plusPrice(plan) { return (plan.cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }); }
  function plusTerms() {
    const plan = Plus.offer.plans.find(p => p.id === plusPlan);
    return `<strong>${plusPrice(plan)} ${plan.cadence}.</strong> ${escape(plan.terms)}`;
  }
  function plusPlans(prefix) {
    return `<fieldset class="plus-plans"><legend>Les formules prévues au lancement</legend>${Plus.offer.plans.map(plan => `<label class="plus-plan" for="${prefix}-${plan.id}"><input id="${prefix}-${plan.id}" type="radio" name="plus-plan-${prefix}" value="${plan.id}" data-plus-plan ${plusPlan === plan.id ? 'checked' : ''}><span class="plus-plan-copy"><span class="plus-plan-name">${plan.name}${plan.id === 'pass' ? '<small>Un seul paiement</small>' : ''}</span><span class="plus-price">${plusPrice(plan)} <small>${plan.cadence}</small></span><span class="plus-plan-caption">${plan.id === 'pass' ? '9 mois pour prendre le temps' : 'Pour la durée qui vous convient'}</span></span></label>`).join('')}</fieldset><p class="plus-terms" data-plus-terms aria-live="polite">${plusTerms()}</p>`;
  }
  function plusLaunchNote() {
    return '<p class="plus-launch-note"><strong>Offre en préparation.</strong> Ces tarifs sont proposés pour le lancement. Les abonnements et les paiements ne sont pas encore ouverts.</p>';
  }
  function plusOffer() {
    openDialog(`<div class="dialog-content plus-dialog"><div class="plus-dialog-intro"><div>${plusStamp()}<h2 id="dialog-title">Votre semaine,<br>déjà imaginée.</h2></div><img src="assets/brand/pregnancy-notebook.webp" alt="" width="700" height="700"></div><p class="plus-lead">Avec Nidelle Plus, nous préparons la composition de 7 jours de menus : des idées pour vos déjeuners et dîners, selon vos envies et votre temps.</p><ul class="plus-benefits"><li>${icon('calendar', 17)}14 repas proposés en une fois</li><li>${icon('leaf', 17)}Option végétarienne et durée au choix</li><li>${icon('refresh', 17)}D’autres idées quand vos envies changent</li></ul>${plusPlans('dialog')}${plusLaunchNote()}<button class="btn btn-primary plus-cta" data-action="plus-preview">Tester 2 jours gratuitement ${icon('arrow', 16)}</button><p class="plus-reassurance">Sans carte bancaire · Sans compte · Aucun engagement</p><button class="btn-text plus-dismiss" data-action="close-dialog">Continuer avec mon carnet gratuit</button><p class="plus-free-note">Les ${D.foods.length} fiches sourcées, les ${D.recipes.length} recettes et les menus composés à la main restent gratuits.</p></div>`, { type: 'plus-offer' });
  }
  function plusPage() {
    return `<section class="plus-page"><div class="plus-hero"><div class="plus-hero-copy">${plusStamp()}<h1>Un peu moins à prévoir.<br>Un peu plus à savourer.</h1><p>Pendant la grossesse, il y a déjà beaucoup à penser. Nidelle Plus se prépare à vous aider avec la question de tous les jours : « Qu’est-ce qu’on mange ? »</p><img src="assets/brand/pregnancy-notebook.webp" alt="Une femme enceinte prend un moment pour écrire dans son carnet." width="700" height="700"><span class="plus-handnote">De la place pour vous, aussi.</span></div><section class="plus-offer-panel" aria-labelledby="plus-offer-title"><span class="eyebrow">BIENTÔT DANS VOTRE CARNET</span><h2 id="plus-offer-title">Une semaine d’idées,<br>en quelques gestes.</h2><p class="plus-lead">7 jours, 14 repas et vos préférences : végétarien ou non, cuisine rapide ou plus tranquille.</p>${plusPlans('page')}${plusLaunchNote()}<button class="btn btn-primary plus-cta" data-action="plus-preview">Tester 2 jours gratuitement ${icon('arrow', 16)}</button><p class="plus-reassurance">Sans carte bancaire · Sans compte · Aucun engagement</p></section></div><div class="plus-comparison"><section><span class="eyebrow">NIDELLE · GRATUIT</span><h2>Les repères, pour toutes.</h2><p>Tout ce qui vous aide à comprendre votre assiette reste accessible.</p><ul class="plus-benefits"><li>${icon('check', 16)}${D.foods.length} aliments, leurs précautions et leurs sources</li><li>${icon('check', 16)}Recherche de produits et scan Open Food Facts</li><li>${icon('check', 16)}Les ${D.recipes.length} recettes, avec leurs étapes et précautions</li><li>${icon('check', 16)}Favoris, menus manuels, courses et synchronisation</li><li>${icon('check', 16)}Aperçu automatique de 2 jours, disponible maintenant</li></ul><a href="#menus" class="btn-text">Ouvrir mon carnet gratuit ${icon('arrow', 15)}</a></section><section class="plus-future"><span class="eyebrow">NIDELLE PLUS · EN PRÉPARATION</span><h2>Moins de menus à imaginer.</h2><p>L’offre payante portera sur le temps gagné pour organiser vos repas.</p><ul class="plus-benefits"><li>${icon('sparkle', 16)}Composer automatiquement 7 jours de déjeuners et dîners</li><li>${icon('sparkle', 16)}Tenir compte de votre temps et de l’option végétarienne</li><li>${icon('sparkle', 16)}Remplacer une idée et renouveler toute la proposition</li><li>${icon('sparkle', 16)}Ajouter les repas au carnet puis préparer les courses</li></ul><p class="plus-free-note">Vos menus enregistrés resteront accessibles après la fin de l’offre.</p></section></div><section class="plus-faq" aria-labelledby="plus-faq-title"><h2 id="plus-faq-title">Quelques petits repères.</h2><details><summary>Est-ce que l’aperçu gratuit m’engage à payer ?</summary><p>Non. Vous pouvez générer quatre idées de repas et les ajouter à votre carnet. Aucune carte bancaire n’est demandée et aucun abonnement ne commence. L’offre payante n’est pas encore ouverte.</p></details><details><summary>Pourquoi deux formules ?</summary><p>Le pass propose neuf mois en un seul paiement, sans renouvellement automatique. La formule mensuelle est prévue pour une durée plus courte, avec un renouvellement chaque mois et une résiliation avant la prochaine échéance. Les conditions définitives seront présentées avant toute ouverture des paiements.</p></details><details><summary>Est-ce un programme nutritionnel personnalisé ?</summary><p>Ce sont des idées parmi les recettes Nidelle, pour deux personnes. Elles ne couvrent pas les allergies, le diabète gestationnel ou vos besoins nutritionnels individuels. Les ingrédients, allergènes et précautions de chaque recette restent consultables gratuitement.</p></details></section></section>`;
  }
  function plusPlannerBanner() {
    return `<section class="plus-planner-banner"><div>${plusStamp()}<h2>Et si les menus se préparaient tout seuls ?</h2><p>Découvrez deux jours d’idées gratuites. La semaine automatique de Nidelle Plus est en préparation.</p><div class="plus-banner-actions"><button class="btn btn-primary" data-action="plus-preview">Essayer 2 jours ${icon('arrow', 15)}</button><button class="btn btn-outline" data-action="plus-offer">${icon('sparkle', 15)}Composer 7 jours · Plus</button></div></div><img src="assets/brand/pregnancy-notebook.webp" alt="" width="700" height="700"></section>`;
  }
  function plusPreviewDialog(restore = false) {
    if (!restore || plusDraft?.owner !== (Cloud?.storageKey || STORAGE_KEY)) plusDraft = null;
    const start = plusDraft?.entries[0].date || (route.page === 'menus' && weekOffset() !== 0 ? localDate(weekDates()[0]) : localDate());
    openDialog(`<div class="dialog-content plus-preview">${plusStamp()}<h2 id="dialog-title">Deux jours, pour goûter l’idée.</h2><p class="plus-lead">Quatre plats pour vos déjeuners et dîners, à choisir parmi les recettes Nidelle. Un aperçu gratuit, pour deux personnes.</p><form id="plus-preview-form"><div class="plus-preview-fields"><div class="field"><label for="plus-start">À partir du</label><input class="text-input" type="date" id="plus-start" name="start" value="${start}" min="1900-01-01" max="9999-12-30" required></div><div class="field"><label for="plus-duration">Temps par recette</label><select class="text-input" id="plus-duration" name="duration"><option value="30">30 minutes maximum</option><option value="45" selected>45 minutes maximum</option><option value="120">Tout mon temps</option></select></div></div><label class="check-label plus-vegetarian"><input type="checkbox" name="vegetarian" ${store.vegetarian ? 'checked' : ''}>Uniquement des recettes végétariennes</label><button class="btn btn-primary" type="submit">${icon('sparkle', 16)}Proposer mes 4 repas</button></form><p id="plus-preview-feedback" class="plus-preview-feedback" role="status"></p><div id="plus-preview-results"></div><p class="plus-free-note">Ouvrez chaque recette pour vérifier les ingrédients, les allergènes et les précautions de préparation. Ces idées ne sont pas un programme nutritionnel personnalisé.</p></div>`, { type: 'plus-preview', owner: Cloud?.storageKey || STORAGE_KEY });
    const lastStart = monday(53); lastStart.setDate(lastStart.getDate() - 2);
    $('#plus-start').min = localDate(monday(-52)); $('#plus-start').max = localDate(lastStart);
    if (plusDraft) {
      $('#plus-duration').value = String(plusDraft.maxTime);
      $('#plus-preview-form [name="vegetarian"]').checked = plusDraft.vegetarian;
      renderPlusPreview();
    }
  }
  function renderPlusPreview() {
    if (!plusDraft || !$('#plus-preview-results')) return;
    const result = Plus.fillEmpty(store.menus, plusDraft.entries, D.recipes);
    const dates = [...new Set(plusDraft.entries.map(e => e.date))];
    $('#plus-preview-results').innerHTML = `<div class="plus-preview-days">${dates.map(date => `<section><h3>${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>${plusDraft.entries.filter(e => e.date === date).map(entry => { const r = recipesById.get(entry.recipeId); const occupied = !!store.menus[date]?.[entry.meal]; return `<button class="plus-preview-recipe" data-action="plus-preview-recipe" data-id="${r.id}"><img src="assets/${r.image}.jpg" alt="" width="150" height="110"><span><small>${mealLabels[entry.meal]} · ${r.time} min</small><b>${escape(r.title)}</b>${occupied ? '<small class="plus-occupied">Créneau déjà occupé · repas conservé</small>' : '<small>Voir la recette et ses précautions →</small>'}</span></button>`; }).join('')}</section>`).join('')}</div><p class="plus-save-note">${result.added ? `${result.added} repas peuvent être ajoutés. ${result.occupied ? `${result.occupied} créneau(x) déjà occupé(s) seront conservés.` : 'Vos autres repas restent en place.'}` : 'Ces créneaux sont déjà occupés. Choisissez une autre date pour ajouter de nouvelles idées.'}</p><div class="plus-preview-actions"><button class="btn btn-primary" data-action="plus-save-preview" ${!result.added ? 'disabled' : ''}>${icon('calendar', 16)}Ajouter ${result.added} repas à mes menus</button><button class="btn btn-outline" data-action="plus-regenerate">${icon('refresh', 15)}D’autres idées</button></div><div class="plus-preview-upsell"><div><strong>Envie de prévoir la semaine entière ?</strong><p>Nidelle Plus prépare la composition de 7 jours.</p></div><button class="btn-text" data-action="plus-offer">Découvrir l’offre ${icon('arrow', 15)}</button></div>`;
  }
  function generatePlusPreview(form) {
    if (dialogContext?.type !== 'plus-preview') return;
    const owner = Cloud?.storageKey || STORAGE_KEY;
    if (dialogContext.owner !== owner) { plusPreviewDialog(); toast('Votre carnet a changé. Choisissez à nouveau vos préférences.', 'info'); return; }
    const data = new FormData(form);
    try {
      const entries = Plus.preview(D.recipes, { start: String(data.get('start')), maxTime: Number(data.get('duration')), vegetarian: data.get('vegetarian') === 'on' });
      plusDraft = { entries, owner, vegetarian: data.get('vegetarian') === 'on', maxTime: Number(data.get('duration')) };
      renderPlusPreview();
      $('#plus-preview-feedback').textContent = 'Vos quatre idées sont prêtes. Vous pouvez les consulter avant de les ajouter.';
    } catch (error) { plusDraft = null; $('#plus-preview-results').innerHTML = ''; $('#plus-preview-feedback').textContent = error.message; }
  }
  function savePlusPreview() {
    if (!plusDraft || dialogContext?.type !== 'plus-preview') return;
    if (plusDraft.owner !== (Cloud?.storageKey || STORAGE_KEY)) { plusPreviewDialog(); toast('Votre carnet a changé. Recréez un aperçu pour ce carnet.', 'info'); return; }
    // Recheck the current notebook: a cloud sync may have filled slots since the preview.
    const result = Plus.fillEmpty(store.menus, plusDraft.entries, D.recipes);
    if (!result.added) { renderPlusPreview(); $('#plus-preview-feedback').textContent = 'Ces repas sont déjà prévus. Aucun repas existant n’a été remplacé.'; return; }
    const start = new Date(plusDraft.entries[0].date + 'T12:00:00');
    const offset = Math.floor((Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - Date.UTC(monday().getFullYear(), monday().getMonth(), monday().getDate())) / 604800000);
    store.menus = result.menus;
    const saved = persist();
    plusDraft = null; $('#detail-dialog').close();
    go('menus', { semaine: offset || null });
    toast(`${result.added} repas ajoutés${saved ? ' à votre carnet' : ' dans cet onglet'}.${result.occupied ? ' Les repas déjà prévus ont été conservés.' : ''}`, 'calendar');
  }
  function plannerPage() {
    const dates = weekDates();
    const start = dates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const end = dates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    let count = 0;
    dates.forEach(d => { count += Object.values(store.menus[localDate(d)] || {}).filter(id => recipesById.has(id)).length; });
    return `${heading('Une semaine à votre goût.', 'Des repas qui vous font envie, de la place pour souffler.')}${plusPlannerBanner()}<div class="planner-top"><div class="week-controls"><a href="${href('menus', { semaine: weekOffset() - 1 })}" class="icon-button" aria-label="Semaine précédente">${icon('chevron', 16).replace('<svg', '<svg class="rotate"')}</a><span>${start} — ${end}</span><a href="${href('menus', { semaine: weekOffset() + 1 })}" class="icon-button" aria-label="Semaine suivante">${icon('chevron', 16)}</a></div><a href="#menus" class="btn btn-outline">Cette semaine</a></div><div class="planner-grid">${dates.map(d => {
      const date = localDate(d);
      return `<section class="planner-day" aria-label="${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}"><div class="day-heading ${date === localDate() ? 'today' : ''}"><span>${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span><b>${d.getDate()}</b></div>${Object.entries(mealLabels).map(([meal, label]) => {
        const r = recipesById.get(store.menus[date]?.[meal]);
        return `<div class="meal-slot"><span class="meal-slot-label">${label}</span>${r ? `<button class="icon-button remove-meal" data-action="remove-meal" data-date="${date}" data-meal="${meal}" aria-label="Retirer ${escape(r.title)} du ${label.toLowerCase()} du ${date}">${icon('close', 12)}</button><button class="planned-recipe" data-action="recipe" data-id="${r.id}"><img src="assets/${r.image}.jpg" alt="" loading="lazy"><b>${r.title}</b></button>` : `<button class="add-meal" data-action="pick-recipe" data-date="${date}" data-meal="${meal}" aria-label="Ajouter le ${label.toLowerCase()} du ${date}">${icon('plus', 18)}Choisir une recette</button>`}</div>`;
      }).join('')}</section>`;
    }).join('')}</div><div class="planner-info"><div><strong>${count ? `${count} repas au programme` : 'Une page blanche pleine de possibilités'}</strong>Les recettes sont prévues pour deux personnes. Ce carnet organise vos envies ; il ne prescrit pas un régime alimentaire.</div><button class="btn btn-primary" data-action="week-shopping" ${!count ? 'disabled' : ''}>${icon('bag', 16)}Préparer mes courses</button></div>`;
  }
  function shoppingPage() {
    const done = store.shopping.filter(i => i.checked).length;
    return `${heading('Et hop, dans le panier.', 'Votre liste de courses, à compléter et à cocher au fil des rayons.')}<div class="shopping-layout"><section><form id="shopping-add" class="shopping-add"><label class="sr-only" for="shopping-input">Ajouter un article à la liste</label><input class="text-input" id="shopping-input" name="item" placeholder="Un petit quelque chose à ajouter…" maxlength="150" required><button class="btn btn-primary" type="submit">${icon('plus', 16)}Ajouter</button></form><p class="shopping-count" id="shopping-count">${done} sur ${store.shopping.length} article${store.shopping.length > 1 ? 's' : ''} dans votre panier</p>${store.shopping.length ? `<div class="shopping-list">${store.shopping.map(i => `<div class="shopping-item"><input id="item-${escape(i.id)}" type="checkbox" data-shopping-id="${escape(i.id)}" ${i.checked ? 'checked' : ''}><label for="item-${escape(i.id)}">${escape(i.name)}<span>${i.quantity ? `${number(i.quantity)} ${escape(i.unit)}` : ''}</span></label><button class="icon-button" data-action="remove-item" data-id="${escape(i.id)}" aria-label="Supprimer ${escape(i.name)}">${icon('close', 14)}</button></div>`).join('')}</div>` : empty('On prépare quelque chose de bon ?', 'Ajoutez les ingrédients d’une recette ou de vos menus en un geste.', '<a href="#recettes" class="btn btn-secondary">Trouver une recette ' + icon('arrow', 15) + '</a>', 'bag')}</section><aside class="shopping-aside">${icon('bag', 31)}<h3>Moins d’oubli,<br>plus de tranquillité.</h3><p>Ajoutez les ingrédients depuis une recette ou depuis votre semaine de menus. Les quantités identiques s’additionnent.</p><button class="btn btn-outline" data-action="download-shopping">${icon('download', 15)}Exporter ma liste</button><button class="btn btn-outline" data-action="clear-checked">${icon('check', 15)}Retirer les articles cochés</button><a href="#menus" class="btn-text">Organiser mes menus ${icon('arrow', 15)}</a></aside></div>`;
  }
  function guidePage() {
    const cards = [
      ['drop', 'Un lavage tout en attention.', 'Lavez fruits, légumes et herbes à l’eau potable. Retirez la terre avant de les éplucher ou les couper. Au restaurant, si la préparation est incertaine, préférez les légumes cuits.', 'toxo'],
      ['fire', 'Bien cuit, jusqu’au cœur.', 'Viandes et poissons se mangent entièrement cuits. Pour les œufs, le blanc et le jaune doivent être fermes. Une marinade, un simple réchauffage ou une congélation ne remplace pas une cuisson adaptée.', 'ministry'],
      ['fridge', 'Le froid a son importance.', 'Maintenez le réfrigérateur à 4 °C maximum. Respectez la date limite et les consignes après ouverture. Réfrigérez rapidement les restes et réchauffez-les uniformément.', 'spf'],
      ['milk', 'Tous les fromages sont différents.', 'Les pâtes pressées cuites, sans croûte, sont possibles. Le lait pasteurisé ne suffit pas à rendre compatible un fromage à pâte molle comme le brie. Lisez la fiche de chaque famille.', 'agriculture'],
      ['fish', 'Du poisson, et de la variété.', 'Variez les espèces et limitez les poissons prédateurs comme le thon, même en conserve. Évitez notamment l’espadon et le requin. La cuisson ne retire pas le mercure.', 'ameli'],
      ['cup', 'Un œil sur ce qu’on boit.', 'Le repère est zéro alcool. Pour la caféine, Nidelle retient la limite EFSA de 200 mg par jour pendant la grossesse, toutes sources additionnées. L’eau potable reste la boisson à privilégier.', 'efsa']
    ];
    return `${heading('Des repères pour être plus sereine.', 'Quelques gestes utiles à garder en tête, tout au long de la grossesse.')}${illustratedIntro('Comprendre, puis savourer.', 'Laver, cuire, conserver : des gestes concrets pour garder le plaisir de manger pendant votre grossesse.')}<div class="guide-grid">${cards.map(([symbol, title, text, source]) => `<article class="guide-card"><div class="tip-icon">${icon(symbol, 21)}</div><h2>${title}</h2><p>${text}</p>${sourceLink(source)}</article>`).join('')}</div><section class="faq-section"><h2>Les questions qui reviennent.</h2>${[
      ['Je suis immunisée contre la toxoplasmose. Est-ce que tout change ?', 'L’immunité à la toxoplasmose ne protège pas de la listériose, de la salmonellose ni des contaminants. Les repères de Nidelle ne relâchent donc pas les autres précautions. Votre sage-femme ou médecin pourra préciser celles qui vous concernent.'],
      ['Pourquoi un produit reste-t-il « À vérifier » ?', 'Open Food Facts est une base collaborative. Le nom, les ingrédients ou la catégorie ne précisent pas toujours la pasteurisation, la cuisson ou la conservation. Une absence d’alerte détectée ne prouve pas la compatibilité d’un produit.'],
      ['Un bon Nutri-Score signifie-t-il que je peux en manger ?', 'Le Nutri-Score renseigne sur la composition nutritionnelle générale. Il ne certifie ni la sécurité microbiologique, ni la cuisson, ni la compatibilité avec la grossesse. Nidelle ne l’utilise pas pour autoriser un aliment.'],
      ['Ces conseils sont-ils personnalisés pour ma grossesse ?', 'Non. Le guide donne des repères généraux français. Il ne prend pas en charge les allergies, le diabète gestationnel, les traitements ou une situation médicale particulière. Pour les adapter, parlez-en à votre professionnel de santé.'],
      ['J’ai déjà mangé un aliment indiqué « À éviter ».', 'Cette mention ne signifie pas que vous êtes infectée. En cas d’inquiétude, de fièvre ou d’autres symptômes, contactez votre sage-femme ou médecin et précisez l’aliment consommé. Nidelle ne peut pas évaluer une exposition individuelle.'],
      ['Est-ce que Nidelle fonctionne sans Internet ?', 'Après une première ouverture depuis un hébergement HTTPS ou localhost, le guide, les recettes et votre carnet sont mis en cache pour une utilisation hors connexion. Une nouvelle recherche Open Food Facts nécessite Internet ; les résultats déjà consultés peuvent rester disponibles en cache pendant 24 heures.']
    ].map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</section><div class="home-footer-note">${icon('book', 23)}<p>Les sources et la méthode sont accessibles à tout moment. <a href="#sources">Voir les références et les limites du guide</a></p></div>`;
  }
  function sourcesPage() {
    return `${heading('La confiance commence par la clarté.', 'Voici d’où viennent nos repères, et ce que Nidelle peut vous apporter.')}<div class="advice-box"><p><strong>Nidelle est un outil d’information générale.</strong> Les fiches éditoriales sont préparées à partir des recommandations publiques ci-dessous. Elles n’ont pas fait l’objet d’une validation clinique indépendante et ne remplacent pas un avis médical.</p><p>Références consultées le ${D.reviewed}. Pays de référence : France. Les recommandations peuvent évoluer. Les références britanniques et américaines complètent des points identifiés dans les fiches ; le repère caféine retenu est celui de l’EFSA.</p></div><div class="sources-list">${Object.values(D.sources).map(s => `<a class="source-row" href="${s.url}" target="_blank" rel="noopener noreferrer"><div><b>${s.name}</b><span>${s.title}</span></div>${icon('external', 18)}</a>`).join('')}</div><div class="legal-copy"><h3>Deux sources, deux niveaux d’information</h3><p>Le guide local comporte ${D.foods.length} aliments et familles alimentaires avec leurs conditions de préparation. Il n’est pas exhaustif. La recherche de produits interroge la base mondiale Open Food Facts à la demande ; elle ne télécharge pas tous les produits.</p><p>Pour un produit Open Food Facts, des règles repèrent certains termes de la dénomination, des catégories et des ingrédients en français ou en anglais. Les règles sont partielles, peuvent manquer une information ou interpréter un terme à tort. La cuisson réelle, la chaîne du froid, les rappels de lots et la qualité du lavage ne peuvent pas être vérifiés. Aucun produit n’est automatiquement déclaré « Compatible ».</p><h3>Des explications, pas seulement une couleur</h3><p>Chaque fiche précise la forme de l’aliment, le mécanisme du risque ou le motif de compatibilité, ce que change la préparation et les sources correspondantes. La mention « application des recommandations générales » distingue une synthèse pour une famille d’aliments d’un aliment explicitement cité par une autorité.</p><h3>Comprendre les indications</h3>${Object.values(D.statuses).map(s => `<p><strong>${s.label}.</strong> ${s.description}</p>`).join('')}<h3>Recettes et photographie</h3><p>Les ${D.recipes.length} recettes sont des propositions culinaires originales. Les temps de cuisson sont indicatifs ; vérifiez toujours la cuisson complète et les indications du fabricant. Elles ne constituent pas un programme nutritionnel individualisé. Les photos sont des images d’inspiration et peuvent différer du plat décrit.</p><p>Photographies : <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">Unsplash</a>. Illustrations de grossesse créées avec un outil de génération d’images ; elles sont décoratives. Identité et pictogrammes vectoriels créés pour Nidelle. Polices DM Sans et Lora sous licence SIL Open Font License.</p><h3>Open Food Facts et réutilisation</h3><p>Les données de produits appartiennent à la base collaborative <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a>, sous <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">licence ODbL</a>. Les contenus individuels sont sous Database Contents License et les images de produits sous CC BY-SA. Chaque fiche contient un lien vers sa source. Ces données sont distinctes du guide Nidelle.</p></div>`;
  }
  function accountPanel() {
    const state = Cloud.state;
    const statusLabels = { checking: 'Vérification de la connexion…', loading: 'Ouverture de votre carnet…', saving: 'Enregistrement en ligne…', synced: 'Carnet synchronisé', pending: 'Modifications à synchroniser', offline: 'Hors connexion · enregistré sur cet appareil', error: 'Synchronisation à reprendre', conflict: 'Deux versions à rapprocher', local: 'Carnet sur cet appareil', unavailable: 'Connexion au serveur indisponible' };
    const intro = `<div class="account-heading"><span class="account-symbol">${icon('cloud', 25)}</span><div><span class="eyebrow">VOTRE CARNET, PARTOUT</span><h2>${state.user ? 'Heureuse de vous retrouver.' : 'Gardez le fil, d’un appareil à l’autre.'}</h2></div></div>`;
    if (state.user) return `<section class="account-panel">${intro}<p class="account-email">${escape(state.user.email || state.user.name)}</p><p class="cloud-status" role="status">${icon(state.status === 'synced' ? 'check' : 'refresh', 15)}${statusLabels[state.status] || statusLabels.local}</p>${state.error ? `<p class="account-error" role="alert">${escape(state.error)} Votre copie locale est conservée.</p>` : ''}${state.savedAt ? `<p class="small muted">Dernière sauvegarde : ${new Date(state.savedAt).toLocaleString('fr-FR')}</p>` : ''}${state.conflict ? `<div class="sync-conflict"><h3>Le carnet a aussi changé ailleurs.</h3><p>Des modifications concernent les mêmes éléments. Choisissez la version à conserver pour éviter un remplacement automatique.</p><div class="dialog-actions"><button class="btn btn-primary" data-action="resolve-sync" data-choice="local">Garder celle de cet appareil</button><button class="btn btn-outline" data-action="resolve-sync" data-choice="remote">Garder celle en ligne</button></div></div>` : ''}<div class="dialog-actions"><button class="btn btn-primary" data-action="sync-now">${icon('refresh', 15)}Synchroniser</button><button class="btn btn-outline" data-action="sign-out">Se déconnecter</button></div><p class="small muted">Les favoris, les menus, les courses et vos préférences sont liés à ce compte. Les recettes restent accessibles sans compte.</p><p id="auth-feedback" class="scanner-status" role="status"></p></section>`;
    if (state.configured === false && window.MietteRuntime?.appURL) return `<section class="account-panel">${intro}<p>La version connectée de Nidelle vous permet de retrouver votre carnet sur vos autres appareils.</p><a class="btn btn-primary" href="${escape(window.MietteRuntime.appURL)}#profil">Ouvrir la version connectée ${icon('arrow', 15)}</a><p class="small muted">Vous pouvez exporter votre carnet ici, puis l’importer dans la nouvelle version.</p></section>`;
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
    feedback.textContent = 'Un petit instant…';
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
        if (Cloud.state.user) { renderAccount(); toast('Votre compte est ouvert. Votre carnet vous suit.', 'heart'); }
        else { renderAccount(); if ($('#auth-feedback')) $('#auth-feedback').textContent = 'Vérifiez votre boîte e-mail pour confirmer le compte, puis connectez-vous.'; }
      }
    } catch (error) {
      const messages = { INVALID_EMAIL_OR_PASSWORD: 'L’adresse e-mail ou le mot de passe est incorrect.', USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Cette adresse possède déjà un compte. Connectez-vous ou utilisez le lien de récupération.', EMAIL_NOT_VERIFIED: 'Confirmez votre adresse avec le lien reçu par e-mail avant de vous connecter.', INVALID_TOKEN: 'Ce lien a expiré. Demandez un nouveau lien de récupération.', PASSWORD_TOO_SHORT: 'Choisissez un mot de passe d’au moins 10 caractères.', TOO_MANY_REQUESTS: 'Plusieurs tentatives ont été effectuées. Réessayez dans une minute.' };
      if ($('#auth-feedback')) $('#auth-feedback').textContent = messages[error.data?.code] || error.message;
    } finally { authBusy = false; if (button.isConnected) button.disabled = false; }
  }
  function installationPanel() {
    const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<section class="install-panel"><div class="account-heading"><span class="account-symbol">${icon('download', 23)}</span><div><span class="eyebrow">TOUJOURS À PORTÉE DE MAIN</span><h2>${installed ? 'Nidelle est installée.' : 'Nidelle sur votre écran d’accueil.'}</h2></div></div><p>${installed ? 'Retrouvez l’application depuis son icône, comme vos autres applications.' : 'Ouvrez Nidelle comme une application, avec les aliments du guide et les recettes disponibles hors connexion après leur premier chargement.'}</p>${installPrompt ? `<button class="btn btn-primary" data-action="install">${icon('download', 16)}Installer Nidelle</button>` : !installed ? '<ol class="install-steps"><li><b>Sur iPhone ou iPad :</b> ouvrez ce site dans Safari, touchez Partager, puis « Sur l’écran d’accueil ».</li><li><b>Sur Android :</b> ouvrez le menu de Chrome, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».</li><li><b>Sur ordinateur :</b> utilisez l’icône d’installation dans la barre d’adresse de Chrome ou Edge, si elle apparaît.</li></ol>' : ''}</section>`;
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
    return `<div id="account-panel">${accountPanel()}</div>${heading('Un espace qui vous ressemble.', 'Quelques préférences, pour retrouver vos envies plus facilement.')}<form id="profile-form" class="profile-panel"><div class="field"><label for="profile-name">Votre prénom ou surnom</label><input class="text-input" id="profile-name" name="name" value="${escape(store.name)}" maxlength="30" placeholder="Comment vous appelle-t-on ?" autocomplete="given-name"><p class="field-hint">Facultatif. Enregistré sur cet appareil et synchronisé si vous êtes connectée.</p></div><div class="field"><label class="check-label" for="profile-vegetarian"><input type="checkbox" id="profile-vegetarian" name="vegetarian" ${store.vegetarian ? 'checked' : ''}> Privilégier les recettes végétariennes</label><p class="field-hint">Ce filtre ne gère pas les allergies ni les besoins médicaux.</p></div><div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', 15)}Enregistrer</button><a class="btn-text" href="#confidentialite">Mes données ${icon('arrow', 15)}</a></div></form>${installationPanel()}`;
  }
  async function importNotebook(file) {
    try {
      if (file.size > 2500000) throw new Error('Le fichier est trop volumineux. Choisissez un export Nidelle.');
      const data = JSON.parse(await file.text());
      const n = data.notebook;
      if (!['Nidelle', 'Miette'].includes(data.application) || data.version !== 1 || !n || typeof n.name !== 'string' || !Array.isArray(n.favorites) || !Array.isArray(n.shopping) || !n.menus || typeof n.menus !== 'object') throw new Error('Ce fichier n’est pas un export Nidelle valide.');
      openDialog(`<div class="dialog-content"><h2 id="dialog-title">Importer ce carnet ?</h2><p>${n.favorites.length} favoris, ${n.shopping.length} articles et ${Object.keys(n.menus).length} jours de menus.</p><p class="muted small">Le carnet actuel sera remplacé. Exportez-le d’abord si vous souhaitez en garder une copie.</p><div class="dialog-actions"><button class="btn btn-primary" data-action="confirm-import">Importer le carnet</button><button class="btn btn-outline" data-action="close-dialog">Annuler</button></div></div>`, { type: 'import', notebook: n });
    } catch (error) { toast(error instanceof SyntaxError ? 'Le fichier JSON est illisible.' : error.message, 'info'); }
  }
  function privacyPage() {
    return `${heading('Votre carnet, vos choix.', 'Utilisez Nidelle sans compte, ou retrouvez votre carnet sur plusieurs appareils.')}<div class="profile-panel legal-copy"><h3>Sans compte</h3><p>Votre prénom facultatif, la préférence végétarienne, les favoris, les menus et la liste de courses restent dans le stockage local de ce navigateur. Une copie exportée vous permet de les conserver ou de changer d’appareil.</p><h3>Avec un compte</h3><p>La connexion est gérée par Neon Auth. Les mots de passe sont traités par ce service d’authentification ; ils ne sont pas enregistrés dans le carnet. Votre carnet est sauvegardé dans la base PostgreSQL dédiée à Nidelle et associé à votre compte. Le serveur vérifie la connexion avant chaque accès au carnet. Vous pouvez vous déconnecter depuis Mon espace.</p><p>Une copie reste sur l’appareil pour continuer hors connexion. Les modifications sont synchronisées au retour du réseau. Si les mêmes éléments ont changé sur deux appareils, Nidelle vous demande quelle version conserver.</p><h3>Recherche de produits et caméra</h3><p>Les noms recherchés et les codes-barres sont transmis au serveur Nidelle sur Vercel, puis à Open Food Facts. Les fiches publiques peuvent être mises en cache. Les images des produits viennent d’Open Food Facts. Votre carnet et votre adresse e-mail ne lui sont pas transmis.</p><p>Les images de caméra et les photos de codes-barres sont analysées sur votre appareil. Elles ne sont ni envoyées au serveur ni enregistrées dans le carnet. La caméra est arrêtée à la fermeture du scanner. Nidelle ne contient ni publicité ni mesure d’audience.</p><h3>Exporter ou importer</h3><p>Le fichier JSON contient les préférences, favoris, menus et courses. Il ne contient ni mot de passe ni session de connexion.</p><div class="dialog-actions"><button class="btn btn-secondary" data-action="export-data">${icon('download', 16)}Exporter mon carnet</button><button class="btn btn-outline" data-action="import-data">${icon('upload', 16)}Importer un carnet</button></div><input type="file" id="notebook-file" accept="application/json,.json" hidden><p id="import-status" role="status"></p><h3>Effacer le carnet</h3><p>${Cloud.state.user ? 'Le carnet sera vidé sur cet appareil et dans votre compte lors de la synchronisation. Le compte de connexion restera disponible.' : 'Le carnet et le cache des recherches seront effacés de ce navigateur.'} Vous pouvez exporter une copie avant cette action.</p><button class="btn btn-outline" data-action="reset-data">${icon('trash', 16)}Effacer mon carnet</button>${Cloud.state.user ? '<h3>Supprimer le compte</h3><p>La suppression efface le compte de connexion et son carnet en ligne. Le carnet sans compte de cet appareil reste séparé.</p><button class="btn btn-outline" data-action="delete-account">Supprimer mon compte</button>' : ''}</div>`;
  }
  function renderRoute(keepDialog = false) {
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
    const pages = { accueil: homePage, aliments: explorePage, recettes: recipePage, favoris: favoritesPage, menus: plannerPage, courses: shoppingPage, guide: guidePage, sources: sourcesPage, profil: profilePage, confidentialite: privacyPage, plus: plusPage };
    $('#main').innerHTML = `<div class="page-content">${pages[route.page]()}</div>${footer()}`;
    syncSidebar();
    document.title = `${labels[route.page]} — Nidelle`;
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
    const form = preserveEdits && active?.matches('input,textarea,select') && active.closest('#profile-form,#shopping-add,#home-search,#explore-search,#recipe-search');
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
    if (!dialog.open) lastDialogTrigger = document.activeElement;
    dialogContext = context;
    dialog.innerHTML = `<button class="dialog-close" data-action="close-dialog" aria-label="Fermer la fiche" autofocus>${icon('close', 19)}</button>${content}`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function foodDetail(id) {
    const f = foodsById.get(id) || productMap.get(id);
    if (!f) { toast('Cette fiche n’est plus disponible.', 'info'); return; }
    const isOFF = f.origin === 'off';
    const related = D.recipes.filter(r => r.foods.includes(id)).slice(0, 2);
    const top = `<div class="dialog-food-top"><div class="dialog-food-art">${isOFF && f.image_front_small_url ? `<img src="${escape(f.image_front_small_url)}" alt="${escape(f.name)}" referrerpolicy="no-referrer">` : art(f.art)}</div><div class="dialog-food-heading"><span class="eyebrow">${isOFF ? 'PRODUIT OPEN FOOD FACTS' : 'LE GUIDE NIDELLE'}</span><h2 id="dialog-title">${escape(f.name)}</h2>${badge(f.status)}<p>${escape(isOFF ? [f.brands, f.quantity].filter(Boolean).join(' · ') : f.summary)}</p></div></div>`;
    let body;
    if (isOFF) {
      const a = f.analysis;
      const nutrition = [['energy-kcal_100g', 'Énergie', 'kcal'], ['fat_100g', 'Matières grasses', 'g'], ['sugars_100g', 'Sucres', 'g'], ['proteins_100g', 'Protéines', 'g'], ['fiber_100g', 'Fibres', 'g'], ['salt_100g', 'Sel', 'g']].filter(([key]) => Number.isFinite(f.nutriments[key]));
      body = `<div class="advice-box ${f.status}"><p><strong>Cette fiche ne certifie pas la compatibilité avec la grossesse.</strong></p><p>${escape(a.reason)} Les informations sont collaboratives et peuvent être incomplètes. Lisez l’étiquette et demandez conseil en cas de doute.</p></div>${a.missing.length ? `<p class="missing-data">${icon('info', 14)} ${a.missing.map(escape).join(' · ')}</p>` : ''}<h3>${a.flags.length ? 'Les points à vérifier' : 'Pas de précaution reconnue automatiquement'}</h3>${a.flags.length ? a.flags.map(productFlag).join('') : '<p class="ingredient-text">L’absence de signal détecté ne prouve pas l’absence de risque. Vérifiez la préparation, le traitement thermique, la conservation et la liste complète des ingrédients.</p>'}<div class="product-unknowns"><h3>Ce que la fiche ne peut pas confirmer</h3><ul>${a.unknowns.map(t => `<li>${escape(t)}</li>`).join('')}</ul><p>Les termes ci-dessus sont normalisés pour la détection ; ils ne remplacent pas le texte de l’étiquette.</p></div>${sourceFooter(a.sources)}<h3>Les ingrédients renseignés</h3><p class="ingredient-text">${escape(f.ingredients_text_fr || f.ingredients_text || 'La liste des ingrédients n’est pas renseignée. Consultez l’emballage.')}</p><p class="allergens"><strong>Allergènes déclarés :</strong> ${f.allergens_tags.length ? escape(f.allergens_tags.map(t => t.replace(/^\w{2}:/, '')).join(', ')) : 'Non renseignés — cela ne signifie pas qu’il n’y en a pas.'} Vérifiez l’étiquette.</p>${nutrition.length ? `<h3>Valeurs déclarées pour 100 g / 100 ml</h3><div class="nutrition-grid">${nutrition.map(([k, label, unit]) => `<div class="nutrition-item"><b>${number(f.nutriments[k])} ${unit}</b><span>${label}</span></div>`).join('')}</div><p class="dialog-disclaimer">Ces valeurs nutritionnelles ne déterminent pas la sécurité du produit pendant la grossesse.</p>` : ''}<div class="sources-inline"><p>CODE-BARRES : ${escape(f.code)} · DONNÉES COLLABORATIVES ODBL</p><a class="source-link" href="https://world.openfoodfacts.org/product/${encodeURIComponent(f.code)}" target="_blank" rel="noopener noreferrer">Voir la fiche originale Open Food Facts ${icon('external', 13)}</a></div>`;
    } else {
      body = `${foodExplanation(f)}<h3>${icon('recipe', 17)} Dans votre cuisine</h3><ul class="preparation-list">${f.preparation.map(t => `<li>${icon('check', 17)}<span>${escape(t)}</span></li>`).join('')}</ul>${related.length ? `<h3>Et si on le cuisinait ?</h3><div class="mini-recipes">${related.map(r => `<button class="mini-recipe" data-action="recipe" data-id="${r.id}"><img src="assets/${r.image}.jpg" alt=""><span>${r.title}</span></button>`).join('')}</div>` : ''}${sourceFooter(f.sources)}`;
    }
    openDialog(`<div class="dialog-content">${top}${body}<div class="dialog-actions"><button class="btn btn-secondary" data-action="favorite" data-kind="food" data-id="${escape(id)}">${icon('heart', 16)}${favorite('food', id) ? 'Retirer des favoris' : 'Garder dans mes favoris'}</button>${!isOFF ? `<button class="btn btn-outline" data-action="find-product" data-query="${escape(f.name)}">${icon('scan', 16)}Chercher un produit</button>` : ''}</div><p class="dialog-disclaimer">Repères généraux. La conservation, la préparation, vos allergies et votre situation personnelle restent à prendre en compte. Un doute ? Votre sage-femme ou médecin peut vous aider.</p></div>`, { type: 'food', id });
  }
  function recipeDetail(id, servings = 2) {
    const r = recipesById.get(id); if (!r) return;
    const portions = Math.max(1, Math.min(8, servings));
    openDialog(`<img class="dialog-recipe-photo" src="assets/${r.image}.jpg" alt="Photo d’inspiration culinaire"><div class="dialog-content"><span class="eyebrow">UNE RECETTE À AIMER</span><h2 id="dialog-title">${r.title}</h2><div class="dialog-recipe-meta"><span>${icon('clock', 15)}${r.time} minutes</span><span>${icon('users', 15)}${portions} personne${portions > 1 ? 's' : ''}</span><span>${icon(r.vegetarian ? 'leaf' : 'recipe', 15)}${r.tags[0]}</span></div><p class="muted small">${r.subtitle}</p><div class="servings-control"><h3>Les bonnes choses à prévoir</h3><div class="stepper"><button data-action="servings" data-delta="-1" aria-label="Réduire le nombre de portions" ${portions === 1 ? 'disabled' : ''}>${icon('minus', 13)}</button><span aria-live="polite">${portions} pers.</span><button data-action="servings" data-delta="1" aria-label="Augmenter le nombre de portions" ${portions === 8 ? 'disabled' : ''}>${icon('plus', 13)}</button></div></div><ul class="ingredients-list">${r.ingredients.map(i => `<li>${i.name}<b>${number(i.quantity * portions / r.servings)} ${i.unit}</b></li>`).join('')}</ul><p class="allergens"><strong>Allergènes :</strong> ${r.allergens}</p>${portions !== r.servings ? `<p class="portion-note">Quantités ajustées pour ${portions} personne${portions > 1 ? 's' : ''}. Adaptez aussi le nombre de moules et de fournées : les étapes décrivent la recette de base pour ${r.servings} personnes.</p>` : ''}<h3>On passe en cuisine ?</h3><ol class="steps-list">${r.steps.map(t => `<li>${t}</li>`).join('')}</ol><div class="advice-box">${icon('shield', 16)} <strong>Le petit repère grossesse</strong><p>${r.safety}</p></div><div class="dialog-actions"><button class="btn btn-primary" data-action="recipe-shopping" data-id="${r.id}" data-servings="${portions}">${icon('bag', 16)}Ajouter à mes courses</button><button class="btn btn-outline" data-action="plan-recipe" data-id="${r.id}">${icon('calendar', 16)}Au menu</button><button class="btn btn-outline" data-action="favorite" data-kind="recipe" data-id="${r.id}">${icon('heart', 16)}${favorite('recipe', r.id) ? 'Retirer' : 'Garder'}</button></div><p class="dialog-disclaimer">Temps de cuisson indicatifs. Suivez les ingrédients écrits, les précautions et vos consignes médicales. Les photos illustrent une idée de plat.</p>${sourceFooter(r.sources || ['spf', 'toxo'])}</div>`, { type: 'recipe', id, servings: portions });
    if (plusDraft) $('.dialog-content').insertAdjacentHTML('afterbegin', '<button class="btn-text plus-back" data-action="plus-back-preview">← Revenir à mes 4 idées</button>');
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
    toast(active ? 'Retiré de votre petit carnet.' : 'Un coup de cœur de plus dans votre carnet.', 'heart');
  }
  function pickRecipe(date, meal) {
    const recipes = store.vegetarian ? D.recipes.filter(r => r.vegetarian) : D.recipes;
    openDialog(`<div class="dialog-content"><span class="eyebrow">MON MENU</span><h2 id="dialog-title">Une envie pour ${meal === 'dinner' ? 'le dîner' : 'le déjeuner'} ?</h2><p class="muted small">${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · recettes pour deux personnes</p><div class="picker-search field"><label for="picker-query">Trouver un plat ou un ingrédient</label><input class="text-input" id="picker-query" type="search" maxlength="100" placeholder="Curry, gnocchis, poulet…"></div><p id="picker-count" class="muted small" role="status">${recipes.length} recettes à choisir</p><div class="picker-list">${recipes.map(r => `<button class="picker-recipe" data-action="assign-recipe" data-id="${r.id}" data-date="${date}" data-meal="${meal}"><img src="assets/${r.image}.jpg" alt="" loading="lazy" width="68" height="52"><div><b>${r.title}</b><span>${r.time} min · ${r.vegetarian ? 'Végétarien' : 'Viande ou poisson'}</span></div>${icon('plus', 17)}</button>`).join('')}</div></div>`, { type: 'picker' });
  }
  function planRecipe(id) {
    const r = recipesById.get(id); if (!r) return;
    openDialog(`<div class="dialog-content"><span class="eyebrow">UNE BONNE IDÉE AU MENU</span><h2 id="dialog-title">On le cuisine quand ?</h2><p class="muted small">${r.title} · menu pour deux personnes</p><form id="plan-recipe-form" data-id="${r.id}"><div class="picker-fields"><div class="field"><label for="meal-date">Le jour</label><input class="text-input" id="meal-date" type="date" name="date" value="${localDate()}" required></div><div class="field"><label for="meal-type">Le repas</label><select class="text-input" id="meal-type" name="meal"><option value="lunch">Déjeuner</option><option value="dinner">Dîner</option></select></div></div><p id="meal-replace-note" class="muted small">${store.menus[localDate()]?.lunch ? 'Un repas est déjà prévu à cette date. Il sera remplacé.' : 'Le repas sera ajouté à votre carnet de menus.'}</p><button class="btn btn-primary" type="submit" style="margin-top:18px">${icon('calendar', 16)}Ajouter à mon menu</button></form></div>`, { type: 'plan', id });
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
    openDialog(`<div class="dialog-content"><span class="eyebrow">UN PRODUIT SOUS LA MAIN ?</span><h2 id="dialog-title">Regardons son code-barres.</h2><p class="muted small">Saisissez les chiffres de l’emballage pour retrouver sa fiche Open Food Facts.</p><form id="barcode-form" class="barcode-form"><label class="sr-only" for="barcode-input">Code-barres à 8, 12, 13 ou 14 chiffres</label><input class="text-input" id="barcode-input" name="code" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="Ex. 3017620422003" required><button class="btn btn-primary" type="submit">Rechercher ${icon('arrow', 15)}</button></form><p id="barcode-error" class="scanner-status" role="alert"></p><input type="file" id="barcode-photo" accept="image/*" hidden><button class="btn btn-outline" data-action="barcode-photo">${icon('camera', 16)}Lire une photo du code-barres</button>${capable ? `<div class="scanner-view" id="scanner-view" hidden></div><button class="btn btn-secondary" data-action="start-camera">${icon('camera', 16)}Utiliser la caméra</button><p class="scanner-status" id="camera-status">La caméra reste sur votre appareil. Aucune image n’est transmise.</p>` : `<div class="off-note" style="margin-top:23px">${icon('info', 17)}<p>La lecture caméra n’est pas disponible dans ce navigateur. La saisie du code-barres fonctionne toujours. Vous pouvez lire une photo du code-barres ou ouvrir Nidelle dans le navigateur de votre téléphone.</p></div>`}</div>`, { type: 'scanner' });
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
    const trigger = event.target.closest('[data-action]');
    if (!trigger || trigger.disabled) return;
    const { action, id, kind } = trigger.dataset;
    const params = Object.fromEntries(route.params);
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
      case 'plus-preview': plusPreviewDialog(); break;
      case 'plus-regenerate': if ($('#plus-preview-form')?.reportValidity()) generatePlusPreview($('#plus-preview-form')); break;
      case 'plus-save-preview': savePlusPreview(); break;
      case 'plus-preview-recipe': if (plusDraft && recipesById.has(id)) recipeDetail(id); break;
      case 'plus-back-preview': plusPreviewDialog(true); break;
      case 'pick-recipe': pickRecipe(trigger.dataset.date, trigger.dataset.meal); break;
      case 'assign-recipe': assignRecipe(id, trigger.dataset.date, trigger.dataset.meal); break;
      case 'remove-meal': if (store.menus[trigger.dataset.date]) { delete store.menus[trigger.dataset.date][trigger.dataset.meal]; persist(); rerender(); toast('Le créneau est de nouveau libre.', 'calendar'); } break;
      case 'week-shopping': { const recipes = weekDates().flatMap(d => Object.values(store.menus[localDate(d)] || {}).map(rid => recipesById.get(rid)).filter(Boolean)).map(recipe => ({ recipe, servings: recipe.servings })); if (recipes.length) { addIngredients(recipes); go('courses'); } break; }
      case 'remove-item': store.shopping = store.shopping.filter(i => i.id !== id); persist(); rerender(); break;
      case 'clear-checked': { const count = store.shopping.filter(i => i.checked).length; store.shopping = store.shopping.filter(i => !i.checked); persist(); rerender(); toast(count ? `${count} articles cochés retirés.` : 'Aucun article n’est encore coché.', 'bag'); break; }
      case 'download-shopping': if (!store.shopping.length) { toast('Ajoutez quelques articles avant d’exporter.', 'info'); break; } downloadFile('nidelle-mes-courses.txt', 'NIDELLE — MA LISTE DE COURSES\n\n' + store.shopping.map(i => `[${i.checked ? 'x' : ' '}] ${i.name}${i.quantity ? ` — ${number(i.quantity)} ${i.unit}` : ''}`).join('\n'), 'text/plain;charset=utf-8'); toast('Votre liste est prête à emporter.', 'download'); break;
      case 'import-data': $('#notebook-file')?.click(); break;
      case 'transfer-notebook': transferNotebook(); break;
      case 'confirm-import': { const imported = dialogContext?.notebook; if (imported) { store = readStore(imported); persist(); $('#detail-dialog').close(); rerender(); toast('Le carnet a été importé.', 'check'); } break; }
      case 'export-data': downloadFile('nidelle-mon-carnet.json', JSON.stringify({ application: 'Nidelle', version: 1, exportedAt: new Date().toISOString(), notebook: store }, null, 2), 'application/json'); toast('Votre carnet a été exporté.', 'download'); break;
      case 'reset-data': openDialog('<div class="dialog-content"><h2 id="dialog-title">Effacer votre carnet ?</h2><p class="muted small">Votre prénom, vos favoris, vos menus et vos courses seront effacés. Si vous êtes connectée, le carnet vide sera aussi synchronisé avec votre compte. Vous pouvez exporter votre carnet avant cette action.</p><div class="dialog-actions"><button class="btn btn-outline" data-action="close-dialog">Garder mon carnet</button><button class="btn btn-primary" data-action="confirm-reset">Effacer les données</button></div></div>', { type: 'reset' }); break;
      case 'confirm-reset': store = { name: '', vegetarian: false, favorites: [], products: [], menus: {}, shopping: [] }; productMap.clear(); persist(); API.clearCache(); apiState = { key: '', products: [], loading: false, count: 0 }; $('#detail-dialog').close(); rerender(); toast('Votre carnet a été effacé de ce navigateur.', 'check'); break;
      case 'auth-mode': authMode = trigger.dataset.mode; if (route.params.has('token')) go('profil'); else renderAccount(true); break;
      case 'delete-account': openDialog('<div class="dialog-content"><h2 id="dialog-title">Supprimer votre compte ?</h2><p>Votre compte, ses sessions et son carnet en ligne seront supprimés définitivement. Vous pouvez exporter le carnet avant de continuer.</p><form id="delete-account-form"><div class="field"><label for="delete-password">Confirmer avec votre mot de passe</label><input class="text-input" id="delete-password" name="password" type="password" autocomplete="current-password" required maxlength="128"></div><p id="delete-feedback" role="alert"></p><div class="dialog-actions"><button type="button" class="btn btn-outline" data-action="close-dialog">Annuler</button><button type="submit" class="btn btn-primary">Supprimer définitivement mon compte</button></div></form></div>', { type: 'delete-account' }); break;
      case 'cloud-retry': Cloud.retry(); break;
      case 'sync-now': Cloud.sync(); break;
      case 'resolve-sync': Cloud.resolve(trigger.dataset.choice); break;
      case 'sign-out': Cloud.signOut().catch(error => toast(error.message, 'info')); break;
      case 'install': if (installPrompt) { installPrompt.prompt(); installPrompt.userChoice.finally(() => { installPrompt = null; if (route.page === 'profil') rerender(); }); } break;
    }
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    const data = new FormData(form);
    const known = ['home-search', 'explore-search', 'recipe-search', 'shopping-add', 'profile-form', 'plan-recipe-form', 'barcode-form', 'auth-form', 'delete-account-form', 'plus-preview-form'];
    if (!known.includes(form.id)) return;
    event.preventDefault();
    if (form.id === 'plus-preview-form') { generatePlusPreview(form); return; }
    if (form.id === 'delete-account-form') {
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      Cloud.deleteAccount(String(data.get('password'))).then(() => { $('#detail-dialog').close(); toast('Votre compte et son carnet en ligne ont été supprimés.', 'check'); }).catch(error => { if ($('#delete-feedback')) $('#delete-feedback').textContent = error.message; }).finally(() => { button.disabled = false; });
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
    if (event.target.matches('[data-plus-plan]') && Plus.offer.plans.some(p => p.id === event.target.value)) {
      plusPlan = event.target.value;
      document.querySelectorAll('[data-plus-plan]').forEach(input => { input.checked = input.value === plusPlan; });
      document.querySelectorAll('[data-plus-terms]').forEach(el => { el.innerHTML = plusTerms(); });
    }
    if (event.target.closest('#plus-preview-form')) {
      plusDraft = null; $('#plus-preview-results').innerHTML = '';
      $('#plus-preview-feedback').textContent = 'Préférences modifiées. Proposez vos 4 repas pour actualiser l’aperçu.';
    }
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
    stopCamera(); dialogContext = null; plusDraft = null; document.body.style.overflow = '';
    if (lastDialogTrigger?.isConnected) lastDialogTrigger.focus({ preventScroll: true });
    if (route.page === 'favoris') { const y = window.scrollY; $('#main').innerHTML = `<div class="page-content">${favoritesPage()}</div>${footer()}`; window.scrollTo({ top: y, behavior: 'instant' }); }
  });
  dialog.addEventListener('click', e => { if (e.target === dialog) { const box = dialog.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close(); } });
  const resetToken = new URLSearchParams(location.search).get('token');
  if (resetToken && new URLSearchParams(location.search).has('password-reset')) {
    history.replaceState(null, '', location.pathname + href('profil', { token: resetToken })); route = getRoute();
  }
  renderRoute(); updateOnline();
  window.addEventListener('miette:cloud', () => { renderAccount(); if ($('#topbar')) $('#topbar').innerHTML = topbar(); });
  Cloud?.init({ read: () => store, replace: replaceNotebook }).then(receiveTransfer);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* The application also works without installation. */ }));
  }
})();
