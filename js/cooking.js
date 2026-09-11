/* Shared reading helpers for recipe sheets and the private dinner relay. */
window.PoumCooking=(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function before(r){const g=r.guide;if(!g)return '';return `<details class="cooking-prep"><summary>Avant de commencer</summary><p><b>À sortir :</b> ${g.equipment.map(esc).join(' · ')}.</p><ul>${g.before.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>`;}
 function step(r,i){const s=r.guide?.steps[i];if(!s?.check&&!s?.tip)return '';return `<details class="cooking-cue"><summary>Le repère pour cette étape</summary>${s.check?`<p>${esc(s.check)}</p>`:''}${s.tip?`<p>${esc(s.tip)}</p>`:''}</details>`;}
 function storage(r){return r.storage?`<details class="cooking-storage"><summary>Conserver et réchauffer</summary><p>${esc(r.storage)}</p></details>`:'';}
 return {before,step,storage};
})();
