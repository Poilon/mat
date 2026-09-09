'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
(async () => {
  const destination = path.resolve('dist');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  for (const file of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', '.nojekyll']) fs.copyFileSync(file, path.join(destination, file));
  for (const folder of ['assets', 'js']) fs.cpSync(folder, path.join(destination, folder), { recursive: true });
  const appURL = process.env.PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
  const mirror = process.env.STATIC_MIRROR === '1';
  if (mirror && !appURL.startsWith('https://')) throw new Error('PUBLIC_APP_URL HTTPS is required for the GitHub Pages mirror.');
  const config = { apiBase: mirror ? new URL('/api/', appURL).href : '/api/', appURL, cloud: !mirror };
  fs.writeFileSync(path.join(destination, 'js/runtime.js'), 'window.MietteRuntime = ' + JSON.stringify(config) + ';\n');
  await build({ entryPoints: ['src/scanner.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: path.join(destination, 'js/scanner.js'), legalComments: 'eof' });
  console.log('Nidelle built: static interface, local barcode reader and Vercel API.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
