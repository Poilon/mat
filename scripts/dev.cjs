'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
const root = path.resolve('dist');
const routes = Object.fromEntries(['config', 'auth', 'notebook', 'products', 'account', 'billing', 'stripe-webhook', 'workshop'].map(name => [name, require('../api/' + name + '.js')]));
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.split('/')[2];
    if (routes[name]) return routes[name](req, res);
    res.writeHead(404).end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { const file = fs.readFileSync(filename); res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(file); }
  catch { res.writeHead(404).end(); }
}).listen(Number(process.env.PORT) || 4175, '127.0.0.1', () => console.log('Miamama: http://localhost:' + (process.env.PORT || 4175)));
