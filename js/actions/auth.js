// Perfil activo (sin PIN)
import { USUARIOS } from '../config.js';
import { state } from '../state.js';
import { render } from '../views/render.js';

// Entrar con un perfil (no hay PIN: la app es interna y solo distingue quién trabaja)
export function entrarComo(nombre) {
  const user = USUARIOS.find(u => u.nombre === nombre);
  if (!user) return;
  state.sesionUsuario = { nombre: user.nombre };
  state.instTab = user.area === 'CPT BT' ? 'cpt_bt' : 'cpt_mt';
  state.alertaDismissed = false;
  try { localStorage.setItem('cpt_session', JSON.stringify(state.sesionUsuario)); } catch(e) {}
  render();
}

// Volver a la pantalla de perfiles
export function cerrarSesion() {
  state.sesionUsuario = null;
  state.tab = 'dashboard'; state.view = 'lista'; state.showMas = false; state.campanaClave = null;
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
