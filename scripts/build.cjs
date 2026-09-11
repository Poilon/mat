'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
(async () => {
  const destination = path.resolve('dist');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  for (const file of ['index.html', 'styles.css', 'design.css', 'manifest.webmanifest', 'sw.js', '.nojekyll']) fs.copyFileSync(file, path.join(destination, file));
  for (const folder of ['assets', 'js']) fs.cpSync(folder, path.join(destination, folder), { recursive: true });
  // The public deployment contains previews, never the premium preparation steps.
  const D = require('../js/data.js');
  const { publicRecipe, freeIDs } = require('../server/recipe-access.cjs');
  const recipes = D.recipes.map(publicRecipe);
  fs.writeFileSync(path.join(destination, 'js/data.js'), 'window.MietteData = ' + JSON.stringify({ ...D, recipes, freeRecipeCount: freeIDs.size }) + ';\n');
  fs.writeFileSync(path.join(destination, 'js/recipes.js'), 'window.MietteRecipeBook = ' + JSON.stringify({ recipes, collections: D.recipeCollections }) + ';\n');
  const appURL = process.env.PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '');
  const mirror = process.env.STATIC_MIRROR === '1';
  if (mirror && !appURL.startsWith('https://')) throw new Error('PUBLIC_APP_URL HTTPS is required for the GitHub Pages mirror.');
  const config = { apiBase: mirror ? new URL('/api/', appURL).href : '/api/', appURL, cloud: !mirror };
  fs.writeFileSync(path.join(destination, 'js/runtime.js'), 'window.MietteRuntime = ' + JSON.stringify(config) + ';\n');
  await build({ entryPoints: ['src/scanner.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: path.join(destination, 'js/scanner.js'), legalComments: 'eof' });
  // The serialized data bundle already contains these catalogues. Keep their source files for development, but avoid downloading duplicate data at startup.
  const htmlPath = path.join(destination, 'index.html');
  fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, 'utf8').replace(/\s*<script src="js\/(?:recipes|catalogue|seasonings)\.js\?v=\d+" defer><\/script>/g, ''));
  const seo = require('./seo.cjs').writeSEO(destination, { mirror });
  if (!mirror) {
    fs.mkdirSync(path.join(destination, 'relais'), { recursive: true });
    fs.copyFileSync('pages/relay.html', path.join(destination, 'relais/index.html'));
  }
  console.log('SEO: ' + seo.pages + ' public HTML pages.');
  console.log('Poum built: static interface, local barcode reader and Vercel API.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
