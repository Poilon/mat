'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const root = path.resolve('dist');
const routes = Object.fromEntries(['config', 'auth', 'notebook', 'products', 'account', 'billing', 'stripe-webhook', 'workshop', 'recipes', 'tonight'].map(name => [name, require('../api/' + name + '.js')]));
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.split('/')[2];
    if (routes[name]) return routes[name](req, res);
    res.writeHead(404).end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  let filename = path.resolve(root, '.' + pathname);
  if (pathname.endsWith('/')) filename = path.join(filename, 'index.html');
  else if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) { res.writeHead(308, { Location: pathname + '/' + url.search }).end(); return; }
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { const file = fs.readFileSync(filename); res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(file); }
  catch { res.writeHead(404).end(); }
}).listen(Number(process.env.PORT) || 4175, '127.0.0.1', () => console.log('Poum: http://localhost:' + (process.env.PORT || 4175)));
