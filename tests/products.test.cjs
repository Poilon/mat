const test=require('node:test');const assert=require('node:assert/strict');const {fetchProducts}=require('../server/off.cjs');
const params={term:'yaourt nature',code:'',barcode:false,page:2};
test('A search outage falls back to the other official endpoint without restricting the country',async()=>{
  const urls=[],quotas=[];const result=await fetchProducts(params,{allowance:async(...args)=>quotas.push(args),fetchImpl:async url=>{urls.push(url);return urls.length===1?new Response('Unavailable',{status:503}):Response.json({products:[{code:'3017620422003'}],count:43})}});
  assert.equal(result.count,43);assert.equal(result.page,2);assert.equal(urls[1].hostname,'fr.openfoodfacts.org');assert.equal(urls[1].searchParams.get('cc'),'world');assert.equal(urls[1].searchParams.get('search_terms'),'yaourt nature');assert.equal(quotas.length,2);
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
