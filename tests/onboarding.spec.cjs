const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {empty}=require('../js/notebook.js');
const D=require('../js/data.js'),Diet=require('../js/diet.js');
async function local(page){await page.route('**/api/config',r=>r.fulfill({json:{accounts:false}}));}
async function begin(page){await page.goto('/#bienvenue');await page.locator('[data-action="ob-start"]').click();}

test('A first visit offers an optional illustrated onboarding and skipping keeps the guide accessible',async({page})=>{
 await local(page);await page.goto('/');await page.getByRole('link',{name:'Votre premier repas avec Poum'}).click();
 await expect(page.locator('#ob-title')).toContainText('Enceinte.');await expect(page.locator('#sidebar')).toBeHidden();
 await page.locator('.ob-exit').click();await expect(page.locator('#home-search')).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('miette-notebook-v1')||'{}').diet?.completed||false)).toBe(false);
});

test('Choices and allergy consent lead to a real free recipe and persist after reload',async({page})=>{
 await local(page);await begin(page);await page.locator('[name="mood"][value="color"]').check();await page.locator('#ob-form [type="submit"]').click();
 await page.locator('[name="allergy"][value="gluten"]').check();await page.locator('#ob-avoid').fill('coriandre');await page.locator('#ob-form [type="submit"]').click();
 await expect(page.locator('#ob-feedback')).toContainText('accord');await expect(page.locator('#ob-consent')).toBeFocused();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('miette-notebook-v1')||'{}').diet)).toBeUndefined();
 await page.locator('#ob-consent').check();await page.locator('#ob-form [type="submit"]').click();await expect(page.locator('.ob-recipe')).toBeVisible();
 const id=await page.locator('.ob-recipe [data-action="recipe"]').getAttribute('data-id');expect(id).toBe('sunny-bowl');
 const diet=await page.evaluate(()=>JSON.parse(localStorage.getItem('miette-notebook-v1')).diet);expect(diet.allergies).toEqual(['gluten']);expect(Diet.allows(D.recipes.find(r=>r.id===id),diet)).toBe(true);
 await page.locator('.ob-recipe [data-action="recipe"]').click();await expect(page.locator('.cooking-prep')).toBeVisible();await expect(page.locator('.recipe-paywall')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.goto('/#profil');await page.reload();await expect(page.locator('#profile-allergy-gluten')).toBeChecked();await page.goto('/#envies');await expect(page.locator('#craving-avoid')).toHaveValue('coriandre');
});

test('Returning keeps choices, and restrictive exclusions never produce an incompatible meal',async({page})=>{
 await local(page);await begin(page);await page.locator('[name="time"][value="20"]').check();await page.locator('#ob-form [type="submit"]').click();await page.locator('[name="allergy"][value="gluten"]').check();await page.locator('[data-action="ob-back"]').click();await expect(page.locator('[name="time"][value="20"]')).toBeChecked();await page.locator('#ob-form [type="submit"]').click();await expect(page.locator('[name="allergy"][value="gluten"]')).toBeChecked();await page.locator('#ob-consent').check();await page.locator('#ob-form [type="submit"]').click();await expect(page.locator('.ob-recipe')).toHaveCount(0);await expect(page.locator('[data-action="ob-adjust"]')).toBeVisible();
});

test('Mobile onboarding has no overflow or serious accessibility errors at any step',async({page})=>{
 await local(page);await page.setViewportSize({width:320,height:850});await page.goto('/#bienvenue');
 for(let step=0;step<4;step++){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const audit=await new AxeBuilder({page}).analyze();expect(audit.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
  if(step===0)await page.locator('[data-action="ob-start"]').click();else if(step<3)await page.locator('#ob-form [type="submit"]').click();
 }
});

test('Existing account allergies are loaded before starting and unsaved choices survive background sync',async({page})=>{
 const user={id:'onboarding-account',name:'Camille'},notebook={...empty(),diet:{...empty().diet,allergies:['gluten'],consent:true,completed:true}};let remote={notebook,revision:1};
 await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;if(path==='/api/config')return r.fulfill({json:{accounts:true}});if(path==='/api/auth/get-session')return r.fulfill({json:{user,session:{expiresAt:'2099-01-01'}}});if(path==='/api/notebook'){if(r.request().method()==='PUT')remote={notebook:r.request().postDataJSON().notebook,revision:remote.revision+1};return r.fulfill({json:remote});}return r.fulfill({status:404,json:{error:'Test'}});});
 await page.goto('/#bienvenue');await expect.poll(()=>page.evaluate(()=>MietteCloud.state.status)).toBe('synced');await page.locator('[data-action="ob-start"]').click();await page.locator('#ob-form [type="submit"]').click();await expect(page.locator('[name="allergy"][value="gluten"]')).toBeChecked();
 await page.locator('[name="allergy"][value="milk"]').check();remote={notebook:{...notebook,name:'Camille'},revision:2};await page.evaluate(()=>MietteCloud.sync());await expect(page.locator('[name="allergy"][value="milk"]')).toBeChecked();await page.locator('#ob-form [type="submit"]').click();await page.evaluate(()=>MietteCloud.sync());expect(remote.notebook.diet.allergies).toEqual(['gluten','milk']);await expect(page.locator('#ob-save-status')).toContainText('synchronisées');
 await page.reload();await page.locator('[data-action="ob-start"]').click();await page.locator('#ob-form [type="submit"]').click();await expect(page.locator('[name="allergy"][value="milk"]')).toBeChecked();
 remote={notebook:{...remote.notebook,diet:{...remote.notebook.diet,allergies:['milk']}},revision:remote.revision+1};await page.evaluate(()=>MietteCloud.sync());await page.locator('#ob-form [type="submit"]').click();await expect(page.locator('#ob-feedback')).toContainText('changé ailleurs');expect(remote.notebook.diet.allergies).toEqual(['milk']);await page.locator('[data-action="ob-reload"]').click();await expect(page.locator('[name="allergy"][value="gluten"]')).not.toBeChecked();
 user.id='another-onboarding-account';remote={notebook:empty(),revision:0};await page.evaluate(()=>MietteCloud.refreshSession());await expect(page.locator('#ob-title')).toContainText('Enceinte.');await page.locator('[data-action="ob-start"]').click();await page.locator('#ob-form [type="submit"]').click();await expect(page.locator('[name="allergy"][value="milk"]')).not.toBeChecked();await expect(page.locator('#ob-consent')).not.toBeChecked();
});
