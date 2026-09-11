const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
test('Search landing pages and precautions are readable without JavaScript, including the homepage',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const page=await context.newPage();
 for(const [url,title]of [['/','Enceinte, je peux en manger ?'],['/aliments/mozzarella-enceinte/','Mozzarella enceinte'],['/aliments/ananas-enceinte/','Ananas enceinte'],['/aliments/patate-douce-enceinte/','Patate douce enceinte'],['/alimentation-grossesse/fromages-produits-laitiers/','Quels fromages'],['/recettes-grossesse/bowl-de-quinoa-douceur-d-avocat/','Bowl de quinoa']]){
  const response=await page.goto(url);expect(response.status()).toBe(200);await expect(page.locator('h1')).toHaveCount(1);await expect(page.locator('h1')).toContainText(title);await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','https://poum.app'+url);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await expect(page.locator('.seo-steps li')).toHaveCount(4);await expect(page.locator('.seo-sources a').first()).toHaveAttribute('href',/^https:\/\//);await context.close();
});
test('The directory searches all foods locally, and app dialogs link to the same public advice',async({page})=>{
 await page.goto('/aliments/');await expect(page.locator('[data-food-name]')).toHaveCount(360);await page.locator('#food-search').fill('anans');await expect(page.locator('[data-food-name]:visible')).toHaveCount(1);await page.locator('[data-food-name]:visible a').click();await expect(page).toHaveURL(/\/ananas-enceinte\/$/);await expect(page.locator('.seo-answer')).toContainText('Compatible');
 await page.goto('/#aliments?q=ananas');await page.locator('[data-action=food][data-id=pineapple]').click();await expect(page.locator('dialog a[href="/aliments/ananas-enceinte/"]')).toBeVisible();await page.locator('dialog a[href="/aliments/ananas-enceinte/"]').click();await expect(page.locator('h1')).toContainText('Ananas enceinte');
});
test('SEO pages have working assets, breadcrumbs and accessible mobile layouts',async({page})=>{
 await page.setViewportSize({width:320,height:740});
 for(const url of ['/aliments/mozzarella-enceinte/','/alimentation-grossesse/','/recettes-grossesse/bowl-de-quinoa-douceur-d-avocat/','/sources-et-methode/']){
  await page.goto(url);await expect(page.locator('.seo-breadcrumb [aria-current=page]')).toBeVisible();await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const results=await new AxeBuilder({page}).analyze();expect(results.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  expect(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.loading!=='lazy').every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 }
});
