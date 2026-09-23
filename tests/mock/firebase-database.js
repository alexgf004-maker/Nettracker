// In-memory fake of the Realtime Database API used by the app.
const T = window.__FIXTURE__ ? JSON.parse(JSON.stringify(window.__FIXTURE__)) : {};
window.__DB__ = T; window.__WRITES__ = [];
let seq = 0; const listeners = [];
const parts = p => p.split('/').filter(Boolean);
const getAt = p => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), T);
const setAt = (p, v) => { const ks = parts(p); let o = T; ks.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); if (v === null || v === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = JSON.parse(JSON.stringify(v)); };
const snap = (key, v) => ({ key, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v !== undefined && v !== null,
  forEach: cb => { if (v && typeof v === 'object') Object.keys(v).forEach(k => cb(snap(k, v[k]))); } });
const fire = () => setTimeout(() => listeners.forEach(l => l.cb(snap(parts(l.path).at(-1), getAt(l.path)))), 0);
export function getDatabase() { return {}; }
export function ref(db, path) { return { path: path || '' }; }
export function onValue(r, cb) { listeners.push({ path: r.path, cb }); setTimeout(() => cb(snap(parts(r.path).at(-1), getAt(r.path))), 0); return () => {}; }
export function push(r, v) { const key = 'k' + String(++seq).padStart(4, '0'); window.__WRITES__.push(['push', r.path, v]); if (v !== undefined) { setAt(r.path + '/' + key, v); fire(); } return Object.assign(Promise.resolve({ key }), { key }); }
export function set(r, v) { window.__WRITES__.push(['set', r.path, v]); setAt(r.path, v); fire(); return Promise.resolve(); }
export function update(r, v) { window.__WRITES__.push(['update', r.path, v]); for (const [k, x] of Object.entries(v)) setAt(r.path + '/' + k, x); fire(); return Promise.resolve(); }
export function remove(r) { window.__WRITES__.push(['remove', r.path]); setAt(r.path, null); fire(); return Promise.resolve(); }
export function get(r) { return Promise.resolve(snap(parts(r.path).at(-1), getAt(r.path))); }
