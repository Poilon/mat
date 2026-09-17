const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const data=require('../js/data.js');
async function mock(page,{allowed=true,realPaid=false,verified=true}={}){
 let mode='auto',signedIn=true,downloads=0;
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/config')return route.fulfill({json:{accounts:true}});
  if(path==='/api/auth/get-session')return route.fulfill({json:signedIn?{user:{id:'owner',email:allowed?'poilon@gmail.com':'other@example.com',emailVerified:verified}}:null});
  if(path==='/api/auth/sign-out'){signedIn=false;return route.fulfill({json:{}})}
  if(path==='/api/notebook')return route.fulfill({json:{notebook:null,revision:0}});
  if(path==='/api/billing'){
   if(req.method()==='POST'){const body=req.postDataJSON();expect(body.action).toBe('preview');mode=body.mode}
   return route.fulfill({json:{configured:true,mode:'live',access:{active:signedIn&&(mode==='plus'||mode==='auto'&&realPaid),plan:mode==='plus'?'preview':realPaid?'pass':null},preview:{eligible:allowed&&signedIn,mode:signedIn?mode:'auto'},signedIn,canManage:false}});
  }
  if(path==='/api/recipes'){
   downloads++;if(mode!=='plus')return route.fulfill({status:402,json:{error:'Cette recette complète fait partie de Plus.'}});
   const recipe=data.recipes.find(r=>r.id===new URL(req.url()).searchParams.get('id'));return route.fulfill({json:{recipes:[recipe]}});
  }
  return route.fulfill({json:{}});
 });
 return {mode:()=>mode,downloads:()=>downloads};
}
test('Owner switches free and Plus, keeps the choice on reload, and returns to real access',async({page})=>{
 const state=await mock(page);await page.goto('/#plus');const toggle=page.getByRole('switch',{name:'Tester le mode Plus'});
 await expect(toggle).toHaveAttribute('aria-checked','false');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');
 await expect(page.locator('.member-panel')).toContainText('Mode admin Plus actif');await expect(page.locator('.member-panel')).not.toContainText('Période payée jusqu’au');expect(state.mode()).toBe('plus');
 await page.reload();await expect(toggle).toHaveAttribute('aria-checked','true');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');await expect(page.locator('.j-offer-hero')).toBeVisible();
 await page.getByRole('button',{name:'Accès réel',exact:true}).click();await expect(page.locator('.access-preview b')).toContainText('Accès réel');expect(state.mode()).toBe('auto');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const a=await new AxeBuilder({page}).include('#access-preview').analyze();expect(a.violations).toEqual([]);
 await page.goto('/#profil');await page.locator('[data-action=sign-out]').click();await expect(toggle).toHaveCount(0);
});
test('Switching to free restores recipe paywalls without deleting the Plus preview cache',async({page})=>{
 const state=await mock(page);await page.goto('/#recettes');const toggle=page.getByRole('switch',{name:'Tester le mode Plus'});await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');
 const open=async()=>{await page.locator('[data-action=recipe][data-id=pain-perdu-poire]').first().click()};
 await page.locator('#recipe-query').fill('Pain perdu');await page.locator('#recipe-search').press('Enter');await open();await expect(page.locator('.steps-list')).toBeVisible();await page.locator('[data-action=close-dialog]').click();
 await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');await open();await expect(page.locator('.recipe-paywall')).toContainText('Cette recette fait partie de Plus');await page.locator('[data-action=close-dialog]').click();
 await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');await open();await expect(page.locator('.steps-list')).toBeVisible();expect(state.downloads()).toBe(2);
});
test('Other accounts never see the testing switch',async({page})=>{await mock(page,{allowed:false});await page.goto('/#plus');await expect(page.locator('.j-offer-hero')).toBeVisible();await expect(page.getByRole('switch',{name:'Tester le mode Plus'})).toHaveCount(0)});

test('The signed-in owner can switch both modes without verifying email',async({page})=>{const state=await mock(page,{verified:false});await page.goto('/#plus');await expect(page.getByRole('button',{name:'Confirmer mon e-mail'})).toHaveCount(0);const toggle=page.getByRole('switch',{name:'Tester le mode Plus'});await expect(toggle).toHaveAttribute('aria-checked','false');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','true');expect(state.mode()).toBe('plus');await expect(page.locator('.access-preview')).toContainText('Mode admin');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');expect(state.mode()).toBe('free')});

