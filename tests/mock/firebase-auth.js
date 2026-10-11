// Fake en memoria de Firebase Authentication (correo + contraseña) para las pruebas.
// window.__AUTH__ = { cuentas: { correo: pin }, actual: correo | null } lo pone tests/helpers.js
const A = window.__AUTH__ || { cuentas: {}, actual: null };
// Como Firebase, la sesión se recuerda en el dispositivo (sobrevive a recargar la página)
const guardada = localStorage.getItem('mock_auth');
const inicial = guardada !== null ? guardada : A.actual;
let actual = inicial ? { email: inicial, uid: 'uid-' + inicial } : null;
const subs = [];
const avisar = () => { localStorage.setItem('mock_auth', actual?.email || ''); subs.forEach(cb => setTimeout(() => cb(actual), 0)); };
const error = code => Object.assign(new Error(code), { code });
export function getAuth() { return {}; }
export function onAuthStateChanged(auth, cb) { subs.push(cb); setTimeout(() => cb(actual), 0); return () => {}; }
export async function signInWithEmailAndPassword(auth, email, pass) {
  if (A.cuentas[email] !== pass) throw error('auth/invalid-credential');
  actual = { email, uid: 'uid-' + email }; avisar(); return { user: actual };
}
export async function createUserWithEmailAndPassword(auth, email, pass) {
  if (String(pass).length < 6) throw error('auth/weak-password');
  if (email in A.cuentas) throw error('auth/email-already-in-use');
  A.cuentas[email] = pass; actual = { email, uid: 'uid-' + email }; avisar(); return { user: actual };
}
export async function signOut() { actual = null; avisar(); }
