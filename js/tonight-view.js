window.PoumDinnerView = (() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const quantity = v => Number(v).toLocaleString('fr-FR');
  const panels=new Map();
  function progress(m) { const n=m.recipe.ingredients.filter(i=>m.checked[i.index]===true).length;return `${n} sur ${m.recipe.ingredients.length} ingrédients cochés`; }
  function meal(m) {
    const r=m.recipe,selected=panels.get(m.id)||'recipe';
    return `<section class="dinner-sheet" data-meal-id="${esc(m.id)}" aria-label="Le repas choisi"><div class="dinner-photo"><img src="/assets/${esc(r.image)}.jpg" width="640" height="420" alt="Photo d’inspiration : ${esc(r.title)}"><span>${r.time} min · ${m.servings} personne${m.servings>1?'s':''}</span></div><p class="dinner-photo-note">Photo d’inspiration. Les ingrédients écrits font référence.</p><div class="dinner-sheet-body"><h2>${esc(r.title)}</h2><div class="dinner-navigation" role="group" aria-label="Consulter le dîner"><button type="button" data-dinner-tab="recipe" aria-pressed="${selected==='recipe'}">La recette</button><button type="button" data-dinner-tab="shopping" aria-pressed="${selected==='shopping'}">Liste de courses</button></div><section class="dinner-shopping" id="dinner-shopping" data-dinner-panel="shopping" ${selected==='shopping'?'':'hidden'}><h3>Les ingrédients à prévoir</h3><p class="dinner-progress" data-dinner-progress role="status">${progress(m)}</p><p>Cochez ce que vous avez en quantité suffisante ou venez d’acheter.</p>${r.ingredients.map(i=>`<label class="dinner-item"><input type="checkbox" data-dinner-item="${i.index}" ${m.checked[i.index]?'checked':''}><span>${esc(i.name)}<small>${quantity(i.quantity)} ${esc(i.unit)}</small></span></label>`).join('')}</section><section data-dinner-panel="recipe" ${selected==='recipe'?'':'hidden'}><details class="cooking-prep"><summary>Ingrédients pour ${m.servings} personne${m.servings>1?'s':''}</summary><ul class="ingredients-list">${r.ingredients.map(i=>`<li>${esc(i.name)}<b>${quantity(i.quantity)} ${esc(i.unit)}</b></li>`).join('')}</ul></details><section class="dinner-method"><h3>Préparation</h3><p class="small">Cochez les étapes si vous souhaitez suivre votre avancée.</p>${window.PoumCooking.before(r)}${m.servings!==2?'<p class="small">Les quantités sont ajustées. Les étapes décrivent la base pour 2 personnes : adaptez le nombre de fournées et vérifiez la cuisson.</p>':''}<ol>${r.steps.map((s,index)=>`<li><label class="dinner-step"><input type="checkbox" data-dinner-step="${index}" ${m.checked['step:'+index]?'checked':''}><span>${esc(s)}</span></label>${window.PoumCooking.step(r,index)}</li>`).join('')}</ol></section>${window.PoumCooking.storage(r)}<p class="dinner-allergens"><b>Allergènes :</b> ${esc(r.allergens)}</p><section class="dinner-safety"><h3>Les précautions grossesse</h3><p>${esc(r.safety)}</p><div>${r.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`).join('')}</div><p class="small">Ces repères généraux ne remplacent pas les conseils de votre sage-femme ou médecin. Vérifiez les ingrédients, les allergies et la cuisson.</p></section></section></div></section>`;
  }
  function sync(container,m) {
    container.querySelectorAll('[data-dinner-item]').forEach(el=>{el.checked=m.checked[el.dataset.dinnerItem]===true;});
    container.querySelectorAll('[data-dinner-step]').forEach(el=>{el.checked=m.checked['step:'+el.dataset.dinnerStep]===true;});
    const p=container.querySelector('[data-dinner-progress]');const text=progress(m);if(p&&p.textContent!==text)p.textContent=text;

  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-dinner-tab]');if(!button||button.disabled)return;
    const sheet=button.closest('.dinner-sheet'),selected=button.dataset.dinnerTab;
    if(!sheet||!['recipe','shopping'].includes(selected))return;
    panels.set(sheet.dataset.mealId,selected);if(panels.size>100)panels.delete(panels.keys().next().value);
    sheet.querySelectorAll('[data-dinner-panel]').forEach(el=>{el.hidden=el.dataset.dinnerPanel!==selected;});
    sheet.querySelectorAll('[data-dinner-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.dinnerTab===selected)));
  });
  return {esc,quantity,meal,progress,sync};
})();
