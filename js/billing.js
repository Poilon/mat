/* Purchase status comes from the authenticated server, never from local storage. */
window.MietteBilling = (() => {
  'use strict';
  const Cloud = window.MietteCloud, runtime = window.MietteRuntime || {};
  const state = { loaded: false, configured: false, mode: 'loading', access: { active: false }, trialWeek: null, canManage: false, signedIn: false, error: '', owner: null };
  let generation = 0, observedOwner;
  const owner = () => Cloud.state.user?.id || null;
  const emit = () => window.dispatchEvent(new CustomEvent('miamama:billing'));
  function clear() { generation++; Object.assign(state, { loaded: false, access: { active: false }, trialWeek: null, canManage: false, signedIn: Boolean(owner()), owner: owner(), error: '' }); }
  async function refresh() {
    const token = ++generation, current = owner();
    if (runtime.cloud === false) { Object.assign(state, { loaded: true, configured: false, mode: 'mirror', access: { active: false }, owner: null }); emit(); return state; }
    try {
      const result = await Cloud.request('billing');
      if (token !== generation || current !== owner()) return state;
      Object.assign(state, result, { owner: current, loaded: true, error: '' });
    } catch (error) {
      if (token !== generation || current !== owner()) return state;
      Object.assign(state, { loaded: true, mode: 'error', configured: false, access: { active: false }, error: error.message, owner: current });
    }
    emit(); return state;
  }
  async function action(action, fields = {}) {
    const current = owner();
    const result = await Cloud.request('billing', { method: 'POST', body: JSON.stringify({ action, ...fields }) });
    if (current !== owner()) throw new Error('Le compte a changé. Relancez l’opération depuis votre espace.');
    if (result.access) { Object.assign(state, result, { loaded: true, owner: current, error: '' }); emit(); }
    return result;
  }
  function redirect(url) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(target.hostname)) throw new Error('Le lien de paiement est invalide. Réessayez depuis Poum.');
    location.assign(target.href);
  }
  function init() {
    observedOwner = owner();
    window.addEventListener('miette:cloud', () => {
      if (observedOwner !== owner()) { observedOwner = owner(); clear(); emit(); refresh(); }
    });
    window.addEventListener('online', refresh);
    return refresh();
  }
  return { state, refresh, init, action, redirect, get active() { return state.owner === owner() && state.access.active === true; } };
})();
