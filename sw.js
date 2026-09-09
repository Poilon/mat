/* Offline app shell. External services are deliberately excluded from this cache. */
'use strict';
const CACHE = 'miette-shell-v1.1.0';
const ASSETS = [
  './', 'index.html', 'styles.css?v=2', 'manifest.webmanifest',
  'js/icons.js', 'js/recipes.js?v=2', 'js/data.js?v=2', 'js/rules.js', 'js/api.js', 'js/app.js?v=2',
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
  'assets/fonts/dm-sans.css', 'assets/fonts/lora.css',
  'assets/fonts/dm-sans-0.ttf', 'assets/fonts/dm-sans-1.ttf',
  'assets/fonts/dm-sans-2.ttf', 'assets/fonts/dm-sans-3.ttf',
  'assets/fonts/lora-0.ttf', 'assets/fonts/lora-1.ttf',
  'assets/fonts/lora-2.ttf', 'assets/fonts/lora-3.ttf'
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
