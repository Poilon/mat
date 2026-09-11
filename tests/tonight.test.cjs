const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const T=require('../js/tonight-rules.js'),D=require('../js/data.js'),{operation}=require('../server/tonight.cjs'),{memoryTonight}=require('./tonight-fixture.cjs');
const bad=status=>e=>e.status===status;
test('Dinner suggestions respect time, vegetarian tastes, textual dislikes, pantry priority and skipped meals',()=>{
 const p={maxTime:30,vegetarian:true,dislikes:['fish'],avoid:'coco',pantry:['zucchini']};
 const result=T.suggestions(D.recipes,p,[],()=>0);assert.equal(result.choices.length,3);assert(result.choices.some(c=>c.reason.includes('courgettes')));
 for(const c of result.choices){const r=D.recipes.find(r=>r.id===c.id);assert(r.vegetarian&&r.time<=30);assert(!r.ingredients.some(i=>/coco/i.test(i.name)));}
 assert(!T.suggestions(D.recipes,p,result.choices.map(c=>c.id)).choices.some(c=>result.choices.some(x=>x.id===c.id)));
 assert.throws(()=>T.preferences({servings:50}));assert.throws(()=>T.preferences({maxTime:1}));
 assert.equal(T.suggestions([],p).total,0);
});
test('First dinner is server-limited, retries are idempotent, paid members can choose again, old dinners stay readable',async()=>{
 const repo=memoryTonight(),owner='alice',ctx={repo,owner};await operation({action:'state'},ctx);await operation({action:'suggest',preferences:{maxTime:30,servings:4}},ctx);
 const requestId=randomUUID();const first=await operation({action:'choose',recipeId:'green-pasta',requestId},ctx);assert.equal(first.meal.servings,4);assert.deepEqual(first.meal.recipe.steps,D.recipes.find(r=>r.id==='green-pasta').steps);
 assert.equal((await operation({action:'choose',recipeId:'green-pasta',requestId},ctx)).meal.id,first.meal.id);
 await assert.rejects(()=>operation({action:'choose',recipeId:'green-pasta',requestId:randomUUID()},ctx),bad(402));
 await operation({action:'choose',recipeId:'green-pasta',requestId:randomUUID()},{...ctx,paid:true});
 assert.equal((await operation({action:'state',id:first.meal.id},ctx)).meal.id,first.meal.id);
 await assert.rejects(()=>operation({action:'choose',recipeId:'lemon-salmon',requestId:randomUUID()},{...ctx,paid:true}),bad(400));
});
test('A relay exposes only one dinner, permits scoped checks, and revocation or expiry blocks reads and writes',async()=>{
 const repo=memoryTonight(),ctx={repo,owner:'private-owner'};await operation({action:'suggest',preferences:{maxTime:30,avoid:'banane'}},ctx);
 const {meal}=await operation({action:'choose',recipeId:'green-pasta',requestId:randomUUID()},ctx);
 await assert.rejects(()=>operation({action:'share',id:meal.id},{repo,owner:'stranger'}),bad(404));
 const shared=await operation({action:'share',id:meal.id},ctx);const read=await operation({action:'shared-read',token:shared.token},{repo});
 assert(!JSON.stringify(read).includes('private-owner'));assert(!Object.hasOwn(read,'preferences'));assert(!Object.hasOwn(read.meal,'share_hash'));
 await operation({action:'shared-patch',token:shared.token,field:0,value:true},{repo});await operation({action:'shared-patch',token:shared.token,field:1,value:true},{repo});assert.deepEqual((await operation({action:'state'},ctx)).meal.checked,{'0':true,'1':true});
 await assert.rejects(()=>operation({action:'shared-patch',token:shared.token,field:999,value:true},{repo}),bad(400));
 await assert.rejects(()=>operation({action:'shared-patch',token:shared.token,field:'owner',value:'stranger'},{repo}),bad(400));
 const rotated=await operation({action:'share',id:meal.id},ctx);await assert.rejects(()=>operation({action:'shared-read',token:shared.token},{repo}),bad(404));
 repo.meals.get(meal.id).share_expires='2000-01-01';await assert.rejects(()=>operation({action:'shared-patch',token:rotated.token,field:0,value:false},{repo}),bad(404));
 const latest=await operation({action:'share',id:meal.id},ctx);await operation({action:'revoke',id:meal.id},ctx);await assert.rejects(()=>operation({action:'shared-read',token:latest.token},{repo}),bad(404));
 assert((await operation({action:'state'},ctx)).meal.recipe.steps.length>0);
});
test('Erasing dinners revokes links and clears preferences without resetting the free trial',async()=>{
 const repo=memoryTonight(),ctx={repo,owner:'alice'};await operation({action:'suggest',preferences:{maxTime:30,avoid:'banane'}},ctx);const {meal}=await operation({action:'choose',recipeId:'green-pasta',requestId:randomUUID()},ctx);const shared=await operation({action:'share',id:meal.id},ctx);await operation({action:'erase'},ctx);const s=await operation({action:'state'},ctx);assert.equal(s.meal,null);assert.equal(s.trialUsed,true);assert.deepEqual(s.preferences,{});await assert.rejects(()=>operation({action:'shared-read',token:shared.token},{repo}),bad(404));
});
