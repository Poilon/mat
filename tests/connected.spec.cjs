const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {empty}=require('../js/notebook.js');
async function mockAccount(page, remote, initialUser=null) {
  let user=initialUser;
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let data={};if(req.method()!=='GET')data=req.postDataJSON();
    if(path==='/api/config')return route.fulfill({json:{accounts:true,appURL:'http://localhost:4176'}});
    if(path==='/api/auth/get-session')return route.fulfill({json:user?{user,session:{expiresAt:'2099-01-01'}}:null});
    if(path==='/api/auth/sign-in/email'||path==='/api/auth/sign-up/email') {
      if(data.password==='incorrect')return route.fulfill({status:401,json:{code:'INVALID_EMAIL_OR_PASSWORD'}});
      user={id:data.email.startsWith('b@')?'account-b':'account-a',email:data.email,name:data.name||'Camille'};
      return route.fulfill({json:{user}});
    }
    if(path==='/api/auth/sign-out'){user=null;return route.fulfill({json:{success:true}})}
    if(path==='/api/auth/request-password-reset'||path==='/api/auth/reset-password')return route.fulfill({json:{success:true}});
    if(path==='/api/notebook') {
      if(!user)return route.fulfill({status:401,json:{error:'Connexion nécessaire'}});
      const row=remote[user.id]||{notebook:null,revision:0};
      if(req.method()==='PUT') {
        if(data.revision!==row.revision)return route.fulfill({status:409,json:{error:'Conflit',...row}});
        remote[user.id]={notebook:data.notebook,revision:row.revision+1,updatedAt:new Date().toISOString()};
      }
      return route.fulfill({json:remote[user.id]||row});
    }
    return route.fulfill({status:404,json:{error:'Inconnu'}});
  });
}
const user={id:'account-a',name:'Camille',email:'a@example.com'};
async function login(page,email='a@example.com',includeGuest=true) {
  await page.goto('/#profil');await expect(page.locator('#auth-form')).toBeVisible();
  await page.locator('#auth-email').fill(email);await page.locator('#auth-password').fill('password-test-123');
  await page.locator('[name="import"]').setChecked(includeGuest);
  await page.locator('#auth-form [type="submit"]').click();
  await expect(page.locator('.account-email')).toContainText(email);
  await expect.poll(()=>page.evaluate(()=>MietteCloud.state.status)).toBe('synced');
}
test('Login errors are French, guest import is optional and accounts stay isolated',async({page})=>{
  const remote={};await mockAccount(page,remote);
  await page.addInitScript(()=>{if(!localStorage.getItem('seeded')){localStorage.setItem('miette-notebook-v1',JSON.stringify({name:'Invitée',vegetarian:false,favorites:['recipe:sunny-bowl'],products:[],menus:{},shopping:[]}));localStorage.setItem('seeded','1')}});
  await page.goto('/#profil');await expect(page.locator('#auth-form')).toBeVisible();
  await page.locator('#auth-email').fill('a@example.com');await page.locator('#auth-password').fill('incorrect');await page.locator('#auth-form [type="submit"]').click();
  await expect(page.locator('#auth-feedback')).toContainText('incorrect');
  await login(page);expect(remote['account-a'].notebook.name).toBe('Invitée');
  await page.locator('[data-action="sign-out"]').click();await expect(page.locator('#auth-form')).toBeVisible();
  await login(page,'b@example.com',false);await expect(page.locator('#profile-name')).toHaveValue('');
  expect(remote['account-b']?.notebook||null).toBe(null);
  await page.goto('/#favoris');await expect(page.locator('.recipe-card')).toHaveCount(0);
});
test('Registration validates passwords, recovery and reset remain usable',async({page})=>{
  const remote={};await mockAccount(page,remote);await page.goto('/#profil');
  await page.locator('[data-mode="signup"]').click();await page.locator('#auth-name').fill('Camille');await page.locator('#auth-email').fill('a@example.com');await page.locator('#auth-password').fill('password-test-123');await page.locator('#auth-confirm').fill('different-password');await page.locator('#auth-form [type="submit"]').click();
  await expect(page.locator('#auth-feedback')).toContainText('ne correspondent pas');
  await page.locator('#auth-confirm').fill('password-test-123');await page.locator('#auth-form [type="submit"]').click();await expect(page.locator('.account-email')).toBeVisible();
  await page.locator('[data-action="sign-out"]').click();await expect(page.locator('#auth-form')).toBeVisible();await page.locator('[data-mode="login"]').click();await page.locator('[data-mode="forgot"]').click();await page.locator('#auth-email').fill('a@example.com');await page.locator('#auth-form [type="submit"]').click();await expect(page.locator('#auth-feedback')).toContainText('e-mail de récupération');
  await page.goto('/?password-reset=1&token=test-reset-token#profil');await expect(page.locator('#auth-form')).toHaveAttribute('data-mode','reset');expect(new URL(page.url()).search).toBe('');
  await page.locator('#auth-password').fill('new-password-123');await page.locator('#auth-confirm').fill('new-password-123');await page.locator('#auth-form [type="submit"]').click();await expect(page.locator('#auth-form')).toHaveAttribute('data-mode','login');
});
test('Two devices synchronize independently added items and preserve offline changes',async({browser})=>{
  const remote={};const a=await browser.newContext(),b=await browser.newContext();const p=await a.newPage(),q=await b.newPage();
  await mockAccount(p,remote,user);await mockAccount(q,remote,user);await p.goto('/#courses');await q.goto('/#courses');
  await expect.poll(()=>p.evaluate(()=>MietteCloud.state.status)).toBe('synced');await expect.poll(()=>q.evaluate(()=>MietteCloud.state.status)).toBe('synced');
  await p.locator('#shopping-input').fill('Pommes');await p.locator('#shopping-add button').click();await p.evaluate(()=>MietteCloud.sync());
  await expect.poll(()=>remote['account-a']?.notebook.shopping.length).toBe(1);
  await q.evaluate(()=>MietteCloud.sync());await expect(q.locator('.shopping-item')).toContainText('Pommes');
  await b.setOffline(true);await q.locator('#shopping-input').fill('Poires');await q.locator('#shopping-add button').click();
  await p.locator('#shopping-input').fill('Carottes');await p.locator('#shopping-add button').click();await p.evaluate(()=>MietteCloud.sync());
  await expect.poll(()=>remote['account-a'].notebook.shopping.length).toBe(2);
  await b.setOffline(false);await expect.poll(()=>remote['account-a'].notebook.shopping.length).toBe(3);
  expect(remote['account-a'].notebook.shopping.map(i=>i.name).sort()).toEqual(['Carottes','Poires','Pommes']);
  await a.close();await b.close();
});
test('Competing profile edits require a visible choice before replacing the remote notebook',async({page})=>{
  const remote={'account-a':{notebook:{...empty(),name:'Initial'},revision:1}};await mockAccount(page,remote,user);await page.goto('/#profil');await expect(page.locator('#profile-name')).toHaveValue('Initial');
  await page.context().setOffline(true);await page.locator('#profile-name').fill('Local');await page.locator('#profile-form button').click();
  remote['account-a']={notebook:{...empty(),name:'Ailleurs'},revision:2};
  await page.context().setOffline(false);await expect(page.locator('.sync-conflict')).toBeVisible();expect(remote['account-a'].notebook.name).toBe('Ailleurs');
  await page.locator('[data-choice="remote"]').click();await expect(page.locator('#profile-name')).toHaveValue('Ailleurs');await expect.poll(()=>page.evaluate(()=>MietteCloud.state.status)).toBe('synced');
});
test('Notebook import requires confirmation and installation instructions are visible on mobile',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.goto('/#confidentialite');
  await page.locator('#notebook-file').setInputFiles({name:'carnet.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({application:'Miette',version:1,notebook:{...empty(),name:'Ancien carnet',favorites:['recipe:sunny-bowl']}}))});
  await expect(page.locator('dialog')).toContainText('1 favoris');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('miette-notebook-v1')||'null'))).toBe(null);
  await page.locator('[data-action="confirm-import"]').click();await page.goto('/#favoris');await expect(page.locator('.recipe-card')).toHaveCount(1);await page.goto('/#profil');await expect(page.locator('#profile-name')).toHaveValue('Ancien carnet');await expect(page.locator('.install-panel')).toContainText('Sur iPhone');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Account forms and scanner have no serious accessibility violations',async({page})=>{
  await mockAccount(page,{});await page.goto('/#profil');await expect(page.locator('#auth-form')).toBeVisible();
  for(const mode of ['login','signup','forgot']){await page.locator(`[data-mode="${mode}"]`).first().click();const r=await new AxeBuilder({page}).analyze();expect(r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);if(mode==='signup')await page.locator('[data-mode="login"]').first().click();}
  await page.goto('/');await page.locator('[data-action="scan"]').click();const r=await new AxeBuilder({page}).analyze();expect(r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)).toEqual([]);
});
test('Photo barcode decoding works without BarcodeDetector and the image stays local',async({page})=>{
  await page.addInitScript(()=>{window.BarcodeDetector=undefined});let calls=0;
  await page.route('**/api/products?**',route=>{calls++;expect(new URL(route.request().url()).searchParams.get('q')).toBe('3017620422003');return route.fulfill({json:{products:[{code:'3017620422003',product_name:'Test photo',ingredients_text:'Sucre, cacao'}],count:1,page:1}})});
  await page.goto('/');await page.locator('[data-action="scan"]').click();
  // An independently encoded EAN-13 fixture: standard L/G/R patterns and parity for leading 3.
  const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const code='3017620422003',parity='LLGGGL';let bits='101';for(let i=0;i<6;i++)bits+=(parity[i]==='L'?L:G)[+code[i+1]];bits+='01010';for(const digit of code.slice(7))bits+=L[+digit].replace(/[01]/g,c=>c==='0'?'1':'0');bits+='101';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="460" height="240"><rect width="460" height="240" fill="white"/>${[...bits].map((b,i)=>b==='1'?`<rect x="${40+i*4}" y="30" width="4" height="170" fill="black"/>`:'').join('')}</svg>`;
  await page.locator('#barcode-photo').setInputFiles({name:'barcode.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await expect(page.locator('.food-card')).toHaveCount(1);await expect(page.locator('.food-card')).toContainText('Test photo');expect(calls).toBe(1);
});

test('Fallback camera starts without BarcodeDetector and stops every track when closed',async()=>{
  const {chromium}=require('@playwright/test');
  const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({permissions:['camera'],serviceWorkers:'block'});
  const page=await context.newPage();await page.addInitScript(()=>{window.BarcodeDetector=undefined});
  await page.goto('http://localhost:4176/');await page.locator('[data-action="scan"]').click();await page.locator('[data-action="start-camera"]').click();
  await expect.poll(()=>page.evaluate(()=>Boolean(document.querySelector('video')?.srcObject?.active))).toBe(true);
  await page.evaluate(()=>{window.testTracks=document.querySelector('video').srcObject.getTracks()});await page.keyboard.press('Escape');
  await expect.poll(()=>page.evaluate(()=>window.testTracks.every(t=>t.readyState==='ended'))).toBe(true);await browser.close();
});

test('Deleting an account needs confirmation and retains the separate guest notebook',async({page})=>{
  const remote={};await mockAccount(page,remote,user);let deletes=0;
  await page.route('**/api/account',route=>{deletes++;if(route.request().postDataJSON().password!=='correct-password')return route.fulfill({status:400,json:{error:'Mot de passe incorrect'}});return route.fulfill({json:{deleted:true}})});
  await page.addInitScript(()=>localStorage.setItem('miette-notebook-v1',JSON.stringify({name:'Invitée',vegetarian:false,favorites:[],products:[],menus:{},shopping:[]})));
  await page.goto('/#profil');await expect(page.locator('.account-email')).toBeVisible();await page.goto('/#confidentialite');await page.locator('[data-action="delete-account"]').click();expect(deletes).toBe(0);
  await page.locator('#delete-password').fill('wrong-password');await page.locator('#delete-account-form [type="submit"]').click();await expect(page.locator('#delete-feedback')).toContainText('incorrect');
  await page.locator('#delete-password').fill('correct-password');await page.locator('#delete-account-form [type="submit"]').click();await expect(page.locator('dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>MietteCloud.state.user)).toBe(null);expect(await page.evaluate(()=>localStorage.getItem('miette-account-account-a'))).toBe(null);
  await page.goto('/#profil');await expect(page.locator('#profile-name')).toHaveValue('Invitée');
});
