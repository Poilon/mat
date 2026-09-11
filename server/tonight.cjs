'use strict';
const {createHash,randomBytes}=require('node:crypto');
const {HttpError}=require('./http.cjs');
const D=require('../js/data.js'),T=require('../js/tonight-rules.js');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const token=()=>randomBytes(32).toString('base64url');
function hash(value) { if(typeof value!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(value))throw new HttpError(404,'Ce lien de relais est invalide ou a été désactivé.');return createHash('sha256').update(value).digest('hex'); }
function mealView(row) {
  if(!row)throw new HttpError(404,'Ce dîner est introuvable ou le lien de relais a été désactivé.');
  const r=D.recipes.find(r=>r.id===row.recipe_id);
  if(!r)throw new HttpError(404,'Cette recette n’est plus disponible.');
  return {id:row.id,recipe:{id:r.id,title:r.title,image:r.image,time:r.time,ingredients:r.ingredients.map((i,index)=>({index,name:i.name,unit:i.unit,quantity:Number((i.quantity*row.servings/r.servings).toFixed(2))})),steps:r.steps,safety:r.safety,allergens:r.allergens,sources:(r.sources||['spf','toxo']).map(id=>D.sources[id])},servings:row.servings,checked:row.checked,status:row.status,revision:row.revision,createdAt:row.created_at,shared:Boolean(row.share_hash&&new Date(row.share_expires)>new Date()),shareExpires:row.share_expires||null};
}
async function operation(body,{repo,owner,paid=false}) {
  if(!body||typeof body!=='object')throw new HttpError(400,'La demande est illisible.');
  if(body.action==='shared-read'||body.action==='shared-patch') {
    const digest=hash(body.token),row=await repo.shared(digest);mealView(row);
    if(body.action==='shared-read')return {meal:mealView(row)};
    return {meal:mealView(await patch(repo,{hash:digest,id:row.id},row,body))};
  }
  const profile=await repo.profile(owner);
  if(body.action==='erase') { await repo.erase(owner); return {deleted:true}; }
  if(body.action==='state') {
    if(body.id&&!uuid(body.id))throw new HttpError(400,'Le dîner est invalide.');
    const id=body.id||profile.current_meal,row=id?await repo.meal(owner,id):null;
    if(body.id&&!row)throw new HttpError(404,'Ce dîner est introuvable.');
    return {meal:row?mealView(row):null,preferences:profile.preferences,trialUsed:Boolean(profile.trial_meal),paid,history:await repo.recent(owner)};
  }
  if(body.action==='suggest') {
    let prefs;try{prefs=T.preferences(body.preferences);}catch(e){throw new HttpError(400,e.message);}
    if(!Array.isArray(body.excluded||[])||(body.excluded||[]).length>100)throw new HttpError(400,'Relancez votre recherche de dîner.');
    await repo.preferences(owner,prefs);
    return {...T.suggestions(D.recipes,prefs,body.excluded),preferences:prefs};
  }
  if(body.action==='choose') {
    if(!uuid(body.requestId))throw new HttpError(400,'Relancez votre choix de dîner.');
    const previous=await repo.meal(owner,body.requestId);if(previous)return {meal:mealView(previous)};
    const prefs=T.preferences(profile.preferences),r=D.recipes.find(r=>r.id===body.recipeId);
    // Recheck all stored constraints without trusting the browser's proposed IDs.
    if(!r||!T.suggestions([r],prefs).total)throw new HttpError(400,'Cette recette ne correspond plus à vos préférences. Retrouvez de nouvelles idées.');
    return {meal:mealView(await repo.create(owner,body.requestId,r.id,prefs.servings,paid))};
  }
  if(!uuid(body.id))throw new HttpError(400,'Le dîner est invalide.');
  const row=await repo.meal(owner,body.id);mealView(row);
  if(body.action==='share') { const secret=token();return {meal:mealView(await repo.share(owner,row.id,hash(secret))),token:secret}; }
  if(body.action==='revoke')return {meal:mealView(await repo.revoke(owner,row.id))};
  if(body.action==='patch')return {meal:mealView(await patch(repo,{owner,id:row.id},row,body))};
  throw new HttpError(400,'Cette opération est inconnue.');
}
async function patch(repo,where,row,body) {
  if(body.field==='status') {
    if(!['planned','cooking','done'].includes(body.value))throw new HttpError(400,'Cet état est invalide.');
  }else {
    const recipe=D.recipes.find(r=>r.id===row.recipe_id);
    const ingredient=Number.isInteger(body.field)&&body.field>=0&&body.field<recipe.ingredients.length;
    const step=typeof body.field==='string'&&/^step:(0|[1-9][0-9]*)$/.test(body.field)&&Number(body.field.slice(5))<recipe.steps.length;
    if((!ingredient&&!step)||typeof body.value!=='boolean')throw new HttpError(400,'Cet ingrédient ou cette étape est invalide.');
  }
  return repo.patch(where,body.field,body.value);
}
module.exports={operation,mealView,hash,token};
