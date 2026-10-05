import { USUARIOS } from '../config.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { icon } from './icons.js';

export function renderMantenimiento(el) {
  el.innerHTML = `<main class="login-page"><section class="login-panel"><div class="login-symbol">${icon('settings')}</div><h1>En mantenimiento</h1><p>Estamos actualizando la aplicación. Vuelve en unos minutos.</p><button class="btn btn-secondary" onclick="cerrarSesion()">Cambiar perfil</button></section></main>`;
}

export function renderLogin(el) {
  el.innerHTML = `<main class="login-page"><div class="login-brand"><div class="logo-mark">${icon('activity')}</div><div><strong>CPT INNOVA</strong><span>Calidad del producto técnico</span></div></div>
    <section class="login-panel"><div class="work-eyebrow">Espacio del equipo</div><h1>Selecciona tu perfil</h1><p>Continúa con tus campañas y trabajo de campo.</p>
      <div class="login-profiles">${USUARIOS.map(user => {
        const selected = state.loginForm.nombre === user.nombre;
        return `<button class="login-profile ${selected ? 'selected' : ''}" onclick="selectLoginUser('${escapeHtml(user.nombre)}')" aria-pressed="${selected}"><span class="login-initials">${escapeHtml(user.nombre.split(' ').map(word => word[0]).slice(0,2).join(''))}</span><span><strong>${escapeHtml(user.nombre)}</strong><small>${escapeHtml(user.area)}</small></span><span class="login-selection">${selected ? '✓' : ''}</span></button>`;
      }).join('')}</div>
      ${state.loginForm.error ? `<p class="login-error">${escapeHtml(state.loginForm.error)}</p>` : ''}
      <button class="btn btn-primary" onclick="doLogin()" ${!state.loginForm.nombre ? 'disabled' : ''}>Entrar</button>
    </section></main>`;
}
