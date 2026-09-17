const test=require('node:test');const assert=require('node:assert/strict');const {fetchProducts}=require('../server/off.cjs');
const params={term:'yaourt nature',code:'',barcode:false,page:2};
test('A search outage falls back to the other official endpoint without restricting the country',async()=>{
  const urls=[],quotas=[];const result=await fetchProducts(params,{allowance:async(...args)=>quotas.push(args),fetchImpl:async url=>{urls.push(url);return urls.length===1?new Response('Unavailable',{status:503}):Response.json({products:[{code:'3017620422003'}],count:43})}});
  assert.equal(result.count,43);assert.equal(result.page,2);assert.equal(urls[1].hostname,'fr.openfoodfacts.org');assert.equal(urls[1].searchParams.get('cc'),'world');assert.equal(urls[1].searchParams.get('search_terms'),'yaourt nature');assert.equal(quotas.length,2);
  for(const field of ['traces_tags','conservation_conditions_fr','data_quality_errors_tags','last_modified_t'])assert(urls[0].searchParams.get('fields').split(',').includes(field));
});
test('Healthy upstream results need only one request and one shared quota entry',async()=>{
  let calls=0;const result=await fetchProducts(params,{fetchImpl:async()=>{calls++;return Response.json({products:[],count:0})}});assert.equal(calls,1);assert.deepEqual(result.products,[]);
});
test('Rate limiting is respected and never retried against the alternate endpoint',async()=>{
  let calls=0;await assert.rejects(fetchProducts(params,{fetchImpl:async()=>{calls++;return new Response('',{status:429})}}),e=>e.status===429);assert.equal(calls,1);
});
test('A timeout gets a fallback, but two outages return an actionable server error',async()=>{
  let calls=0;await assert.rejects(fetchProducts(params,{fetchImpl:async()=>{calls++;throw new DOMException('Timeout','TimeoutError')}}),e=>e.status===502);assert.equal(calls,2);
});
test('A missing barcode is an empty result, not an outage needing extra requests',async()=>{
  let calls=0;const result=await fetchProducts({...params,barcode:true,code:'3017620422003',page:1},{fetchImpl:async()=>{calls++;return new Response('',{status:404})}});assert.deepEqual(result,{products:[],count:0,page:1});assert.equal(calls,1);
});

test('Barcode endpoint authorizes before shared cache and never permits a free trial or missing billing configuration',async()=>{
 const {createProducts}=require('../api/products.js');let user=null,active=false,configured=true,upstream=0,checks=0;
 const app=createProducts({session:async()=>user?{user}:null,config:()=>({configured,live:true}),repo:()=>({access:async()=>{checks++;return {active}}}),quota:async()=>{},fetcher:async()=>{upstream++;return {products:[{code:'3017620422003'}],count:1,page:1}}});
 async function call(q='3017620422003',cookie=''){const headers={};let body;const res={setHeader:(k,v)=>headers[k]=v,end:t=>body=JSON.parse(t)};await app({method:'GET',url:'/api/products?q='+encodeURIComponent(q),headers:{host:'localhost:4176',cookie}},res);return {status:res.statusCode,headers,body}}
 let r=await call();assert.equal(r.status,401);assert.equal(r.body.code,'scan_premium');assert.equal(upstream,0);
 user={id:'member',email:'member@example.test'};r=await call();assert.equal(r.status,402);assert.equal(upstream,0);
 active=true;r=await call();assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(r.headers['Vercel-CDN-Cache-Control'],'no-store');assert.equal(upstream,1);
 active=false;r=await call();assert.equal(r.status,402);assert.equal(upstream,1);assert.equal(checks,3);
 user=null;r=await call();assert.equal(r.status,401);r=await call('yaourt');assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'public, max-age=60');
 configured=false;r=await call();assert.equal(r.status,503);assert.equal(r.headers['Vercel-CDN-Cache-Control'],'no-store');
});
test('Barcode access respects the authenticated owner preview and regular paid accounts',async()=>{
 const {createHash}=require('node:crypto'),{createProducts}=require('../api/products.js');let user={id:'owner',email:'poilon@gmail.com'},actual=false;
 const app=createProducts({session:async()=>({user}),config:()=>({configured:true,live:false}),repo:()=>({access:async()=>({active:actual})}),quota:async()=>{},fetcher:async()=>({products:[],count:0,page:1})});
 const call=async mode=>{const res={setHeader:()=>{},end:()=>{}};await app({method:'GET',url:'/api/products?q=3017620422003',headers:{host:'localhost:4176',cookie:'poum-access-preview='+createHash('sha256').update(user.id).digest('hex')+'.'+mode}},res);return res.statusCode};
 assert.equal(await call('plus'),200);actual=true;assert.equal(await call('free'),402);assert.equal(await call('auto'),200);user={id:'other',email:'other@example.test'};actual=false;assert.equal(await call('plus'),402);
});
