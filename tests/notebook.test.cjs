const test = require('node:test');
const assert = require('node:assert/strict');
const { empty, merge, same } = require('../js/notebook.js');
const { validateNotebook } = require('../server/notebook.cjs');
const { sessionCookies, publicSession } = require('../server/auth.cjs');
const { handler, readJSON } = require('../server/http.cjs');

test('Independent edits on two devices merge favorites, shopping and menus', () => {
  const base=empty(), local={...empty(),favorites:['recipe:sunny-bowl']}, remote={...empty(),menus:{'2026-09-09':{lunch:'dhal-coco'}},shopping:[{id:'milk',name:'Lait',quantity:1,unit:'l',checked:false}]};
  const result=merge(base,local,remote);
  assert.deepEqual(result.conflicts,[]);assert.deepEqual(result.notebook.favorites,local.favorites);assert.deepEqual(result.notebook.menus,remote.menus);assert.deepEqual(result.notebook.shopping,remote.shopping);
});
test('Deletion made offline is preserved alongside an unrelated remote addition', () => {
  const base={...empty(),favorites:['recipe:sunny-bowl']}, local=empty(), remote={...base,favorites:[...base.favorites,'recipe:dhal-coco']};
  assert.deepEqual(merge(base,local,remote).notebook.favorites,['recipe:dhal-coco']);
});
test('Competing menu choices and edit-versus-delete require an explicit decision', () => {
  const item={id:'milk',name:'Lait',quantity:1,unit:'l',checked:false};
  const base={...empty(),menus:{'2026-09-09':{lunch:'sunny-bowl'}},shopping:[item]};
  const local={...base,menus:{'2026-09-09':{lunch:'dhal-coco'}},shopping:[]};
  const remote={...base,menus:{'2026-09-09':{lunch:'lemon-salmon'}},shopping:[{...item,checked:true}]};
  assert.deepEqual(merge(base,local,remote).conflicts.sort(),['menu:2026-09-09:lunch','shopping:milk']);
});
test('Identical changes converge without a conflict despite object key order', () => {
  const a={...empty(),menus:{'2026-09-09':{lunch:'sunny-bowl',dinner:'dhal-coco'}}};
  const b={...a,menus:{'2026-09-09':{dinner:'dhal-coco',lunch:'sunny-bowl'}}};
  assert.equal(same(a,b),true);assert.deepEqual(merge(empty(),a,b).conflicts,[]);
});
test('Notebook validation rejects impossible dates, hostile keys, large values and duplicate items', () => {
  assert.deepEqual(validateNotebook(empty()),empty());
  const item={id:'a',name:'Lait',quantity:1,unit:'l',checked:false};
  for(const bad of [
    {...empty(),menus:{'2026-02-30':{lunch:'sunny-bowl'}}},
    {...empty(),menus:{'2026-99-99':{lunch:'sunny-bowl'}}},
    {...empty(),menus:{'2026-09-09':{__bad:'recipe'}}},
    {...empty(),favorites:['recipe:<script>']},
    {...empty(),shopping:[{...item,quantity:Infinity}]},
    {...empty(),shopping:[item,item]},
    {...empty(),name:'x'.repeat(31)}
  ]) assert.throws(()=>validateNotebook(bad),e=>e.status===400);
  assert.equal(validateNotebook({...empty(),user_id:'someone-else'}).user_id,undefined);
});
test('Authentication forwards only provider cookies and restores the local development prefix', () => {
  assert.equal(sessionCookies('tracking=abc; __Secure-neon-auth.session_token=secret; other=value'),'__Secure-neon-auth.session_token=secret');
  assert.equal(sessionCookies('neon-auth.session_token=secret',true),'__Secure-neon-auth.session_token=secret');
});
test('Session responses never expose bearer tokens or internal session details to JavaScript', () => {
  const clean=publicSession({token:'secret',user:{id:'1',email:'a@example.com',name:'A',emailVerified:true,internal:'secret'},session:{token:'secret',id:'secret',expiresAt:'tomorrow'}});
  assert.equal(JSON.stringify(clean).includes('secret'),false);assert.equal(clean.user.email,'a@example.com');
});
test('Notebook mutations reject absent and cross-origin request origins', async () => {
  for(const origin of [undefined,'https://evil.example']) {
    let body,called=false;const req={method:'PUT',headers:{host:'miette.example',origin}};
    const res={setHeader(){},end(value){body=JSON.parse(value)}};
    await handler(()=>{called=true})(req,res);
    assert.equal(res.statusCode,403);assert.equal(called,false);assert.ok(body.error);
  }
});
test('JSON requests enforce content type, byte limits and valid syntax', async () => {
  await assert.rejects(readJSON({headers:{'content-type':'text/plain'},body:'{}'}),e=>e.status===415);
  await assert.rejects(readJSON({headers:{'content-type':'application/json'},body:'x'.repeat(30)},20),e=>e.status===413);
  await assert.rejects(readJSON({headers:{'content-type':'application/json'},body:'{' }),e=>e.status===400);
});
