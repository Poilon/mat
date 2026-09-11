const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../js/data.js'),Diet=require('../js/diet.js'),P=require('../js/plus.js'),Planner=require('../server/planner.cjs');
const {publicRecipe}=require('../server/recipe-access.cjs'),{validateNotebook}=require('../server/notebook.cjs'),N=require('../js/notebook.js');
const {operation}=require('../server/tonight.cjs'),{memoryTonight}=require('./tonight-fixture.cjs'),{randomUUID}=require('node:crypto');
const diet=overrides=>({...Diet.clean(),consent:true,completed:true,...overrides});
test('1000 stable recipes have distinct ingredient sets, detailed guides and broad international coverage',()=>{
 assert.equal(D.recipes.length,1000);
 const added=D.recipes.filter(r=>r.edition===3);
 for(const r of added)if(r.ingredients.some(i=>/lait uht|crème uht/i.test(i.name)))assert.match(r.allergens,/Lait/,r.id);
 assert.equal(added.length,900);
 assert.equal(new Set(added.map(r=>JSON.stringify(r.ingredients.map(i=>[i.name,i.quantity,i.unit]).sort()))).size,900);
 for(const country of ['Thaïlande','Chine','Japon','Sénégal','Afrique de l’Ouest','Maroc','Antilles','Pérou','Brésil','États-Unis','Canada','Grèce','Espagne'])assert(D.recipes.filter(r=>r.cuisine===country).length>=20,country);
 for(const r of D.recipes){assert.equal(r.guide.steps.length,r.steps.length,r.id);assert(r.guide.equipment.length&&r.guide.before.length,r.id);assert(r.storage.length>100);assert(r.ingredients.every(i=>Number.isFinite(i.quantity)&&i.quantity>0));const pub=publicRecipe(r);assert(pub.premium?pub.guide===null&&pub.steps.length===0:pub.guide.steps.length===pub.steps.length,r.id);}
});
test('Allergy exclusions include possible allergens and derivatives, while personal dislikes remain distinct',()=>{
 const sample=(name,allergens='Vérifiez les étiquettes.')=>({ingredients:[{name}],allergens});
 for(const [allergy,name] of [['milk','Parmesan'],['eggs','Mayonnaise'],['peanut','Purée de cacahuètes'],['soy','Sauce soja'],['gluten','Boulgour'],['fish','Colin'],['nuts','Pesto'],['sesame','Tahini'],['mustard','Colombo'],['celery','Bouillon'],['shellfish','Gambas'],['molluscs','Saint-Jacques'],['lupin','Farine de lupin'],['sulphites','Abricots secs']])assert(!Diet.allows(sample(name),diet({allergies:[allergy]})),allergy+' '+name);
 assert(!Diet.allows(sample('Pâtes de riz','Œuf possible selon le paquet'),diet({allergies:['eggs']})));
 assert(Diet.allows(sample('Lait de coco'),diet({allergies:['milk','nuts']})));
 assert(!Diet.allows(sample('Filet de colin'),diet({avoid:'poisson'})));
 assert(!Diet.allows(sample('Tomates cerises'),diet({avoid:'tomate'})));
 assert(!Diet.allows(sample('Kiwi'),diet({otherAllergies:'kiwis'})));
 assert(!Diet.allows({ingredients:[{name:'Riz'}]},diet({allergies:['milk']})),'missing declarations are not treated as safe');
});
test('Preferences survive notebook validation, export-shaped data and conflict-aware merging; recording allergies requires consent',()=>{
 const input={...N.empty(),diet:diet({allergies:['milk','eggs'],avoid:'coriandre',otherAllergies:'kiwi'})};
 assert.deepEqual(validateNotebook(input).diet,input.diet);
 assert.deepEqual(N.merge(N.empty(),input,N.empty()).notebook.diet,input.diet);
 const changed={...input,diet:diet({allergies:['fish']})};
 assert(N.merge(N.empty(),input,changed).conflicts.includes('diet'));
 assert.throws(()=>validateNotebook({...input,diet:{...input.diet,consent:false}}));
 assert.throws(()=>Diet.validate({...input.diet,allergies:['invented']}));
 assert.deepEqual(validateNotebook({...N.empty(),diet:undefined}).diet,Diet.clean());
});
test('Server composition, replacement and pinned meals respect account exclusions and fail instead of relaxing them',()=>{
 const options=P.preferences({start:'2026-09-14',maxTime:120,diet:diet({allergies:['milk','eggs','fish'],avoid:'champignons, coriandre'})});
 const entries=Planner.compose(D.recipes,options);
 for(const e of entries)assert(Diet.allows(D.recipes.find(r=>r.id===e.recipeId),options.diet));
 const swapped=Planner.swap(D.recipes,entries,0,options);assert(Diet.allows(D.recipes.find(r=>r.id===swapped[0].recipeId),options.diet));
 assert.throws(()=>Planner.compose(D.recipes,options,[{...entries[0],recipeId:'lemon-salmon',locked:true}]),/correspond plus/);
 assert.throws(()=>Planner.compose(D.recipes,{...options,diet:diet({avoid:'a, e, i, o, u'})}),/Il reste/);
});
test('Dinner choice rechecks current exclusions, keeps allergy data out of saved dinner preferences and private relay',async()=>{
 const repo=memoryTonight(),ctx={repo,owner:'allergic-owner',diet:diet({allergies:['milk'],otherAllergies:'kiwi'})};
 const result=await operation({action:'suggest',preferences:{maxTime:120}},ctx);
 assert(result.choices.length);
 for(const c of result.choices)assert(Diet.allows(D.recipes.find(r=>r.id===c.id),ctx.diet));
 assert(!JSON.stringify((await repo.profile(ctx.owner)).preferences).includes('kiwi'));
 await assert.rejects(operation({action:'choose',recipeId:'green-pasta',requestId:randomUUID()},ctx),e=>e.status===400);
 const {meal}=await operation({action:'choose',recipeId:result.choices[0].id,requestId:randomUUID()},ctx);
 assert(meal.recipe.guide.steps.length);
 const shared=await operation({action:'share',id:meal.id},ctx),read=await operation({action:'shared-read',token:shared.token},{repo});
 assert(!JSON.stringify(read).includes('allergic-owner'));assert(!JSON.stringify(read).includes('kiwi'));assert(!Object.hasOwn(read,'diet'));
});
