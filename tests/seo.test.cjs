'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../js/data.js'),{freeIDs}=require('../server/recipe-access.cjs'),SEO=require('../scripts/seo.cjs');
const pages=SEO.collectPages(),byURL=new Map(pages.map(p=>[p.url,p]));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const graphs=html=>[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap(m=>JSON.parse(m[1])['@graph']);
test('Every food has one French crawlable address, its exact advice and preparation, and a canonical URL',()=>{
 assert.equal(byURL.size,pages.length);assert.equal(pages.filter(p=>p.url.startsWith('/aliments/')&&p.url!=='/aliments/').length,D.foods.length);
 for(const f of D.foods){const url=SEO.routes.food(f),p=byURL.get(url);assert.ok(p,f.id);assert.match(url,/^\/aliments\/[a-z0-9-]+-enceinte\/$/);assert.ok(p.html.includes(esc(f.evidence.why)),f.id);for(const step of f.preparation)assert.ok(p.html.includes(esc(step)),f.id);for(const id of f.sources)assert.ok(p.html.includes(esc(D.sources[id].url)),f.id);assert.ok(p.html.includes(`rel="canonical" href="https://poum.app${url}"`));assert.equal((p.html.match(/<h1>/g)||[]).length,1);assert.ok(p.html.includes(f.evidence.basis==='specific'?'est cité dans les références':'Les sources ne citent pas nécessairement cet aliment'));}
});
test('All internal links and recipe step fragments resolve; no invented ratings, medical reviewers or premium recipe copies',()=>{
 const titles=new Set();let recipes=0;
 for(const p of pages){const title=p.html.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title),'Duplicate title '+title);titles.add(title);
  for(const [,href]of p.html.matchAll(/href="([^"#]*)"/g)){if(!href.startsWith('/'))continue;const u=new URL(href,'https://poum.app');if(u.pathname==='/'||u.pathname.startsWith('/assets/'))continue;assert.ok(byURL.has(u.pathname),p.url+' -> '+href);}
  for(const node of graphs(p.html)){assert.ok(!node.aggregateRating&&!node.reviewedBy&&!node.review);if(node['@type']==='Recipe'){recipes++;const r=D.recipes.find(r=>SEO.routes.recipe(r)===p.url);assert.ok(freeIDs.has(r.id));assert.deepEqual(node.recipeInstructions.map(s=>s.text),r.steps);assert.equal(node.totalTime,'PT'+r.time+'M');for(const step of node.recipeInstructions)assert.ok(p.html.includes('id="'+new URL(step.url).hash.slice(1)+'"'));assert.ok(fs.existsSync(path.resolve('assets',r.image+'.jpg')));}}
 }
 assert.equal(recipes,freeIDs.size);for(const r of D.recipes.filter(r=>!freeIDs.has(r.id)))assert.ok(!byURL.has(SEO.routes.recipe(r)));
});
test('Sitemap includes only canonical public pages; mirror has noindex and the home content exists before JavaScript',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'poum-seo-'));
 try{for(const mirror of [false,true]){const dir=path.join(root,mirror?'mirror':'live');fs.mkdirSync(dir);fs.copyFileSync('index.html',path.join(dir,'index.html'));const result=SEO.writeSEO(dir,{mirror});const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert.match(html,/<h1>Enceinte, je peux en manger \?<\/h1>/);assert.match(html,/Mozzarella/);assert.match(html,/<div id="app"><div class="seo-fallback">/);assert.ok(!html.includes('initial-loader'));assert.ok(graphs(html).some(n=>n['@type']==='WebSite'&&n.name==='Poum'));
 if(mirror){assert.match(html,/name="robots" content="noindex,follow"/);assert.ok(!fs.existsSync(path.join(dir,'sitemap.xml')));assert.ok(html.includes('href="https://poum.app/aliments/"'));}
 else{const sitemap=fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8');const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.equal(urls.length,result.pages);assert.equal(new Set(urls).size,urls.length);for(const url of urls){assert.equal(new URL(url).origin,'https://poum.app');assert.equal(new URL(url).hash,'');assert.equal(new URL(url).search,'');assert.ok(fs.existsSync(path.join(dir,new URL(url).pathname,'index.html')));}assert.ok(!sitemap.includes('lastmod'));assert.match(fs.readFileSync(path.join(dir,'robots.txt'),'utf8'),/Sitemap: https:\/\/poum.app\/sitemap.xml/);assert.match(fs.readFileSync(path.join(dir,'404.html'),'utf8'),/noindex,follow/);}
 }}finally{fs.rmSync(root,{recursive:true,force:true});}
});
