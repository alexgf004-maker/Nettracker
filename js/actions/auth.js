// Entrada a la app: se elige el perfil y se pone su PIN de 6 dígitos.
// - Cada perfil es una cuenta de Firebase Authentication: correo interno <perfil>@usuarios.nettracker.app y el PIN como
//   contraseña. Las reglas de la base solo dejan leer y escribir a esas cuentas (ver database.rules.json).
// - La primera vez, cada quien crea su PIN (confirmado). En cuentas/{perfil} queda solo que ya tiene cuenta (es lo único
//   público, para saber si pedir el PIN o crearlo). El PIN no se guarda en la base.
// - Firebase bloquea los intentos repetidos; además la app espera un minuto después de 5 PIN equivocados.
// - La sesión la recuerda Firebase en el dispositivo hasta "Cambiar de perfil".
import { isAdmin, USUARIOS } from '../config.js';
import { auth, createUserWithEmailAndPassword, db, get, onAuthStateChanged, ref, remove, set, signInWithEmailAndPassword, signOut } from '../firebase.js';
import { detenerSync, iniciarSync } from '../data/sync.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

export const LARGO_PIN = 6; // Firebase pide contraseñas de 6 caracteres como mínimo
export const DOMINIO_CUENTAS = 'usuarios.nettracker.app';
const MAX_INTENTOS = 5; // después se bloquea un rato
const BLOQUEO_MS = 60000;

export const clavePerfil = nombre => String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const correoPerfil = nombre => `${clavePerfil(nombre)}@${DOMINIO_CUENTAS}`;

// Elegir un perfil: se busca si ya tiene cuenta para pedir el PIN o crearlo
export async function entrarComo(nombre) {
  const user = USUARIOS.find(u => u.nombre === nombre);
  if (!user) return;
  state.login = { nombre, cargando: true, pin: '', pin2: '', error: '' };
  render();
  try {
    const snap = await get(ref(db, 'cuentas/' + clavePerfil(nombre)));
    if (state.login?.nombre !== nombre) return;
    state.login = { ...state.login, cargando: false, paso: snap.exists() ? 'pin' : 'crear' };
  } catch (err) {
    state.login = { ...state.login, cargando: false, error: 'No se pudo conectar: ' + err.message };
  }
  render();
}
export function volverAPerfiles() { state.login = null; render(); }

// Teclado del PIN
export function teclaPin(d) {
  const l = state.login; if (!l || l.cargando) return;
  if (l.bloqueadoHasta && Date.now() < l.bloqueadoHasta) return;
  const campo = l.paso === 'confirmar' ? 'pin2' : 'pin';
  if (d === 'borrar') l[campo] = l[campo].slice(0, -1);
  else if (l[campo].length < LARGO_PIN) l[campo] += d;
  l.error = '';
  render();
  if (l[campo].length === LARGO_PIN) confirmarPin();
}

// Mensajes de Firebase en palabras del equipo
function mensajeError(err) {
  const c = err?.code || '';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'PIN incorrecto';
  if (c === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos.';
  if (c === 'auth/email-already-in-use') return 'Este perfil ya tiene cuenta. Si olvidó el PIN, el administrador debe borrarla en Firebase (Authentication).';
  if (c === 'auth/operation-not-allowed' || c === 'auth/admin-restricted-operation') return 'La creación de cuentas está desactivada en Firebase. Pide al administrador que la active un momento.';
  if (c === 'auth/network-request-failed') return 'Sin conexión. Revisa el internet e intenta de nuevo.';
  return 'No se pudo entrar: ' + (err?.message || c);
}

async function confirmarPin() {
  const l = state.login;
  if (l.paso === 'crear') { l.paso = 'confirmar'; l.pin2 = ''; render(); return; }
  l.cargando = true; render();
  try {
    if (l.paso === 'confirmar') {
      if (l.pin2 !== l.pin) { Object.assign(l, { cargando: false, paso: 'crear', pin: '', pin2: '', error: 'Los PIN no coinciden. Vuelve a crearlo.' }); render(); return; }
      await createUserWithEmailAndPassword(auth, correoPerfil(l.nombre), l.pin);
      await set(ref(db, 'cuentas/' + clavePerfil(l.nombre)), { creado: new Date().toISOString().slice(0, 10) });
      remove(ref(db, 'pines/' + clavePerfil(l.nombre))).catch(() => {}); // PIN viejo de 4 dígitos (ya no se usa)
      showToast('PIN creado');
    } else {
      await signInWithEmailAndPassword(auth, correoPerfil(l.nombre), l.pin);
    }
    entrar(l.nombre);
  } catch (err) {
    const msg = mensajeError(err);
    if (l.paso === 'confirmar') { Object.assign(l, { cargando: false, paso: 'crear', pin: '', pin2: '', error: msg }); render(); return; }
    l.cargando = false; l.pin = '';
    if (msg === 'PIN incorrecto') {
      l.intentos = (l.intentos || 0) + 1;
      if (l.intentos >= MAX_INTENTOS) { l.bloqueadoHasta = Date.now() + BLOQUEO_MS; l.intentos = 0; l.error = 'Demasiados intentos. Espera un minuto.'; setTimeout(render, BLOQUEO_MS + 100); }
      else l.error = msg;
    } else l.error = msg;
    render();
  }
}

// Deja la sesión lista para un perfil (la llama el login y el aviso de Firebase al abrir la app)
function entrar(nombre) {
  const user = USUARIOS.find(u => u.nombre === nombre);
  if (!user) return;
  const nuevo = state.sesionUsuario?.nombre !== nombre;
  state.login = null;
  state.sesionUsuario = { nombre: user.nombre };
  if (nuevo) {
    state.instTab = user.area === 'CPT BT' ? 'cpt_bt' : 'cpt_mt';
    state.alertaDismissed = false;
  }
  iniciarSync(); // los datos se leen solo con sesión (las reglas no dejan antes)
  render();
}

// Al abrir la app: Firebase dice si hay sesión guardada en el dispositivo
export function iniciarAuth() {
  try { localStorage.removeItem('cpt_session'); } catch (e) { /* sesión del sistema anterior */ }
  onAuthStateChanged(auth, user => {
    state.authListo = true;
    const perfil = user && USUARIOS.find(u => correoPerfil(u.nombre) === user.email);
    if (perfil) return entrar(perfil.nombre);
    if (user) signOut(auth); // cuenta que no es de un perfil de la app
    if (state.sesionUsuario) limpiarSesion();
    render();
  });
}

function limpiarSesion() {
  detenerSync();
  state.sesionUsuario = null; state.login = null; state.menuPerfil = false;
  state.tab = 'dashboard'; state.view = 'lista'; state.showMas = false; state.campanaClave = null;
}

// Volver a la pantalla de perfiles
export function cerrarSesion() {
  limpiarSesion();
  signOut(auth).catch(() => {});
  render();
}

// Menú del perfil (en el encabezado): cambiar de perfil y, para el administrador, borrar PIN
export function toggleMenuPerfil() { state.menuPerfil = !state.menuPerfil; render(); }
export async function borrarPin(nombre) {
  if (!isAdmin()) return;
  state.menuPerfil = false; render();
  if (!confirm(`¿Borrar el PIN de ${nombre}? Después borra también su cuenta en la consola de Firebase (Authentication → Users → ${correoPerfil(nombre)}) para que pueda crear uno nuevo.`)) return;
  await remove(ref(db, 'cuentas/' + clavePerfil(nombre)));
  showToast(`PIN de ${nombre} borrado. Falta borrar su cuenta en Firebase.`);
}
