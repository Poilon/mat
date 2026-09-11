window.PoumDinnerView = (() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const quantity = v => Number(v).toLocaleString('fr-FR');
  const labels={planned:'Le dîner est prévu',cooking:'En cuisine',done:'Le dîner est prêt'};
  function progress(m) { const n=m.recipe.ingredients.filter(i=>m.checked[i.index]===true).length;return `${n} sur ${m.recipe.ingredients.length} ingrédients prêts`; }
  function meal(m) {
    const r=m.recipe;
    return `<section class="dinner-sheet" aria-label="Le repas choisi"><div class="dinner-photo"><img src="/assets/${esc(r.image)}.jpg" width="640" height="420" alt="Photo d’inspiration : ${esc(r.title)}"><span>${r.time} min · ${m.servings} personne${m.servings>1?'s':''}</span></div><p class="dinner-photo-note">Photo d’inspiration. Les ingrédients écrits font référence.</p><div class="dinner-sheet-body"><h2>${esc(r.title)}</h2><p class="dinner-progress" data-dinner-progress role="status">${progress(m)} · ${labels[m.status]}</p><section class="dinner-shopping" id="dinner-shopping"><h3>Les ingrédients à prévoir</h3><p>Cochez ce que vous avez en quantité suffisante ou venez d’acheter.</p>${r.ingredients.map(i=>`<label class="dinner-item"><input type="checkbox" data-dinner-item="${i.index}" ${m.checked[i.index]?'checked':''}><span>${esc(i.name)}<small>${quantity(i.quantity)} ${esc(i.unit)}</small></span></label>`).join('')}</section><p class="dinner-allergens"><b>Allergènes :</b> ${esc(r.allergens)}</p><details class="dinner-method" ${m.status==='cooking'?'open':''}><summary>En cuisine · Les étapes</summary><ol>${r.steps.map((s,index)=>`<li><label class="dinner-step"><input type="checkbox" data-dinner-step="${index}" ${m.checked['step:'+index]?'checked':''}><span>${esc(s)}</span></label></li>`).join('')}</ol></details><section class="dinner-safety"><h3>Les précautions grossesse</h3><p>${esc(r.safety)}</p><div>${r.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`).join('')}</div><p class="small">Ces repères généraux ne remplacent pas les conseils de votre sage-femme ou médecin. Vérifiez les ingrédients, les allergies et la cuisson.</p></section><div class="dinner-status-actions"><button class="btn btn-outline" data-dinner-status="cooking" ${m.status==='cooking'?'disabled':''}>Je commence à cuisiner</button><button class="btn btn-primary" data-dinner-status="done" ${m.status==='done'?'disabled':''}>Le dîner est prêt</button></div><button class="btn-text" data-dinner-status="planned" ${m.status==='planned'?'hidden':''}>Remettre « À préparer »</button></div></section>`;
  }
  function sync(container,m) {
    container.querySelectorAll('[data-dinner-item]').forEach(el=>{el.checked=m.checked[el.dataset.dinnerItem]===true;});
    container.querySelectorAll('[data-dinner-step]').forEach(el=>{el.checked=m.checked['step:'+el.dataset.dinnerStep]===true;});
    const p=container.querySelector('[data-dinner-progress]');const text=progress(m)+' · '+labels[m.status];if(p&&p.textContent!==text)p.textContent=text;
    container.querySelectorAll('[data-dinner-status]').forEach(el=>{if(el.dataset.dinnerStatus==='planned')el.hidden=m.status==='planned';else el.disabled=el.dataset.dinnerStatus===m.status;});
  }
  return {esc,quantity,labels,meal,progress,sync};
})();
