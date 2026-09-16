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
   return route.fulfill({json:{configured:true,mode:'live',access:{active:signedIn&&(mode==='plus'||mode==='auto'&&realPaid),plan:mode==='plus'?'preview':realPaid?'pass':null},preview:{eligible:allowed&&signedIn&&verified,mode:signedIn?mode:'auto',requiresVerification:allowed&&signedIn&&!verified},signedIn,canManage:false}});
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
 await expect(page.locator('.member-panel')).toContainText('Mode test Plus actif');await expect(page.locator('.member-panel')).not.toContainText('Période payée jusqu’au');expect(state.mode()).toBe('plus');
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

test('An unverified owner sees a confirmation action instead of a Plus switch',async({page})=>{await mock(page,{verified:false});await page.goto('/#plus');await expect(page.getByRole('button',{name:'Confirmer mon e-mail'})).toBeVisible();await expect(page.getByRole('switch',{name:'Tester le mode Plus'})).toHaveCount(0)});

test('A paying owner can test free access and restore the actual paid entitlement',async({page})=>{await mock(page,{realPaid:true});await page.goto('/#plus');const toggle=page.getByRole('switch',{name:'Tester le mode Plus'});await expect(toggle).toHaveAttribute('aria-checked','true');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');await expect(page.locator('.j-offer-hero')).toBeVisible();await page.getByRole('button',{name:'Accès réel',exact:true}).click();await expect(toggle).toHaveAttribute('aria-checked','true');await expect(page.locator('.member-panel')).toBeVisible()});
