(() => {
  'use strict';
  const N = window.MietteNotebook;
  const runtime = window.MietteRuntime || {};
  const guestKey = 'miette-notebook-v1';
  const state = { configured: null, user: null, status: 'checking', error: '', savedAt: null, conflict: null, appURL: runtime.appURL || location.origin };
  let hooks, timer, running = false, generation = 0, meta = { revision: 0, base: N.empty(), dirty: false };
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The current notebook remains in memory. */ } };
  const storageKey = () => state.user ? 'miette-account-' + state.user.id : guestKey;
  const emit = () => window.dispatchEvent(new CustomEvent('miette:cloud', { detail: { ...state } }));
  const saveMeta = () => { if (state.user) write('miette-sync-' + state.user.id, meta); };
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(new URL(path, new URL(runtime.apiBase || '/api/', location.href)), {
        ...options, signal: controller.signal, credentials: 'same-origin', cache: 'no-store',
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
      });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || data.message || 'La demande a échoué.'); error.status = response.status; error.data = data; throw error; }
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Connexion au serveur impossible. Vos modifications restent sur cet appareil.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function apply(notebook, preserveEdits = false) { hooks.replace(notebook, { preserveEdits }); write(storageKey(), hooks.read()); }
  async function refreshSession(importGuest = false) {
    const session = await request('auth/get-session');
    const previous = state.user?.id;
    const guest = !previous ? hooks.read() : read(guestKey) || N.empty();
    state.user = session?.user || null;
    if (previous !== state.user?.id) {
      generation++; running = false; clearTimeout(timer);
      meta = state.user ? read('miette-sync-' + state.user.id) || { revision: 0, base: N.empty(), dirty: false } : { revision: 0, base: N.empty(), dirty: false };
      if (state.user) {
        write('miette-last-account', state.user);
        const local = read(storageKey());
        apply(local || N.empty());
        if (importGuest && N.hasContent(guest)) { apply(N.merge(N.empty(), guest, hooks.read()).notebook); meta.dirty = true; saveMeta(); }
      } else {
        try { localStorage.removeItem('miette-last-account'); } catch {}
        apply(read(guestKey) || N.empty());
      }
    }
    state.conflict = null; state.error = '';
    state.status = state.user ? 'loading' : 'local'; emit();
    if (state.user) await sync();
    return session;
  }
  async function init(callbacks) {
    hooks = callbacks;
    if (runtime.cloud === false) { state.configured = false; state.status = 'local'; emit(); return; }
    try {
      const config = await request('config');
      state.configured = config.accounts; state.appURL = config.appURL;
      if (config.accounts) await refreshSession();
      else { state.status = 'local'; emit(); }
    } catch {
      state.status = navigator.onLine ? 'unavailable' : 'offline';
      const previous = read('miette-last-account');
      if (!navigator.onLine && previous?.id) { state.user = previous; meta = read('miette-sync-' + previous.id) || meta; apply(read(storageKey()) || N.empty()); }
      emit();
    }
  }
  function changed() {
    if (!state.user) return;
    meta.dirty = true; saveMeta();
    state.status = navigator.onLine ? 'pending' : 'offline'; emit();
    clearTimeout(timer); timer = setTimeout(sync, 900);
  }
  async function sync() {
    if (!state.user || running || state.conflict || !navigator.onLine) return;
    running = true;
    const token = generation;
    state.status = 'saving'; state.error = ''; emit();
    try {
      const remote = await request('notebook');
      if (token !== generation) return;
      const local = hooks.read();
      if (remote.revision !== meta.revision) {
        if (meta.dirty) {
          const merged = N.merge(meta.base, local, remote.notebook || N.empty());
          if (merged.conflicts.length) {
            state.conflict = { remote, fields: merged.conflicts }; state.status = 'conflict'; emit(); return;
          }
          apply(merged.notebook, true);
        } else apply(remote.notebook || N.empty(), true);
        meta.revision = remote.revision; meta.base = remote.notebook || N.empty(); saveMeta();
      } else if (!meta.dirty && remote.notebook && !N.same(local, remote.notebook)) {
        // A matching revision does not guarantee an intact local copy (old tabs,
        // cleared storage, or a previous app version may have dropped fields).
        // Only restore clean copies; pending edits still follow the merge path.
        apply(remote.notebook, true);
        meta.base = remote.notebook; saveMeta();
      }
      if (meta.dirty || (!remote.notebook && N.hasContent(hooks.read()))) {
        const snapshot = structuredClone(hooks.read());
        const saved = await request('notebook', { method: 'PUT', body: JSON.stringify({ notebook: snapshot, revision: meta.revision }) });
        if (token !== generation) return;
        meta = { revision: saved.revision, base: snapshot, dirty: !N.same(snapshot, hooks.read()) };
        state.savedAt = saved.updatedAt;
      } else { meta.dirty = false; state.savedAt = remote.updatedAt; }
      saveMeta(); state.status = meta.dirty ? 'pending' : 'synced'; emit();
    } catch (error) {
      if (token !== generation) return;
      if (error.status === 409) {
        meta.dirty = true; saveMeta(); state.status = 'pending';
        timer = setTimeout(sync, 500);
      } else { state.status = 'error'; state.error = error.message; emit(); }
    } finally {
      if (token === generation) {
        running = false;
        if (meta.dirty && state.status === 'pending') { clearTimeout(timer); timer = setTimeout(sync, 700); }
      }
    }
  }
  async function resolve(choice) {
    if (!state.conflict) return;
    const { remote } = state.conflict;
    if (choice === 'remote') apply(remote.notebook || N.empty());
    meta = { revision: remote.revision, base: remote.notebook || N.empty(), dirty: choice !== 'remote' };
    state.conflict = null; saveMeta(); await sync();
  }
  async function signOut() {
    await sync();
    await request('auth/sign-out', { method: 'POST', body: '{}' });
    await refreshSession();
  }
  async function deleteAccount(password) {
    if (!state.user) return;
    const id = state.user.id;
    await request('account', { method: 'DELETE', body: JSON.stringify({ password }) });
    generation++; running = false; clearTimeout(timer);
    try { localStorage.removeItem('miette-account-' + id); localStorage.removeItem('miette-sync-' + id); localStorage.removeItem('miette-last-account'); localStorage.removeItem('miette-workshop-v1:miette-account-' + id); localStorage.removeItem('miamama-recipes-v1:miette-account-' + id); } catch {}
    state.user = null; state.conflict = null; state.error = ''; state.savedAt = null; state.status = 'local';
    meta = { revision: 0, base: N.empty(), dirty: false };
    apply(read(guestKey) || N.empty()); emit();
  }
  window.addEventListener('online', () => { if (state.configured === null) init(hooks); else if (state.user) sync(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user) sync(); });
  window.addEventListener('storage', event => {
    if (state.user && event.key === storageKey() && !meta.dirty && !running) { apply(read(storageKey()) || N.empty()); meta = read('miette-sync-' + state.user.id) || meta; sync(); }
  });
  setInterval(() => { if (!document.hidden && state.user) sync(); }, 45000);
  window.MietteCloud = { state, init, changed, sync, refreshSession, resolve, signOut, deleteAccount, request, retry: () => init(hooks), get storageKey() { return storageKey(); } };
})();
