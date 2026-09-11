const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const D=require('../js/data.js'),Diet=require('../js/diet.js');
const {operation}=require('../server/tonight.cjs'),{memoryTonight}=require('./tonight-fixture.cjs');
test.beforeEach(async({page})=>{await page.route('**/api/config',r=>r.fulfill({json:{accounts:false}}));});
test('Cuisine filters combine with search, premium guides stay gated and free guides scale on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#recettes');await expect(page.locator('#recipe-count')).toContainText('1000');
 await page.locator('#recipe-cuisine').selectOption('Japon');await expect(page.locator('#recipe-count')).toContainText('40 recettes');
 await page.locator('#recipe-query').fill('udon');await expect(page.locator('#recipe-count')).toContainText('20 recettes');
 await page.route('**/api/recipes?**',r=>r.fulfill({status:401,json:{error:'Cette préparation est réservée à Plus.'}}));
 await page.locator('.recipe-card-open').first().click();await expect(page.locator('.recipe-paywall')).toBeVisible();await expect(page.locator('.cooking-prep')).toHaveCount(0);await expect(page.locator('.cooking-storage')).toBeVisible();await page.keyboard.press('Escape');
 await page.goto('/#recettes?q=pancakes+citron+ricotta');await page.locator('.recipe-card-open').click();await expect(page.locator('.cooking-prep')).toBeVisible();await page.locator('.cooking-cue summary').first().click();await expect(page.locator('.cooking-cue[open] p')).toBeVisible();
 await page.getByRole('button',{name:'Augmenter le nombre de portions'}).click();await expect(page.locator('.portion-note')).toContainText('3 personnes');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Profile exclusions persist and apply to browsing, menus, replacements and dinner ideas',async({page})=>{
 const repo=memoryTonight();await page.route('**/api/tonight',async r=>{try{const body=r.request().postDataJSON();await r.fulfill({json:await operation(body,{repo,owner:'diet-user',paid:true,diet:body.diet})});}catch(e){await r.fulfill({status:e.status||500,json:{error:e.message}});}});
 await page.goto('/#profil');await page.locator('[name="allergy"][value="milk"]').check();await page.locator('[name="allergy"][value="fish"]').check();await page.locator('#profile-avoid').fill('champignons, coriandre');
 await page.locator('#profile-form [type="submit"]').click();await expect(page.locator('#toasts')).toContainText('accord');
 await page.locator('[name="diet-consent"]').check();await page.locator('#profile-form [type="submit"]').click();await page.reload();await expect(page.locator('[name="allergy"][value="milk"]')).toBeChecked();
 const exclusions=await page.evaluate(()=>JSON.parse(localStorage.getItem('miette-notebook-v1')).diet);
 await page.goto('/#recettes');const ids=await page.locator('.recipe-card-open').evaluateAll(nodes=>nodes.map(n=>n.dataset.id));expect(ids.length).toBeGreaterThan(0);for(const id of ids)expect(Diet.allows(D.recipes.find(r=>r.id===id),exclusions)).toBe(true);
 await page.goto('/#atelier');await page.locator('#workshop-start').fill('2026-09-14');await page.locator('#workshop-time').selectOption('120');await page.locator('#workshop-form [type="submit"]').click();await expect(page.locator('.workshop-recipe')).toHaveCount(7);
 await page.locator('[data-action="workshop-swap"][data-index="0"]').click();await expect(page.locator('#workshop-feedback')).toContainText('nouvelle idée');
 for(const id of await page.locator('[data-action="workshop-recipe"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.id)))expect(Diet.allows(D.recipes.find(r=>r.id===id),exclusions)).toBe(true);
 await page.goto('/#cesoir');await page.locator('[name="maxTime"]').selectOption('120');await page.locator('#tonight-form [type="submit"]').click();await expect(page.locator('.dinner-choice')).toHaveCount(3);
 for(const id of await page.locator('[data-action="tonight-choose"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.id)))expect(Diet.allows(D.recipes.find(r=>r.id===id),exclusions)).toBe(true);
 await page.goto('/#profil');await page.locator('#profile-avoid').fill('champignons, coriandre, poulet');await page.locator('#profile-form [type="submit"]').click();await page.goto('/#atelier');await expect(page.locator('.workshop-dirty')).toBeVisible();await expect(page.locator('[data-action="workshop-save"]')).toBeDisabled();
});
test('Preferences remain readable and accessible on a small phone',async({page})=>{
 await page.setViewportSize({width:320,height:850});await page.goto('/#profil');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).analyze();expect(audit.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
});
