const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/preview.cjs');
const {readRecipe}=require('../server/recipe-access.cjs');
const {generateWeek}=require('../api/workshop.js');
const Plus=require('../js/plus.js');
const user={id:'owner',email:'poilon@gmail.com',emailVerified:false};
const request={headers:{host:'poum.app',cookie:''}};
function selected(mode,who=user){const headers={};const req=P.select(request,{setHeader:(k,v)=>headers[k]=v},who,mode);return {req,headers};}
test('Preview requires the authenticated owner without email verification and ignores preferences for other accounts',()=>{
 const {req,headers}=selected('plus');assert.deepEqual(P.preview(req,user),{eligible:true,mode:'plus'});
 for(const other of [null,{...user,id:'another'}, {...user,email:'someone@example.com'}]){
  assert.equal(P.preview(req,other).mode,'auto');
  if(other?.id!=='another')assert.throws(()=>selected('plus',other),e=>e.status===403);
 }
 assert.match(headers['Set-Cookie'],/HttpOnly; SameSite=Lax; Secure/);
 assert.throws(()=>selected('invalid'),e=>e.status===400);
 assert.equal(P.preview({headers:{cookie:'poum-access-preview=plus'}},user).mode,'auto');
 for(const emailVerified of [true,false,undefined]) assert.equal(P.preview(selected('plus',{...user,emailVerified}).req,{...user,emailVerified}).mode,'plus');
});
test('Preview changes only effective access and resetting restores real billing',async()=>{
 const actual={access:{active:true,plan:'pass',until:'2027-01-01'},canManage:true};
 const free=selected('free');assert.equal(P.status(free.req,user,actual).access.active,false);assert.equal(P.status(free.req,user,actual).canManage,false);
 assert.equal(actual.access.active,true);assert.equal(actual.canManage,true);
 const plus=selected('plus');assert.equal(P.status(plus.req,user,actual).access.plan,'preview');
 assert.throws(()=>P.requireRealMode(plus.req,user),e=>e.status===409);
 const headers={};const reset=P.select(plus.req,{setHeader:(k,v)=>headers[k]=v},user,'auto');
 assert.match(headers['Set-Cookie'],/Max-Age=0/);assert.equal(P.status(reset,user,actual).access,actual.access);P.requireRealMode(reset,user);
});
test('Recipe authorization follows both preview modes without changing another account',async()=>{
 const config={configured:true,live:true};const repo={access:async()=>({active:false})};const id='pain-perdu-poire';
 const paid=P.effectiveRepo(selected('plus').req,user,repo);
 assert.equal((await readRecipe(id,{config,user,repo:paid})).access,'plus');
 assert.equal((await paid.access('other',true)).active,false);
 await assert.rejects(readRecipe(id,{config,user,repo:P.effectiveRepo(selected('free').req,user,{access:async()=>({active:true})})}),e=>e.status===402);
 await assert.rejects(readRecipe(id,{config,user:{...user,email:'other@example.com'},repo:P.effectiveRepo(selected('plus').req,{...user,email:'other@example.com'},repo)}),e=>e.status===402);
});
test('Workshop Plus preview leaves the real free trial untouched and free preview restores its limit',async()=>{
 const input={action:'compose',options:Plus.preferences({start:'2026-09-21'}),entries:[]};let claims=0;
 const repo={access:async()=>({active:false}),trial:async()=> '2026-09-14',claimTrial:async()=>{claims++;return false}};
 const config={configured:true,live:true};const paid=P.effectiveRepo(selected('plus').req,user,repo);
 assert.equal((await generateWeek(input,{config,user,repo:paid})).entries.length,7);assert.equal(claims,0);
 await assert.rejects(generateWeek(input,{config,user,repo:P.effectiveRepo(selected('free').req,user,repo)}),e=>e.status===402);
});
