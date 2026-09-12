/* Offline app shell. External services are deliberately excluded from this cache. */
'use strict';
const CACHE = 'miette-shell-v3.9.2';
const ASSETS = [
  './', 'index.html', 'styles.css?v=9', 'design.css?v=11', 'manifest.webmanifest', 'js/billing.js?v=2',
  'js/diet.js?v=1', 'js/cooking.js?v=1', 'js/runtime.js?v=6', 'js/notebook.js?v=5', 'js/cloud.js?v=8', 'js/scanner.js', 'js/icons.js?v=6', 'js/evidence.js?v=4', 'js/data.js?v=6', 'js/rules.js?v=3', 'js/api.js?v=7', 'js/plus.js?v=5', 'js/workshop.js?v=7', 'js/recipe-access.js?v=2', 'js/seo-routes.js?v=1', 'js/app.js?v=21', 'js/tonight-rules.js?v=2', 'js/tonight-view.js?v=3', 'js/tonight.js?v=3', 'assets/tonight.css?v=1', 'assets/seo.css?v=1',
  'assets/brand/mark.svg', 'assets/brand/table-maternite-v4-320.webp', 'assets/brand/table-maternite-v4-640.webp', 'assets/brand/carnet-cuisine-v4-320.webp', 'assets/brand/carnet-cuisine-v4-640.webp', 'assets/brand/icon-192.png', 'assets/brand/icon-512.png',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/hero.jpg', 'assets/bowl.jpg', 'assets/salmon.jpg', 'assets/pasta.jpg',
  'assets/porridge.jpg', 'assets/vegetables.jpg', 'assets/soup.jpg',
  'assets/recipes/hummus.jpg',
  'assets/recipes/soup.jpg',
  'assets/recipes/lasagna.jpg',
  'assets/recipes/gnocchi.jpg',
  'assets/recipes/chicken-burger.jpg',
  'assets/recipes/brownie.jpg',
  'assets/recipes/burger.jpg',
  'assets/recipes/chicken.jpg',
  'assets/recipes/cookies.jpg',
  'assets/recipes/curry.jpg',
  'assets/recipes/muffins.jpg',
  'assets/recipes/pancakes.jpg',
  'assets/recipes/pizza.jpg',
  'assets/recipes/risotto.jpg',
  'assets/recipes/sandwich.jpg',
  'assets/recipes/tacos.jpg',
  'assets/recipes/waffles.jpg',
  'assets/fonts/dm-sans.css?v=2', 'assets/fonts/lora.css?v=2',
  'assets/fonts/dm-sans-0.woff2', 'assets/fonts/dm-sans-1.woff2',
  'assets/fonts/dm-sans-2.woff2', 'assets/fonts/dm-sans-3.woff2',
  'assets/fonts/lora-0.woff2', 'assets/fonts/lora-1.woff2',
  'assets/fonts/lora-2.woff2', 'assets/fonts/lora-3.woff2'
].map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('miette-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('index.html', self.registration.scope))));
    return;
  }
  if (ASSETS.includes(url.href)) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