test('A paying owner can test free access and restore the actual paid entitlement',async({page})=>{await mock(page,{realPaid:true});await page.goto('/#plus');const toggle=page.getByRole('switch',{name:'Tester le mode Plus'});await expect(toggle).toHaveAttribute('aria-checked','true');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');await expect(page.locator('.j-offer-hero')).toBeVisible();await page.getByRole('button',{name:'Accès réel',exact:true}).click();await expect(toggle).toHaveAttribute('aria-checked','true');await expect(page.locator('.member-panel')).toBeVisible()});

test('The home Plus feature opens an offer when free and an actual workshop when the owner switches to Plus',async({page})=>{
 const state=await mock(page);await page.goto('/#accueil');const feature=page.locator('.j-week-feature');await expect(feature).toBeVisible();await expect(feature).toContainText('Votre accès gratuit');await expect(feature).toContainText('Les nouvelles semaines nécessitent Plus');await expect(feature.locator('.j-week-unlock')).toBeVisible();expect(await feature.evaluate(el=>el.previousElementSibling.classList.contains('j-welcome'))).toBe(true);
 await feature.locator('.j-week-unlock').click();await expect(page.locator('.offer-dialog')).toBeVisible();expect(state.downloads()).toBe(0);await page.keyboard.press('Escape');
 const toggle=page.getByRole('switch',{name:'Tester le mode Plus'});await toggle.click();await expect(page.locator('.j-week-feature')).toHaveCount(0);await expect(page.locator('.j-week-member')).toContainText('Accès ouvert');await expect(page.locator('.j-week-member a')).toHaveAttribute('href','#atelier');const scan=page.locator('.j-scan-feature');await expect(scan).toContainText('précautions grossesse repérées');await scan.getByRole('button',{name:'Scanner un produit'}).click();await expect(page.locator('#barcode-input')).toBeVisible();await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scannerAxe=await new AxeBuilder({page}).include('.j-scan-feature').analyze();expect(scannerAxe.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);await toggle.click();await expect(scan).toHaveCount(0);await expect(feature).toBeVisible();await expect(page.locator('.j-week-member')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const a=await new AxeBuilder({page}).include('.j-week-feature').analyze();expect(a.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
});
test('A guest sees a labelled preview, a free trial, and no generated premium data',async({page})=>{
 let generations=0;await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;if(path==='/api/config')return r.fulfill({json:{accounts:true}});if(path==='/api/auth/get-session')return r.fulfill({json:null});if(path==='/api/billing')return r.fulfill({json:{configured:true,mode:'live',access:{active:false},signedIn:false}});if(path==='/api/menus'||path==='/api/recipes')generations++;return r.fulfill({json:{}})});
 await page.setViewportSize({width:320,height:740});await page.goto('/#accueil');const f=page.locator('.j-week-feature');await expect(f).toContainText('Exemple de présentation');await expect(f).toContainText('29,90 € pour 9 mois');await expect(f).toContainText('20 recettes complètes');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(generations).toBe(0);await f.locator('.j-week-trial').click();await expect(page).toHaveURL(/#atelier/);await expect(page.locator('.workshop-page')).toBeVisible();
});

test('Free scanning opens a paid offer, ignores old barcode cache, and opens only with Plus',async({page})=>{
 await mock(page);let products=0;await page.route('**/api/products?**',r=>{products++;return r.fulfill({json:{products:[{code:'3017620422003',product_name:'Produit scanné',ingredients_text:'Sucre',categories_tags:['en:foods']}],count:1,page:1}})});
 await page.addInitScript(()=>localStorage.setItem('miette-off-cache-v1',JSON.stringify({'barcode:3017620422003':{schema:2,at:Date.now(),data:{products:[{code:'3017620422003',product_name:'Ancien scan en cache'}],count:1}}})));
 await page.goto('/#accueil');await expect(page.getByRole('switch',{name:'Tester le mode Plus'})).toBeVisible();await page.locator('[data-action=scan]').first().click();await expect(page.locator('#dialog-title')).toHaveText('Le scan fait partie de Poum Plus.');await expect(page.locator('#barcode-input')).toHaveCount(0);await expect(page.locator('.offer-dialog')).toContainText('n’inclut pas le scan');await expect(page.locator('.offer-dialog [data-action=plus-preview]')).toHaveCount(0);expect(products).toBe(0);await page.keyboard.press('Escape');
 await page.goto('/#aliments?source=off&q=3017620422003');await expect(page.locator('#off-results')).toContainText('Le code-barres, avec Poum Plus');await expect(page.locator('.food-card')).toHaveCount(0);expect(products).toBe(0);
 const toggle=page.getByRole('switch',{name:'Tester le mode Plus'});await toggle.click();await expect(page.locator('.food-card')).toContainText('Produit scanné');expect(products).toBe(1);
 await page.locator('[data-action=scan]').first().click();await expect(page.locator('#barcode-input')).toBeVisible();await page.keyboard.press('Escape');await toggle.click();await expect(page.locator('#off-results')).toContainText('Le code-barres, avec Poum Plus');await expect(page.locator('.food-card')).toHaveCount(0);
 await page.goto('/#aliments?source=off&q=chocolat');await expect(page.locator('.food-card')).toHaveCount(1);expect(products).toBe(2);
});
