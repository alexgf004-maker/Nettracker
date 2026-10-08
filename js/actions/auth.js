// Entrada a la app: se elige el perfil y se pone su PIN de 4 dígitos.
// - La primera vez, cada quien crea su PIN (confirmado por el equipo).
// - El administrador puede borrar el PIN de alguien que lo olvidó; al entrar de nuevo crea uno nuevo.
// - El PIN no se guarda tal cual: en pines/{perfil} va un hash SHA-256 con una sal aleatoria.
// - Una vez dentro, la sesión queda guardada en el dispositivo hasta "Cambiar de perfil".
import { isAdmin, USUARIOS } from '../config.js';
import { db, get, ref, remove, set } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

export const LARGO_PIN = 4;
const MAX_INTENTOS = 5; // después se bloquea un rato
const BLOQUEO_MS = 60000;

export const clavePerfil = nombre => String(nombre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function hashPin(pin, sal) {
  const datos = new TextEncoder().encode(`${sal}:${pin}`);
  const h = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const salNueva = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

// Elegir un perfil: se busca si ya tiene PIN para pedirlo o crearlo
export async function entrarComo(nombre) {
  const user = USUARIOS.find(u => u.nombre === nombre);
  if (!user) return;
  state.login = { nombre, cargando: true, pin: '', pin2: '', error: '' };
  render();
  try {
    const snap = await get(ref(db, 'pines/' + clavePerfil(nombre)));
    if (state.login?.nombre !== nombre) return;
    state.login = { ...state.login, cargando: false, registro: snap.exists() ? snap.val() : null, paso: snap.exists() ? 'pin' : 'crear' };
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

async function confirmarPin() {
  const l = state.login;
  if (l.paso === 'crear') { l.paso = 'confirmar'; l.pin2 = ''; render(); return; }
  if (l.paso === 'confirmar') {
    if (l.pin2 !== l.pin) { Object.assign(l, { paso: 'crear', pin: '', pin2: '', error: 'Los PIN no coinciden. Vuelve a crearlo.' }); render(); return; }
    const sal = salNueva();
    await set(ref(db, 'pines/' + clavePerfil(l.nombre)), { sal, hash: await hashPin(l.pin, sal), creado: new Date().toISOString().slice(0, 10) });
    showToast('PIN creado');
    return iniciarSesion(l.nombre);
  }
  // Verificar
  const ok = (await hashPin(l.pin, l.registro.sal)) === l.registro.hash;
  if (ok) return iniciarSesion(l.nombre);
  l.intentos = (l.intentos || 0) + 1; l.pin = '';
  if (l.intentos >= MAX_INTENTOS) { l.bloqueadoHasta = Date.now() + BLOQUEO_MS; l.intentos = 0; l.error = 'Demasiados intentos. Espera un minuto.'; setTimeout(render, BLOQUEO_MS + 100); }
  else l.error = 'PIN incorrecto';
  render();
}

function iniciarSesion(nombre) {
  const user = USUARIOS.find(u => u.nombre === nombre);
  state.login = null;
  state.sesionUsuario = { nombre: user.nombre };
  state.instTab = user.area === 'CPT BT' ? 'cpt_bt' : 'cpt_mt';
  state.alertaDismissed = false;
  try { localStorage.setItem('cpt_session', JSON.stringify(state.sesionUsuario)); } catch (e) { /* sin almacenamiento */ }
  render();
}

// Volver a la pantalla de perfiles
export function cerrarSesion() {
  state.sesionUsuario = null; state.login = null; state.menuPerfil = false;
  state.tab = 'dashboard'; state.view = 'lista'; state.showMas = false; state.campanaClave = null;
  try { localStorage.removeItem('cpt_session'); } catch (e) { /* sin almacenamiento */ }
  render();
}

// Menú del perfil (en el encabezado): cambiar de perfil y, para el administrador, borrar PIN
export function toggleMenuPerfil() { state.menuPerfil = !state.menuPerfil; render(); }
export async function borrarPin(nombre) {
  if (!isAdmin()) return;
  state.menuPerfil = false; render();
  if (!confirm(`¿Borrar el PIN de ${nombre}? La próxima vez que entre tendrá que crear uno nuevo.`)) return;
  await remove(ref(db, 'pines/' + clavePerfil(nombre)));
  showToast(`PIN de ${nombre} borrado`);
}

// Restaura la sesión guardada en localStorage (si existe y el perfil sigue en la lista)
export function restaurarSesion() {
  try {
    const saved = localStorage.getItem('cpt_session');
    if (saved) {
      const s = JSON.parse(saved);
      const u = USUARIOS.find(x => x.nombre === s?.nombre);
      if (u) { state.sesionUsuario = { nombre: u.nombre }; state.instTab = u.area === 'CPT BT' ? 'cpt_bt' : 'cpt_mt'; }
      else localStorage.removeItem('cpt_session');
    }
  } catch (e) { /* sin almacenamiento */ }
}
