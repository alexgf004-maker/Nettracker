// render(): arma la pantalla completa según el estado
import { userArea } from '../config.js';
import { state } from '../state.js';
import { daysUntil } from '../utils.js';
import { renderCarga } from './carga.js';
import { renderDashboard } from './dashboard.js';
import { renderInstalaciones } from './instalaciones.js';
import { renderInventario } from './inventario.js';
import { renderBottomNav, renderHeader } from './layout.js';
import { renderLogin, renderMantenimiento } from './login.js';
import { renderMapa } from './mapa.js';
import { renderAlertaRetiros, renderCondicionModal, renderDescargaModal, renderGlobalSearch, renderImportModal, renderMantModal, renderPrestamoModal, renderDanioModal, renderRetiroModal, renderRevisionModal, renderSelectorModal } from './modals.js';
import { renderValidaciones } from './validaciones.js';

export const TAB_VIEWS = {
  dashboard: renderDashboard,
  instalaciones: renderInstalaciones,
  inventario: renderInventario,
  validaciones: renderValidaciones,
  mapa: renderMapa,
  carga: renderCarga,
};

// Redibuja toda la app a partir del estado. Cualquier handler que cambie
// el estado debe llamar render() al final.
export function render() {
  const el = document.getElementById('app');
  if (!el) return;

  if (state.modoMantenimiento && state.sesionUsuario && state.sesionUsuario.nombre !== 'David García') {
    renderMantenimiento(el);
    return;
  }

  // Auto-show alerta if not dismissed and has upcoming retiros
  if (state.sesionUsuario && !state.alertaDismissed && !state.showAlertaRetiros) {
    const ua = userArea(); const proximos = state.records.filter(r => !r.retirado && daysUntil(r.fechaRetiro) <= 3 && daysUntil(r.fechaRetiro) >= 0 && (r.areaInstalacion||'CPT MT') === ua);
    if (proximos.length > 0) { state.showAlertaRetiros = true; state.alertaDismissed = true; }
  }

  if (!state.sesionUsuario) {
    renderLogin(el);
    return;
  }

  let html = renderHeader();
  if (state.showRetiroModal) html += renderRetiroModal();
  if (state.showDescargaModal) html += renderDescargaModal();
  if (state.showImportModal) html += renderImportModal();
  if (state.showMantModal) html += renderMantModal();
  if (state.showCondicionModal) html += renderCondicionModal();
  if (state.showRevisionModal) html += renderRevisionModal();
  if (state.showDanioModal) html += renderDanioModal();
  if (state.showPrestamoModal) html += renderPrestamoModal();
  if (state.showSelector) html += renderSelectorModal();
  if (state.showGlobalSearch) html += renderGlobalSearch();

  const tabView = TAB_VIEWS[state.tab];
  if (tabView) {
    const out = tabView();
    if (out === null) return render(); // la vista cambió el estado (p. ej. registro borrado)
    html += out;
  }

  if (state.showAlertaRetiros) html += renderAlertaRetiros();
  html += renderBottomNav();

  el.innerHTML = html;

  // Restore focus to search input if one was active
  const activeSearch = el.querySelector('input.search-input[data-active="true"]');
  if (activeSearch) {
    activeSearch.focus();
    const len = activeSearch.value.length;
    activeSearch.setSelectionRange(len, len);
  }
}
