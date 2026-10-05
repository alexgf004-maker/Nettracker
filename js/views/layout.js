import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { icon } from './icons.js';

export function renderHeader() {
  const showBack = state.view !== 'lista';
  const initials = (state.sesionUsuario?.nombre || '').split(' ').map(word => word[0]).slice(0, 2).join('');
  const add = state.view !== 'lista' ? ''
    : state.tab === 'campaigns' ? '<button class="btn-small" onclick="newCampaign()">+ Campaña</button>'
    : state.tab === 'complaints' ? '<button class="btn-small" onclick="newComplaint()">+ Reclamo</button>'
    : state.tab === 'inventario' ? (state.modoSeleccionLote
      ? '<button class="btn-small" onclick="cancelarLote()">Cancelar</button>'
      : '<button class="btn-small" onclick="newEquipo()">+ Equipo</button>')
    : state.tab === 'case_archive' ? '<button class="btn-small" onclick="newCase()">+ Caso</button>'
    : state.tab === 'instalaciones' ? (state.instSection === 'cases'
      ? '<button class="btn-small" onclick="newCase()">+ Caso</button>'
      : state.instSection === 'campaigns' ? '<button class="btn-small" onclick="newCampaign()">+ Campaña</button>'
        : '<button class="btn-small" onclick="newInstall()">+ Nuevo</button>') : '';
  return `<header><div class="header-left">
    ${showBack ? `<button class="back-btn" onclick="goBack()" aria-label="Volver">${icon('back')}</button>` : ''}
    <div class="logo-mark">${icon('activity')}<span id="conn-dot" class="connection-dot" title="Estado de conexión"></span></div>
    <div><div class="logo-text">CPT <span>INNOVA</span></div><div class="logo-sub">Calidad del producto técnico</div></div>
    </div><div class="header-actions">${add}
    <button class="header-icon-button" onclick="toggleGlobalSearch()" aria-label="Buscar">${icon('search')}</button>
    <button class="profile-button" onclick="cerrarSesion()" aria-label="Cambiar perfil" title="${escapeHtml(state.sesionUsuario?.nombre || '')}">${escapeHtml(initials)}</button>
    </div></header>`;
}

export function renderBottomNav() {
  const tabs = [
    ['dashboard', 'Inicio', 'home'], ['campaigns', 'Campañas', 'calendar'],
    ['complaints', 'Reclamos', 'clipboard'], ['inventario', 'Equipos', 'equipment'],
    ['operations', 'Operación', 'activity'],
  ];
  const inOperations = ['operations', 'instalaciones', 'validaciones', 'carga', 'mapa', 'case_archive', 'operational_dashboard'].includes(state.tab);
  return `<nav class="bottom-nav" aria-label="Navegación principal">${tabs.map(([tab, label, symbol]) => {
    const active = state.tab === tab || tab === 'operations' && inOperations;
    return `<button class="nav-btn ${active ? 'active' : ''}" onclick="switchTab('${tab}')" ${active ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(symbol)}</span><span class="nav-label">${label}</span></button>`;
  }).join('')}</nav>`;
}
