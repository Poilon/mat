window.PoumTonight = (() => {
  'use strict';
  const T=window.PoumTonightRules,P=window.MiettePlus,D=window.MietteData,V=window.PoumDinnerView,{esc}=V;
  function create(host) {
    let owner,epoch=0,activity=0,state={},busy=false,feedback='',view='form',choices=[],excluded=[],remaining=false,shareURL='',shareMessage='',selectedId=null,pendingChoice=null,loaded=false,loading=false;
    const key=()=> 'poum-tonight-v1:'+owner;
    function ensure() {
      const next=host.owner();if(next===owner)return false;
      owner=next;epoch++;busy=false;loaded=false;loading=false;feedback='';shareURL='';selectedId=null;choices=[];excluded=[];pendingChoice=null;
      try{state=JSON.parse(localStorage.getItem(key())||'null')||{};}catch{state={};}
      state.paid=false;view=state.meal?'meal':'form';return true;
    }
    function save() { try{localStorage.setItem(key(),JSON.stringify({preferences:state.preferences,meal:state.meal,trialUsed:state.trialUsed,history:state.history}));}catch{} }
    function redraw(focus) {
      const root=document.querySelector('#tonight-page');if(root){root.innerHTML=content();if(focus)root.querySelector(focus)?.focus({preventScroll:true});}
      const home=document.querySelector('[data-tonight-home]');if(home)home.outerHTML=homeCard();
    }
    function acceptMeal(m) {
      if(!m)return;
      if(state.meal?.id===m.id&&state.meal.revision>m.revision)return;
      state.meal=m;save();
      const sheet=document.querySelector('#tonight-page .dinner-sheet');if(sheet)V.sync(sheet,m);
      const title=document.querySelector('[data-dinner-heading]');if(title)title.textContent='Votre dîner';
      const home=document.querySelector('[data-tonight-home]');if(home)home.outerHTML=homeCard();
    }
    async function request(body) {
      if(window.MietteRuntime?.cloud===false)throw Error('Retrouvez Ce soir sur poum.app pour synchroniser le dîner.');
      if(!host.ready())throw Error('La connexion à votre espace est en cours. Réessayez dans un instant.');
      const current=epoch;
      const result=await host.request({...body,diet:window.PoumDiet.clean(host.diet?.())});
      if(current!==epoch)throw Error('Le compte a changé. Retrouvez votre dîner depuis Ce soir.');
      return result;
    }
    async function refresh(initial=false) {
      ensure();if(busy||loading||!host.ready()||window.MietteRuntime?.cloud===false)return;
      loading=true;
      const ticket=epoch,actionTicket=activity;
      try{
        const result=await request({action:'state',...(selectedId?{id:selectedId}:{})});if(ticket!==epoch||actionTicket!==activity)return;
        if(!result||!Object.hasOwn(result,'trialUsed'))throw Error('Les dîners ne sont pas disponibles pour le moment.');
        const changed=state.meal?.id!==result.meal?.id;
        const previous=state.meal;state={...state,...result};
        if(previous&&result.meal&&previous.id===result.meal.id&&previous.revision>result.meal.revision)state.meal=previous;
        loaded=true;if(initial){view=state.meal?'meal':'form';feedback='';}
        const unlocked=view==='paywall'&&state.paid;if(unlocked)view='form';
        save();if(initial||changed||unlocked)redraw();else if(state.meal)acceptMeal(state.meal);
      }catch(e){if(ticket!==epoch)return;if(initial){feedback=e.message;redraw();}else {const el=document.querySelector('[data-dinner-sync]');if(el)el.textContent='Synchronisation interrompue. Réessayez avec une connexion.';}return;}finally{if(ticket===epoch)loading=false;}
      const el=document.querySelector('[data-dinner-sync]');if(el)el.textContent='Courses et préparation synchronisées.';
    }
    function homeCard() {
      ensure();const r=state.meal?.recipe;
      return `<a class="home-shortcut" data-tonight-home href="#cesoir"><span><strong>${r?'Retrouver mon dîner':'Une idée pour ce soir'}</strong><small>${r?esc(r.title):'Trois propositions selon vos goûts.'}</small></span><span aria-hidden="true">→</span></a>`;
    }
    function chips(items,selected,name) {return `<div class="dinner-chips">${items.map(i=>`<label><input type="checkbox" name="${name}" value="${i.id}" ${selected.includes(i.id)?'checked':''}><span>${esc(i.label)}</span></label>`).join('')}</div>`;}
    function form() {
      let o;try{o=T.preferences(state.preferences||{vegetarian:host.vegetarian()});}catch{o=T.preferences();}
      return `<div class="dinner-heading"><span class="section-kicker">À votre rythme</span><h1>Qu’est-ce qui vous ferait plaisir ?</h1><p>Quelques choix, et on trouve une idée pour ce soir.</p></div><form id="tonight-form" class="dinner-form"><p class="preference-note">Les exclusions de <a href="#profil">votre profil</a> sont appliquées à ces idées. Vérifiez les étiquettes et les traces.</p><fieldset><legend>Une envie ?</legend><div class="dinner-moods">${T.moods.map(m=>`<label><input type="radio" name="mood" value="${m.id}" ${o.mood===m.id?'checked':''}><span>${m.label}</span></label>`).join('')}</div></fieldset><div class="dinner-form-row"><label>Du temps ?<select name="maxTime">${[[30,'30 minutes'],[45,'45 minutes'],[120,'J’ai le temps']].map(([v,l])=>`<option value="${v}" ${v===o.maxTime?'selected':''}>${l}</option>`).join('')}</select></label><label>À table, on est…<select name="servings">${[1,2,3,4,5,6].map(n=>`<option ${n===o.servings?'selected':''} value="${n}">${n} personne${n>1?'s':''}</option>`).join('')}</select></label></div><label class="dinner-toggle"><input type="checkbox" name="vegetarian" ${o.vegetarian?'checked':''}>Des plats végétariens</label><details ${o.dislikes.length||o.avoid?'open':''}><summary>Quelque chose qui ne passe pas aujourd’hui ?</summary>${chips(P.dislikes,o.dislikes,'dislikes')}<label for="dinner-avoid">D’autres ingrédients à écarter</label><input id="dinner-avoid" name="avoid" maxlength="120" value="${esc(o.avoid)}" placeholder="Courgette, ail…"><p class="small">Séparez les ingrédients par des virgules. Ce filtre de goûts repère les mots indiqués dans les ingrédients ; il ne gère pas les allergies ni les traces.</p></details><details ${o.pantry.length?'open':''}><summary>Utiliser ce que j’ai</summary><p>On privilégiera ces ingrédients. Vous vérifierez les quantités ensuite.</p>${chips(P.pantry,o.pantry,'pantry')}</details><button class="btn btn-primary dinner-main-button" type="submit" ${busy?'disabled':''}>${busy?'On regarde les recettes…':'Trouver mes idées de dîner'}</button><p class="small">${state.paid?'Vos dîners personnalisés sont inclus dans Plus.':state.trialUsed?'Votre premier essai a été utilisé. Les prochains dîners font partie de Plus.':'Votre premier dîner complet et son partage sont offerts. Aucun paiement demandé.'}</p>${state.meal?'<button class="btn-text" type="button" data-action="tonight-back">Retrouver le dîner prévu</button>':''}</form>`;
    }
    function results() {
      return `<div class="dinner-heading"><span class="section-kicker">Pour ce soir</span><h1 tabindex="-1" id="dinner-results">${choices.length?choices.length===1?'Une idée pour vous.':'Ça vous tente ?':'On ajuste un peu ?'}</h1><p>${choices.length?'Choisissez le plat qui vous fait envie. Les précautions sont consultables avant de choisir.':'Aucune autre recette ne correspond à ces choix. Essayez plus de temps ou retirez un ingrédient écarté.'}</p></div><div class="dinner-choices">${choices.map(c=>{const r=D.recipes.find(r=>r.id===c.id);return `<article class="dinner-choice"><img src="assets/${r.image}.jpg" alt="Photo d’inspiration : ${esc(r.title)}" width="400" height="270"><div><span>${r.time} minutes · ${state.preferences.servings} personne${state.preferences.servings>1?'s':''}</span><h2>${esc(r.title)}</h2><p>${esc(c.reason)}</p><details><summary>Précautions & ingrédients</summary><p>${esc(r.safety)}</p><p>${r.ingredients.map(i=>esc(i.name)).join(', ')}.</p><p>Allergènes : ${esc(r.allergens)}</p>${(r.sources||['spf','toxo']).map(id=>`<a href="${esc(D.sources[id].url)}" target="_blank" rel="noopener noreferrer">${esc(D.sources[id].name)}</a>`).join(' · ')}</details><button class="btn btn-primary" data-action="tonight-choose" data-id="${r.id}" ${busy?'disabled':''}>Ça me tente</button></div></article>`;}).join('')}</div><div class="dinner-results-actions">${remaining?'<button class="btn btn-outline" data-action="tonight-more">Autres idées</button>':''}<button class="btn-text" data-action="tonight-preferences">Modifier mes envies</button></div>${state.trialUsed&&!state.paid?'<p class="small">Les prochains dîners personnalisés font partie de Plus. Vos fiches alimentaires et les 20 recettes gratuites restent accessibles.</p>':''}`;
    }
    function sharePanel() {
      return `<section class="dinner-share" id="dinner-share"><h2 tabindex="-1">Partager ce dîner</h2><p>La personne qui reçoit le lien voit uniquement ce repas, ses précautions et les courses à cocher. Elle n’a pas besoin de compte.</p>${shareURL?`<label for="dinner-message">Votre petit mot</label><textarea id="dinner-message" maxlength="350">${esc(shareMessage)}</textarea><label for="dinner-link">Le lien du dîner</label><input id="dinner-link" readonly value="${esc(shareURL)}"><div class="dinner-results-actions"><button class="btn btn-primary" data-action="tonight-send">Partager le dîner</button><button class="btn btn-outline" data-action="tonight-copy">Copier le lien</button></div><p class="small">Vous choisissez le destinataire dans votre application de messagerie. Rien n’est envoyé automatiquement.</p>`:`<button class="btn btn-primary" data-action="tonight-link" ${busy?'disabled':''}>${state.meal.shared?'Créer un nouveau lien':'Créer un lien à partager'}</button>${state.meal.shared?'<p class="small">Un nouveau lien désactive le précédent. Les personnes ayant l’ancien lien perdront leur accès.</p>':''}`}<p class="small">Toute personne possédant le lien peut cocher les courses et les étapes de la recette. Le lien expire après 30 jours.</p>${state.meal.shared?'<button class="btn-text" data-action="tonight-revoke">Désactiver le lien partagé</button>':''}</section>`;
    }
    function dinner() {
      const m=state.meal;
      return `<div class="dinner-heading"><span class="section-kicker">${new Date(m.createdAt).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})} · Votre repas</span><h1 data-dinner-heading>Votre dîner</h1><div class="dinner-results-actions"><button class="btn btn-outline" data-action="tonight-relay">Partager la recette et les courses</button></div></div>${view==='share'?sharePanel():''}${window.PoumDiet.allows(m.recipe,host.diet?.())?'':'<p class="preference-note" role="alert">Ce dîner enregistré contient un ingrédient désormais exclu. Choisissez un autre dîner.</p>'}${V.meal(m)}<div class="dinner-results-actions"><button class="btn btn-outline" data-action="tonight-new">Trouver un autre dîner</button><button class="btn-text" data-action="tonight-notebook">Ajouter les ingrédients manquants à mes courses</button></div><p class="small">La liste partagée se synchronise ici. La copie ajoutée à votre carnet de courses reste indépendante.</p>${state.history?.length>1?`<details class="dinner-history"><summary>Mes derniers dîners</summary>${state.history.map(h=>`<button class="btn-text" data-action="tonight-history" data-id="${h.id}">${esc(D.recipes.find(r=>r.id===h.recipe_id)?.title||'Dîner')} · ${new Date(h.created_at).toLocaleDateString('fr-FR')}</button>`).join('')}</details>`:''}`;
    }
    function paywall() {return `<div class="dinner-heading"><span class="section-kicker">Poum Plus</span><h1>Et les prochains soirs ?</h1><p>Retrouvez vos idées selon vos envies, les courses et le relais avec un proche. Votre premier dîner reste à vous.</p></div><div class="dinner-paywall"><img src="assets/brand/carnet-cuisine-v4-320.webp" alt="" width="320" height="213"><h2>Une chose de moins à gérer, au quotidien.</h2><p>Les dîners personnalisés, 1 000 recettes complètes et les menus de la semaine.</p><p><b>4,90 €/mois</b>, renouvelé automatiquement, résiliable pour la prochaine échéance.<br>Ou <b>29,90 € pour 9 mois</b>, en une fois, sans renouvellement.</p><button class="btn btn-primary" data-action="plus-offer">Découvrir Poum Plus</button><button class="btn-text" data-action="tonight-back">Retrouver mon dîner offert</button></div>`;}
    function content() {
      const error=feedback?`<div class="dinner-feedback" role="status">${esc(feedback)} <button class="btn-text" data-action="tonight-refresh">Actualiser</button></div>`:'';
      if(window.MietteRuntime?.cloud===false)return `<h1>Ce soir, on vous simplifie le dîner.</h1><p>Retrouvez le parcours et les courses partagées sur Poum.</p><a class="btn btn-primary" href="${esc(new URL('#cesoir',window.MietteRuntime.appURL).href)}">Ouvrir Ce soir sur Poum</a>`;
      if(view==='erase')return '<h1>Effacer vos dîners ?</h1><p>Les repas, les envies enregistrées et tous les liens de relais de cet espace seront supprimés. Le premier essai restera comptabilisé.</p><div class="dinner-results-actions"><button class="btn btn-outline" data-action="tonight-back">Garder mes dîners</button><button class="btn btn-primary" data-action="tonight-erase-confirm">Effacer mes dîners</button></div>';
      if(!loaded&&!state.meal)return error+'<div class="dinner-heading"><span class="section-kicker">Ce soir</span><h1>On trouve votre dîner.</h1><p role="status">'+(feedback?'Une connexion est nécessaire pour retrouver vos dîners.':'Ouverture de votre espace dîner…')+'</p></div>';
      const adoption=state.guestAvailable?'<aside class="dinner-feedback"><p>Un dîner a été préparé sans compte sur ce navigateur.</p><button class="btn-text" data-action="tonight-adopt">Le retrouver dans mon compte</button></aside>':'';
      return error+adoption+(view==='paywall'?paywall():view==='choices'?results():['meal','share'].includes(view)&&state.meal?dinner():form())+'<p class="small dinner-data-note">Vos envies et dîners sont enregistrés pour les retrouver. Sans compte, cet accès dépend de ce navigateur. <button class="btn-text" data-action="tonight-erase">Effacer mes dîners</button></p>';
    }
    function render() {ensure();return `<div id="tonight-page" class="tonight-page" aria-busy="${busy}">${content()}</div>`;}
    async function run(fn) {
      ensure();if(busy)return;activity++;busy=true;feedback='';const ticket=epoch;
      document.querySelectorAll('#tonight-page button,#tonight-page input,#tonight-page select').forEach(el=>el.disabled=true);
      try{await fn();}catch(e){if(ticket!==epoch)return;if(e.status===402){view='paywall';}else feedback=e.message;}
      finally{if(ticket===epoch){busy=false;redraw();}}
    }
    function readForm() {const f=new FormData(document.querySelector('#tonight-form'));return T.preferences({...Object.fromEntries(f),diet:window.PoumDiet.clean(host.diet?.()),vegetarian:f.has('vegetarian'),dislikes:f.getAll('dislikes'),pantry:f.getAll('pantry')});}
    function suggest(prefs,more=false) {return run(async()=>{const result=await request({action:'suggest',preferences:{...prefs,diet:window.PoumDiet.clean(host.diet?.())},excluded:more?excluded.slice(-60):[]});state.preferences=result.preferences;choices=result.choices;remaining=result.remaining;excluded=[...(more?excluded:[]),...choices.map(c=>c.id)];pendingChoice=null;view='choices';save();});}
    function submit(event) {if(event.target.id!=='tonight-form')return false;event.preventDefault();let prefs;try{prefs=readForm();}catch(e){feedback=e.message;redraw();return true;}suggest(prefs);return true;}
    function click(button) {
      const action=button.dataset.action;if(!action?.startsWith('tonight-'))return false;
      ensure();if(busy)return true;
      if(action==='tonight-erase'){view='erase';redraw();}
      else if(action==='tonight-erase-confirm')run(async()=>{await request({action:'erase'});state={trialUsed:state.trialUsed,paid:state.paid};shareURL='';selectedId=null;view='form';save();feedback='Vos dîners et leurs liens de relais ont été effacés.';});
      else if(action==='tonight-choose')run(async()=>{const recipe=D.recipes.find(r=>r.id===button.dataset.id);if(!recipe||!window.PoumDiet.allows(recipe,host.diet?.()))throw Error('Ce plat ne correspond plus à vos exclusions. Relancez les idées.');if(!pendingChoice||pendingChoice.recipeId!==button.dataset.id)pendingChoice={requestId:crypto.randomUUID(),recipeId:button.dataset.id};const r=await request({action:'choose',...pendingChoice});state.meal=r.meal;state.trialUsed=true;selectedId=r.meal.id;shareURL='';view='meal';save();});
      else if(action==='tonight-new'||action==='tonight-preferences'){view='form';choices=[];feedback='';redraw();}
      else if(action==='tonight-more')suggest(state.preferences,true);
      else if(action==='tonight-back'){view=state.meal?'meal':'form';feedback='';redraw();}
      else if(action==='tonight-refresh')refresh(true);
      else if(action==='tonight-history'){selectedId=button.dataset.id;shareURL='';refresh(true);}
      else if(action==='tonight-adopt')run(async()=>{state=await request({action:'adopt'});try{localStorage.removeItem('poum-tonight-v1:miette-notebook-v1');}catch{}state.guestAvailable=false;view=state.meal?'meal':'form';selectedId=null;save();});
      else if(action==='tonight-relay'){view='share';redraw('#dinner-share h2');document.querySelector('#dinner-share')?.scrollIntoView({block:'start'});}
      else if(action==='tonight-link')run(async()=>{const r=await request({action:'share',id:state.meal.id});state.meal=r.meal;shareURL=new URL('/relais/#'+r.token,window.MietteRuntime?.appURL||location.origin).href;shareMessage='Un coup de main pour ce soir ? '+state.meal.recipe.title+', pour '+state.meal.servings+'. Les courses et la recette sont ici.';save();});
      else if(action==='tonight-revoke')run(async()=>{state.meal=(await request({action:'revoke',id:state.meal.id})).meal;shareURL='';save();feedback='Le lien est désactivé. Ce dîner reste dans votre espace.';});
      else if(action==='tonight-send'){shareMessage=document.querySelector('#dinner-message').value;if(navigator.share)navigator.share({title:'Le dîner de ce soir · Poum',text:shareMessage,url:shareURL}).catch(e=>{if(e.name!=='AbortError')host.notify('Le partage n’a pas abouti. Vous pouvez copier le lien.');});else copy();}
      else if(action==='tonight-copy')copy();
      else if(action==='tonight-notebook'){host.shopping(state.meal);host.notify('Les ingrédients manquants ont été ajoutés à vos courses.');}
      return true;
    }
    async function copy(){try{await navigator.clipboard.writeText(shareURL);host.notify('Le lien du dîner est copié.');}catch{const el=document.querySelector('#dinner-link');el?.focus();el?.select();host.notify('Sélectionnez le lien pour le copier.');}}
    async function patch(field,value) {
      ensure();if(busy)return;activity++;busy=true;const ticket=epoch;
      document.querySelectorAll('#tonight-page [data-dinner-item], #tonight-page [data-dinner-step]').forEach(el=>el.disabled=true);
      try{const result=await request({action:'patch',id:state.meal.id,field,value});acceptMeal(result.meal);}
      catch(e){if(ticket===epoch){host.notify(e.message,'info');if(state.meal)V.sync(document.querySelector('#tonight-page'),state.meal);}}
      finally{if(ticket===epoch){busy=false;document.querySelectorAll('#tonight-page [data-dinner-item], #tonight-page [data-dinner-step]').forEach(el=>el.disabled=false);}}
    }
    function change(e){if(!e.target.matches('#tonight-page [data-dinner-item], #tonight-page [data-dinner-step]'))return false;const field=e.target.dataset.dinnerStep!==undefined?'step:'+e.target.dataset.dinnerStep:Number(e.target.dataset.dinnerItem);if(busy){e.target.checked=state.meal.checked[field]===true;return true;}patch(field,e.target.checked);return true;}
    function enter(){if(ensure())redraw();if(host.page()==='cesoir'||host.page()==='accueil')refresh(!loaded);}
    setInterval(()=>{if(!document.hidden&&host.page()==='cesoir'&&['meal','share'].includes(view))refresh();},5000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)enter();});
    window.addEventListener('online',enter);
    return {render,homeCard,click,submit,change,enter,forget: value => {try{localStorage.removeItem('poum-tonight-v1:'+value);}catch{}}};
  }
  return {create};
})();
