// Header y menú de navegación (barra inferior en celular, menú lateral en PC)
import { userArea } from '../config.js';
import { state } from '../state.js';
import { iniciales } from './login.js';

// Secciones del menú: [pestaña, nombre, ícono]
export const SECCIONES = [
  { titulo: null, items: [['dashboard', 'Inicio', 'home']] },
  { titulo: 'Trabajo', items: [['campanas', 'Campañas', 'campanas'], ['reclamos', 'Reclamos', 'reclamos'], ['requerimientos', 'Requerimientos', 'requerimientos'], ['ft', 'Seguimiento FT', 'ft']] },
  { titulo: 'Recursos', items: [['inventario', 'Equipos', 'equipos']] },
  { titulo: 'Herramientas', items: [['graficar', 'Graficar', 'grafica'], ['instalaciones', 'Instalaciones', 'instalaciones'], ['validaciones', 'Validación de TAP', 'validacion'], ['carga', 'Despachos', 'despachos'], ['mapa', 'Mapa', 'mapa']] },
];
// En celular solo caben estas; el resto va en "Más"
export const PRINCIPALES = ['dashboard', 'campanas', 'reclamos', 'inventario'];

const LOGO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/><path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const todasLasPestanas = () => SECCIONES.flatMap(s => s.items);

export function renderHeader() {
  const showBack = state.view !== 'lista' || (state.tab === 'campanas' && state.campanaClave) || (state.tab === 'reclamos' && state.expedienteId);
  const titulo = todasLasPestanas().find(([t]) => t === state.tab)?.[1] || '';
  const nombre = state.sesionUsuario?.nombre || '';
  let acciones = '';
  if (state.view === 'lista' && state.tab === 'instalaciones') acciones += `<button class="btn-small" onclick="newInstall()"><i class="ic ic-plus"></i> Nuevo</button>`;
  if (state.view === 'lista' && state.tab === 'inventario' && !state.modoSeleccionLote) acciones += `<button class="btn-small" onclick="newEquipo()"><i class="ic ic-plus"></i> Equipo</button>`;
  if (state.view === 'lista' && state.tab === 'inventario' && state.modoSeleccionLote) acciones += `<button class="btn-small" onclick="cancelarLote()">Cancelar</button>`;

  return `<header>
    <div class="header-left">
      ${showBack ? `<button class="back-btn" onclick="goBack()" title="Volver"><i class="ic ic-chevron-left"></i></button>` : ''}
      <div class="logo-wrap">
        <div id="conn-dot" class="conn-dot"></div>
        <div class="logo-mark">${LOGO}</div>
      </div>
      <div>
        <div class="logo-text">CPT INNOVA</div>
        <div class="logo-sub">${titulo || 'Calidad del Producto Técnico'}</div>
      </div>
    </div>
    <div class="header-right">
      ${acciones}
      <button class="icon-btn" onclick="toggleGlobalSearch()" title="Buscar"><i class="ic ic-buscar"></i></button>
      <button class="user-chip" onclick="cerrarSesion()" title="Cambiar de perfil">
        <span class="user-avatar">${iniciales(nombre)}</span>
        <span class="user-name">${nombre.split(' ')[0]}<small>${userArea()}</small></span>
      </button>
    </div>
  </header>`;
}

function navBtn([tab, label, icono], extra = '') {
  const activo = state.tab === tab;
  return `<button class="nav-btn ${extra} ${activo ? 'active' : ''}" onclick="switchTab('${tab}')">
      <i class="nav-icon ic ic-${icono}"></i><span class="nav-label">${label}</span>
    </button>`;
}

export function renderBottomNav() {
  const enMas = !PRINCIPALES.includes(state.tab);
  let html = '<nav class="bottom-nav">';
  SECCIONES.forEach(s => {
    if (s.titulo) html += `<div class="nav-seccion">${s.titulo}</div>`;
    s.items.forEach(item => { html += navBtn(item, PRINCIPALES.includes(item[0]) ? '' : 'nav-extra'); });
  });
  html += `<button class="nav-btn nav-mas ${enMas ? 'active' : ''}" onclick="toggleMas()">
      <i class="nav-icon ic ic-menu"></i><span class="nav-label">Más</span>
    </button>`;
  html += '</nav>';
  if (state.showMas) html += renderMas();
  return html;
}

// Hoja "Más" del celular: el resto de secciones
function renderMas() {
  let html = '<div class="mas-overlay" onclick="toggleMas()"><div class="mas-hoja" onclick="event.stopPropagation()">';
  SECCIONES.forEach(s => {
    const items = s.items.filter(([t]) => !PRINCIPALES.includes(t));
    if (!items.length) return;
    html += `<div class="mas-titulo">${s.titulo}</div><div class="mas-grid">`;
    items.forEach(([tab, label, icono]) => {
      html += `<button class="mas-item ${state.tab === tab ? 'active' : ''}" onclick="switchTab('${tab}')"><i class="ic ic-${icono}"></i><span>${label}</span></button>`;
    });
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}
