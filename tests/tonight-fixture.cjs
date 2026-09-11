const {HttpError}=require('../server/http.cjs');
function memoryTonight() {
  const profiles=new Map(),meals=new Map();
  return {profiles,meals,
    async profile(owner){if(!profiles.has(owner))profiles.set(owner,{preferences:{},trial_meal:null,current_meal:null});return structuredClone(profiles.get(owner));},
    async preferences(owner,p){profiles.get(owner).preferences=structuredClone(p);},
    async meal(owner,id){const r=meals.get(id);return r?.owner===owner?structuredClone(r):undefined;},
    async recent(owner){return [...meals.values()].filter(r=>r.owner===owner).reverse().map(({id,recipe_id,created_at,status})=>({id,recipe_id,created_at,status}));},
    async create(owner,id,recipe_id,servings,paid){const p=profiles.get(owner);if(p.trial_meal&&!paid)throw new HttpError(402,'Votre premier dîner est offert. Retrouvez les suivants avec Poum Plus.',{code:'tonight_premium'});const row={id,owner,recipe_id,servings,checked:{},status:'planned',revision:1,created_at:new Date().toISOString()};meals.set(id,row);p.trial_meal ||= id;p.current_meal=id;return structuredClone(row);},
    async shared(hash){const row=[...meals.values()].find(r=>r.share_hash===hash&&new Date(r.share_expires)>new Date());return row?structuredClone(row):undefined;},
    async share(owner,id,hash){const r=meals.get(id);if(r?.owner!==owner)return;Object.assign(r,{share_hash:hash,share_expires:new Date(Date.now()+30*86400000).toISOString(),revision:r.revision+1});return structuredClone(r);},
    async revoke(owner,id){const r=meals.get(id);if(r?.owner!==owner)return;r.share_hash=null;r.share_expires=null;r.revision++;return structuredClone(r);},
    async patch({owner,id,hash},field,value){const r=meals.get(id);if(!r||(hash?hash!==r.share_hash||new Date(r.share_expires)<=new Date():r.owner!==owner))return;if(field==='status')r.status=value;else r.checked[field]=value;r.revision++;return structuredClone(r);},
    async erase(owner){for(const [id,r]of meals)if(r.owner===owner)meals.delete(id);const p=profiles.get(owner);p.preferences={};p.current_meal=null;}
  };
}
module.exports={memoryTonight};
