// render(): arma la pantalla completa según el estado
import { state } from '../state.js';
import { renderCarga } from './carga.js';
import { renderDashboard } from './dashboard.js';
import { renderInstalaciones } from './instalaciones.js';
import { renderInventario } from './inventario.js';
import { renderBottomNav, renderHeader } from './layout.js';
import { renderLogin, renderMantenimiento } from './login.js';
import { renderMapa } from './mapa.js';
import { ftParaAviso, retirosParaAviso, renderAlertaRetiros, renderCondicionModal, renderDescargaModal, renderGlobalSearch, renderImportModal, renderMantModal, renderDanioModal, renderRetiroModal, renderRevisionModal, renderSelectorModal } from './modals.js';
import { renderCasoModal, renderConfigCartas, renderDocsModal, renderImportListados } from './casos.js';
import { renderProgramacionModal } from './fechas.js';
import { renderImportMultModal, renderMultModal } from './multiplicadores.js';
import { renderGraficasModal } from './graficas.js';
import { renderAnalisisReclamo, renderGraficar } from './analisis-reclamo.js';
import { nuevoGraficar } from '../actions/analisis-reclamo.js';
import { renderAnalisisModal, renderResultadoModal } from './resultados.js';
import { renderFT, renderFTModal } from './ft.js';
import { renderCampanas, renderRequerimientos } from './trabajo.js';
import { renderNuevoReclamo, renderPuntoReclamo, renderReclamos } from './expedientes.js';
import { renderValidaciones } from './validaciones.js';
import { renderDibujar } from './dibujo.js';
import { renderLevantamientos } from './levantamiento.js';

export const TAB_VIEWS = {
  dashboard: renderDashboard,
  campanas: renderCampanas,
  reclamos: renderReclamos,
  requerimientos: renderRequerimientos,
  ft: renderFT,
  instalaciones: renderInstalaciones,
  inventario: renderInventario,
  validaciones: renderValidaciones,
  mapa: renderMapa,
  graficar: () => { state.graficar ??= nuevoGraficar(); return renderGraficar(); },
  carga: renderCarga,
  dibujar: renderDibujar,
  levantamiento: renderLevantamientos,
};

// Funciones que se ejecutan después de cada redibujo (p. ej. volver a colocar el mapa del levantamiento, que no se
// reconstruye con el HTML)
const trasRender = [];
export const alRedibujar = fn => { trasRender.push(fn); };

// Redibuja toda la app a partir del estado. Cualquier handler que cambie
// el estado debe llamar render() al final.
let ultimaPantalla = null;
export function render() {
  const el = document.getElementById('app');
  if (!el) return;

  if (!state.authListo) return; // todavía no se sabe si hay sesión: queda el "Cargando…" inicial

  if (state.modoMantenimiento && state.sesionUsuario && state.sesionUsuario.nombre !== 'David García') {
    renderMantenimiento(el);
    return;
  }

  // Aviso al abrir la app (una vez por sesión): casos FT abiertos primero y retiros próximos
  if (state.sesionUsuario && !state.alertaDismissed && !state.showAlertaRetiros) {
    if (ftParaAviso().length || retirosParaAviso().length) { state.showAlertaRetiros = true; state.alertaDismissed = true; }
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
  if (state.showSelector) html += renderSelectorModal();
  if (state.showGlobalSearch) html += renderGlobalSearch();
  if (state.showImportListados) html += renderImportListados();
  if (state.casoEdit) html += renderCasoModal();
  if (state.docsModal) html += renderDocsModal();
  if (state.multEdit) html += renderMultModal();
  if (state.importProgramacion) html += renderProgramacionModal();
  if (state.importMult) html += renderImportMultModal();
  if (state.resultadoEdit) html += renderResultadoModal();
  if (state.analisisTXT) html += renderAnalisisModal();
  if (state.ftEdit) html += renderFTModal();
  if (state.showConfigCartas) html += renderConfigCartas();
  if (state.nuevoReclamo) html += renderNuevoReclamo();
  if (state.puntoReclamo) html += renderPuntoReclamo();
  if (state.analisisReclamo) html += renderAnalisisReclamo();
  if (state.graficas) html += renderGraficasModal(); // encima de los demás (se abre desde Resultados o Seguimiento FT)

  const tabView = TAB_VIEWS[state.tab];
  if (tabView) {
    let out;
    try { out = tabView(); } catch (err) {
      // Si una pantalla falla con datos inesperados, se avisa en vez de dejar la app sin responder
      console.error(err);
      out = `<div class="content"><div class="alert-banner alert-red">No se pudo mostrar esta pantalla (${String(err?.message || err).replace(/[<>&]/g, '')}). Vuelve atrás o recarga; si sigue pasando, avísale al administrador.</div></div>`;
    }
    if (out === null) return render(); // la vista cambió el estado (p. ej. registro borrado)
    html += out;
  }

  if (state.showAlertaRetiros) html += renderAlertaRetiros();
  html += renderBottomNav();

  // La animación de entrada solo al cambiar de pantalla: si se redibuja la misma (llegan datos, cada letra de un
  // buscador, marcar algo) no se repite, para que no parpadee
  const pantalla = [state.tab, state.view, state.valView, state.campanaClave, state.campanaVista, state.editEqId, state.invVista].join('|');
  el.classList.toggle('quieto', pantalla === ultimaPantalla);
  ultimaPantalla = pantalla;
  // Campo en el que se está escribiendo: se conserva lo escrito (aún sin guardar), el foco y el cursor
  const activo = document.activeElement;
  const enEdicion = activo && activo.id && el.contains(activo) && /^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName) && !activo.classList.contains('search-input')
    ? { id: activo.id, valor: activo.value, sucio: 'defaultValue' in activo && activo.value !== activo.defaultValue, ini: activo.selectionStart, fin: activo.selectionEnd } : null;
  el.innerHTML = html;
  if (enEdicion) {
    const nuevo = document.getElementById(enEdicion.id);
    if (nuevo && el.contains(nuevo)) {
      if (enEdicion.sucio && nuevo.tagName !== 'SELECT') nuevo.value = enEdicion.valor;
      nuevo.focus({ preventScroll: true });
      try { if (enEdicion.ini !== null && enEdicion.ini !== undefined) nuevo.setSelectionRange(enEdicion.ini, enEdicion.fin); } catch { /* fecha, número… no tienen cursor */ }
    }
  }
  el.dataset.view = state.tab === 'validaciones' ? 'val-' + state.valView : state.view; // el CSS de PC ajusta el ancho según la vista

  trasRender.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });

  // Restore focus to search input if one was active
  const activeSearch = el.querySelector('input.search-input[data-active="true"]');
  if (activeSearch) {
    activeSearch.focus();
    const len = activeSearch.value.length;
    activeSearch.setSelectionRange(len, len);
  }
}
