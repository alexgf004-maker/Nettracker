// Login por PIN y sesión
import { USUARIOS } from '../config.js';
import { state } from '../state.js';
import { render } from '../views/render.js';

export function doLogin() {
  if (!state.loginForm.nombre) { state.loginForm.error = 'Selecciona un usuario'; render(); return; }
  if (!state.loginForm.pin) { state.loginForm.error = 'Ingresa tu PIN'; render(); return; }
  const user = USUARIOS.find(u => u.nombre === state.loginForm.nombre);
  if (!user || user.pin !== state.loginForm.pin) {
    state.loginForm.error = 'PIN incorrecto';
    state.loginForm.pin = '';
    render();
    return;
  }
  state.sesionUsuario = { nombre: user.nombre };
  state.loginForm = { nombre: '', pin: '', error: '' };
  state.instTab = user.area === 'CPT BT' ? 'cpt_bt' : 'cpt_mt';
  try { localStorage.setItem('cpt_session', JSON.stringify(state.sesionUsuario)); } catch(e) {}
  render();
}

export function cerrarSesion() {
  if (!confirm('¿Cerrar sesión de ' + state.sesionUsuario.nombre + '?')) return;
  state.sesionUsuario = null;
  state.loginForm = { nombre: '', pin: '', error: '' };
  try { localStorage.removeItem('cpt_session'); } catch(e) {}
  render();
}

// Restaura la sesión guardada en localStorage (si existe)
export function restaurarSesion() {
  try {
    const saved = localStorage.getItem('cpt_session');
    if (saved) {
      state.sesionUsuario = JSON.parse(saved);
      const u = USUARIOS.find(x => x.nombre === state.sesionUsuario?.nombre);
      if (u) state.instTab = u.area === 'CPT BT' ? 'cpt_bt' : 'cpt_mt';
    }
  } catch(e) {}
}
