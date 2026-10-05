// Pantallas de entrada (elegir perfil) y de mantenimiento
import { USUARIOS } from '../config.js';

const LOGO = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none">
  <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
  <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export const iniciales = nombre => String(nombre || '').split(' ').map(w => w[0]).slice(0, 2).join('');

export function renderMantenimiento(el) {
  el.innerHTML = `<div class="pantalla-entrada">
    <div class="entrada-marca"><div class="entrada-logo"><i class="ic ic-ajustes"></i></div>
      <div class="entrada-titulo">En mantenimiento</div>
      <div class="entrada-sub">David está haciendo actualizaciones. Vuelve en unos minutos.</div>
    </div>
    <button class="entrada-secundario" onclick="cerrarSesion()"><i class="ic ic-chevron-left"></i> Cambiar de perfil</button>
  </div>`;
}

export function renderLogin(el) {
  el.innerHTML = `<div class="pantalla-entrada">
    <div class="entrada-marca">
      <div class="entrada-logo">${LOGO}</div>
      <div class="entrada-titulo">CPT INNOVA</div>
      <div class="entrada-sub">Calidad del Producto Técnico</div>
    </div>
    <div class="entrada-tarjeta">
      <div class="entrada-pregunta">¿Quién eres?</div>
      ${USUARIOS.map(u => `<button class="perfil" onclick="entrarComo('${u.nombre}')">
        <span class="perfil-avatar">${iniciales(u.nombre)}</span>
        <span class="perfil-datos"><span class="perfil-nombre">${u.nombre}</span><span class="perfil-area">${u.area}</span></span>
        <i class="ic ic-chevron-right"></i>
      </button>`).join('')}
    </div>
  </div>`;
}
