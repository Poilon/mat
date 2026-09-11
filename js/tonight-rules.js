/* Shared catalogue filters. Preferences describe tastes, never medical exclusions. */
(root => {
  'use strict';
  const Diet=typeof module !== 'undefined' && module.exports ? require('./diet.js') : root.PoumDiet;
  const P = typeof module !== 'undefined' && module.exports ? require('./plus.js') : root.MiettePlus;
  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[œŒ]/g, 'oe').toLowerCase().trim();
  const moods = [{id:'all',label:'Surprends-moi'}, {id:'comfort',label:'Réconfortant'}, {id:'fresh',label:'Frais & coloré'}, {id:'pasta',label:'Des pâtes'}];
  function preferences(raw = {}) {
    if (!raw || typeof raw !== 'object') throw Error('Les préférences sont illisibles.');
    const maxTime = Number(raw.maxTime ?? 30), servings = Number(raw.servings ?? 2);
    if (![30,45,120].includes(maxTime) || !Number.isInteger(servings) || servings < 1 || servings > 6) throw Error('Choisissez un temps et entre 1 et 6 personnes.');
    if (typeof (raw.avoid ?? '') !== 'string' || (raw.avoid || '').length > 120) throw Error('Indiquez quelques ingrédients, séparés par des virgules (120 caractères maximum).');
    return { diet:Diet.validate(raw.diet), mood:moods.some(m=>m.id===raw.mood)?raw.mood:'all', maxTime, servings, vegetarian:raw.vegetarian===true, avoid:(raw.avoid||'').trim(), dislikes:P.dislikes.filter(d=>raw.dislikes?.includes(d.id)).map(d=>d.id), pantry:P.pantry.filter(d=>raw.pantry?.includes(d.id)).map(d=>d.id) };
  }
  function suggestions(recipes, raw, excluded = [], random = Math.random) {
    const prefs=preferences(raw), terms=prefs.avoid.split(/[,;\n]+/).map(normalize).filter(Boolean);
    const pool=recipes.filter(r=>Diet.allows(r,prefs.diet)&&['lunch','dinner'].includes(r.type)&&r.time<=prefs.maxTime&&(!prefs.vegetarian||r.vegetarian)&&!P.dislikes.some(d=>prefs.dislikes.includes(d.id)&&r.ingredients.some(i=>d.pattern.test(normalize(i.name))))&&!terms.some(t=>r.ingredients.some(i=>normalize(i.name).includes(t))));
    const ranked=pool.filter(r=>!excluded.includes(r.id)).map(r=>{
      const matches=P.pantryMatches(r,prefs.pantry);
      const mood=prefs.mood==='comfort'?['italie','four'].includes(r.collection):prefs.mood==='fresh'?r.collection==='bowls':prefs.mood==='pasta'?r.ingredients.some(i=>P.pantry[0].pattern.test(normalize(i.name))):false;
      return {recipe:r,score:matches.length*4+(mood?3:0)+random(),reason:matches.length?'Avec '+matches.map(m=>m.label.toLowerCase()).join(', '):mood?'Pour votre envie de '+(prefs.mood==='pasta'?'pâtes':prefs.mood==='comfort'?'réconfort':'couleur'):r.time+' minutes, dans le temps prévu'};
    }).sort((a,b)=>b.score-a.score);
    return { choices:ranked.slice(0,3).map(({recipe,reason})=>({id:recipe.id,reason})), total:pool.length, remaining:ranked.length>3 };
  }
  const api={preferences,suggestions,moods};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PoumTonightRules=api;
})(typeof window!=='undefined'?window:globalThis);
