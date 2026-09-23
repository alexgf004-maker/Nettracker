// Header y barra de navegación inferior
import { state } from '../state.js';

export function renderHeader() {
  let html = '';
  const showBack = state.view !== 'lista';
  html += `<header>
    <div class="header-left">
      ${showBack ? `<button class="back-btn" onclick="goBack()">←</button>` : ''}
      <div style="position:relative;display:inline-block">
        <div id="conn-dot" style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:#22c55e;border:1.5px solid rgba(255,255,255,.7);z-index:10"></div>
        <div class="logo-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/><path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
      <div>
        <div class="logo-text">CPT INNOVA</div>
        <div class="logo-sub">Analizadores de Red</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      ${state.view === 'lista' && state.tab === 'instalaciones' ? `<button class="btn-small" onclick="newInstall()">+ Nuevo</button>` : ''}
      ${state.view === 'lista' && state.tab === 'inventario' && !state.modoSeleccionLote ? `<button class="btn-small" onclick="newEquipo()">+ Equipo</button>` : ''}
      ${state.view === 'lista' && state.tab === 'inventario' && state.modoSeleccionLote ? `<button class="btn-small" style="background:rgba(255,255,255,.3)" onclick="cancelarLote()">✕ Cancelar</button>` : ''}
      <button onclick="toggleGlobalSearch()" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:10px;width:32px;height:32px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center">🔍</button>
      <div onclick="cerrarSesion()" title="Cerrar sesión" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;font-weight:800;color:#fff;flex-shrink:0">${(state.sesionUsuario?.nombre||' ').split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
    </div>
  </header>`;
  return html;
}

export function renderBottomNav() {
  let html = '';
  html += `<nav class="bottom-nav">
    <button class="nav-btn ${state.tab==='dashboard'?'active':''}" onclick="switchTab('dashboard')">
      <span class="nav-icon">🏠</span><span class="nav-label">Inicio</span>
    </button>
    <button class="nav-btn ${state.tab==='instalaciones'?'active':''}" onclick="switchTab('instalaciones')">
      <span class="nav-icon">⚡</span><span class="nav-label">Instalac.</span>
    </button>
    <button class="nav-btn ${state.tab==='inventario'?'active':''}" onclick="switchTab('inventario')">
      <span class="nav-icon">📦</span><span class="nav-label">Inventario</span>
    </button>
    <button class="nav-btn ${state.tab==='carga'?'active':''}" onclick="switchTab('carga')">
      <span class="nav-icon">📤</span><span class="nav-label">Despachos</span>
    </button>
    <button class="nav-btn ${state.tab==='mapa'?'active':''}" onclick="switchTab('mapa')">
      <span class="nav-icon">📍</span><span class="nav-label">Mapa</span>
    </button>
  </nav>`;
  return html;
}
