/* Shared exclusion rules. These filter recipe descriptions, not product labels or cross-contact. */
(root=>{
 'use strict';
 const frenchDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'});
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').toLowerCase();
 const allergens=[
  ['gluten','Gluten (blé, orge, seigle, avoine…)',/gluten|\bble\b|orge|seigle|avoine|epeautre|semoule|boulgour|couscous|pates|orzo|lasagne|pain|farine(?! de (?:riz|mais|sarrasin|pois))|udon|soba|gnocchi|tortilla|macaroni|muffin|sauce soja/],
  ['milk','Lait',/\blait\b|lactose|caseine|beurre|creme|yaourt|yogourt|fromage|ricotta|parmesan|comte|mozzarella|feta|burrata|emmental|cheddar|skyr|halloumi|mascarpone|pesto/],
  ['eggs','Œufs',/oeuf|ovalbumine|albumine|mayonnaise|pates|orzo|lasagne|gnocchi|pate (?:brisee|feuilletee)|muffin anglais/],
  ['peanut','Arachides',/arachide|cacahuete/],
  ['nuts','Fruits à coque',/fruits? a coque|amande|noisette|\bnoix\b(?! de coco)|cajou|pecan|pistache|macadamia|pesto|pralin/],
  ['soy','Soja',/soja|tofu|miso|edamame|tempeh|sauce soja/],
  ['fish','Poisson',/poisson|saumon|cabillaud|truite|thon|sardine|anchois|colin|merlu|lieu noir|nuoc|dashi|pate de curry/],
  ['shellfish','Crustacés',/crustace|crevette|crabe|homard|langoust|gambas|pate de curry/],
  ['molluscs','Mollusques',/mollusque|moule|huitre|calamar|seiche|poulpe|saint.jacques|palourde|bulot/],
  ['sesame','Sésame',/sesame|tahini|tahin\b|zaatar/],
  ['celery','Céleri',/celeri|bouillon|fond de|curry|colombo|ras.el.hanout|cajun/],
  ['mustard','Moutarde',/moutarde|curry|colombo|ras.el.hanout|cajun/],
  ['lupin','Lupin',/lupin/],
  ['sulphites','Sulfites',/sulfite|soufre|e22[0-8]|vinaigre|moutarde|raisins secs|abricots secs|pruneaux|jus .*bouteille/]
 ].map(([id,label,pattern])=>({id,label,pattern}));
 function clean(raw={}){raw=raw&&typeof raw==='object'?raw:{};return {allergies:Array.isArray(raw.allergies)?[...new Set(raw.allergies.filter(id=>allergens.some(a=>a.id===id)))]:[],otherAllergies:typeof raw.otherAllergies==='string'?raw.otherAllergies.trim().slice(0,240):'',avoid:typeof raw.avoid==='string'?raw.avoid.trim().slice(0,240):'',completed:raw.completed===true,consent:raw.consent===true,temporary:{text:typeof raw.temporary?.text==='string'?raw.temporary.text.trim().slice(0,240):'',until:/^\d{4}-\d{2}-\d{2}$/.test(raw.temporary?.until||'')?raw.temporary.until:''}};}
 function validate(raw){if(raw===undefined)return clean();if(!raw||Array.isArray(raw)||typeof raw!=='object'||!Array.isArray(raw.allergies)||raw.allergies.length>14||raw.allergies.some(id=>!allergens.some(a=>a.id===id))||['avoid','otherAllergies'].some(k=>typeof raw[k]!=='string'||raw[k].length>240)||typeof raw.consent!=='boolean'||typeof raw.completed!=='boolean')throw Error('Vérifiez vos préférences alimentaires.');if(raw.temporary!==undefined&&(!raw.temporary||typeof raw.temporary.text!=='string'||raw.temporary.text.length>240||typeof raw.temporary.until!=='string'||(raw.temporary.until&&!/^\d{4}-\d{2}-\d{2}$/.test(raw.temporary.until))))throw Error('Vérifiez vos envies du moment.');const d=clean(raw);if((d.allergies.length||d.otherAllergies)&&!d.consent)throw Error('Pour enregistrer vos allergies et filtrer les recettes, cochez votre accord ou retirez ces informations.');return d;}
 const terms=s=>normalize(s).split(/[,;\n]+/).map(s=>s.trim().replace(/s$/,'')).filter(Boolean);
 function reasons(recipe,raw){const d=clean(raw),ingredients=normalize((recipe.ingredients||[]).map(i=>i.name).join(' ')),declared=normalize(recipe.allergens),text=ingredients+' '+declared,result=[];
  // A missing declaration or an unspecified sauce cannot establish an exclusion.
  const allergyText=text.replace(/lait de coco|lait d.amande|lait d.avoine|lait de riz/g,'boisson vegetale');
  const uncertain=!recipe.allergens||/sauce (?:du commerce|preparee)|melange d.epices non precise/i.test(ingredients);
  for(const a of allergens)if(d.allergies.includes(a.id)&&(uncertain||a.pattern.test(allergyText)))result.push(a.label);
  for(const t of terms(d.otherAllergies))if(uncertain||text.includes(t))result.push(t);
  for(const t of terms([d.avoid,temporary(d)].filter(Boolean).join(', '))){const group=t==='poisson'?allergens.find(a=>a.id==='fish').pattern:t==='fromage'?/fromage|ricotta|parmesan|comte|mozzarella|feta|burrata|emmental|cheddar|halloumi|mascarpone/:t==='champignon'?/champignon|shiitake/:null;if(ingredients.includes(t)||group?.test(ingredients))result.push(t);}
  return [...new Set(result)];
 }
 const allows=(r,d)=>reasons(r,d).length===0;
 function temporary(raw,at=frenchDate.format(Date.now())){const t=clean(raw).temporary;return t.text&&(!t.until||t.until>=at)?t.text:'';}
 function merge(a,b){a=clean(a);b=clean(b);const active=[a,b].filter(d=>temporary(d));const expiry=active.map(d=>d.temporary.until).filter(Boolean).sort()[0]||'';return clean({...a,allergies:[...a.allergies,...b.allergies],otherAllergies:[a.otherAllergies,b.otherAllergies].filter(Boolean).join(', '),avoid:[a.avoid,b.avoid].filter(Boolean).join(', '),temporary:{text:[temporary(a),temporary(b)].filter(Boolean).join(', ').slice(0,240),until:expiry},consent:a.consent||b.consent,completed:a.completed||b.completed});}
 const api={allergens,clean,validate,reasons,allows,merge,temporary};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PoumDiet=api;
})(typeof window!=='undefined'?window:globalThis);
