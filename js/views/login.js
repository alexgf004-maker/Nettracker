// Pantallas de entrada (elegir perfil) y de mantenimiento
import { USUARIOS } from '../config.js';
import { state } from '../state.js';
import { LARGO_PIN } from '../actions/auth.js';

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

// PIN del perfil elegido: crearlo (dos veces) la primera vez, o ponerlo para entrar
function renderPin(el) {
  const l = state.login;
  const titulo = l.cargando ? 'Un momento…' : l.paso === 'crear' ? 'Crea tu PIN' : l.paso === 'confirmar' ? 'Confirma tu PIN' : 'Pon tu PIN';
  const sub = l.paso === 'crear' ? `Es la primera vez que entras. Elige ${LARGO_PIN} números que solo tú sepas.` : l.paso === 'confirmar' ? 'Escríbelo otra vez.' : '';
  const valor = l.paso === 'confirmar' ? l.pin2 : l.pin;
  const bloqueado = l.bloqueadoHasta && Date.now() < l.bloqueadoHasta;
  const tecla = d => `<button class="pin-tecla" onclick="teclaPin('${d}')" ${l.cargando || bloqueado ? 'disabled' : ''}>${d === 'borrar' ? '<i class="ic ic-chevron-left"></i>' : d}</button>`;
  el.innerHTML = `<div class="pantalla-entrada">
    <div class="entrada-marca"><div class="perfil-avatar grande">${iniciales(l.nombre)}</div>
      <div class="entrada-titulo">${l.nombre}</div><div class="entrada-sub">${titulo}${sub ? '<br>' + sub : ''}</div></div>
    <div class="entrada-tarjeta pin-tarjeta">
      <div class="pin-puntos">${Array.from({ length: LARGO_PIN }, (_, i) => `<i class="${i < valor.length ? 'lleno' : ''}"></i>`).join('')}</div>
      <div class="pin-error" role="alert">${l.error || ''}</div>
      <div class="pin-teclado">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar'].map(d => (d ? tecla(d) : '<span></span>')).join('')}</div>
    </div>
    <button class="entrada-secundario" onclick="volverAPerfiles()"><i class="ic ic-chevron-left"></i> Otro perfil</button>
  </div>`;
}

export function renderLogin(el) {
  if (state.login) return renderPin(el);
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
