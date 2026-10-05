// Pestañas de Trabajo: Campañas, Reclamos, Requerimientos y Seguimiento FT.
// Todo se arma a partir de las instalaciones según el código del caso.
import { userArea } from '../config.js';
import {
  agruparCampanas, areaDeInstalacion, diasEntre, ETAPAS, etapaInstalacion, fechaInformeReclamo, hoyLocal,
  registrosDeTipo, subtipoCampana, urgencia,
} from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';

const esc = s => escapeHtml(s ?? '');

// Área que se está viendo: la del usuario o todas
export const areaVista = () => (state.areaFiltro === 'todas' ? null : userArea());
const delArea = r => !areaVista() || areaDeInstalacion(r) === areaVista();

export function filtroArea() {
  const mia = state.areaFiltro !== 'todas';
  return `<div class="segmento">
    <button class="${mia ? 'active' : ''}" onclick="setAreaFiltro('mia')">${userArea()}</button>
    <button class="${!mia ? 'active' : ''}" onclick="setAreaFiltro('todas')">Todas las áreas</button>
  </div>`;
}

// "faltan 3 días", "vence hoy", "venció hace 2 días"
export function textoPlazo(fecha, hoy) {
  const d = diasEntre(hoy, fecha);
  if (d === 0) return 'vence hoy';
  if (d === 1) return 'vence mañana';
  if (d > 0) return `faltan ${d} días`;
  return d === -1 ? 'venció ayer' : `venció hace ${-d} días`;
}

const CLASE_URGENCIA = { vencido: 'tag-rojo', hoy: 'tag-rojo', proximo: 'tag-amarillo', ok: 'tag-gris' };
export const tagPlazo = (fecha, hoy) => `<span class="tag ${CLASE_URGENCIA[urgencia(fecha, hoy)]}">${textoPlazo(fecha, hoy)}</span>`;

const CLASE_ETAPA = { programada: 'tag-gris', en_campo: 'tag-azul', descarga_pendiente: 'tag-amarillo', retirada: 'tag-verde' };
const tagEtapa = (r, hoy) => { const e = etapaInstalacion(r, hoy); return `<span class="tag ${CLASE_ETAPA[e]}">${ETAPAS[e]}</span>`; };

const firmado = f => (f ? `${fmtDate(f.fecha)}${f.por ? ' · ' + esc(f.por) : ''}` : '');

function vacio(icono, texto) {
  return `<div class="empty"><i class="empty-icon ic ic-${icono}"></i><div class="empty-text">${texto}</div></div>`;
}

// Fila de una instalación dentro de un caso (abre el detalle de la instalación)
function filaInstalacion(r, hoy, extra = '') {
  return `<div class="fila" onclick="goToInstall('${r.id}')">
    <div class="fila-main">
      <div class="fila-titulo mono">${esc(r.caso) || 'Sin caso'}</div>
      <div class="fila-sub">${esc(r.lugar)}${r.serie ? ' · ' + esc(r.serie) : ''}</div>
    </div>
    <div class="fila-lado">${tagEtapa(r, hoy)}${extra}</div>
  </div>`;
}

// ── CAMPAÑAS ──

export function renderCampanas() {
  const hoy = hoyLocal();
  const campanas = agruparCampanas(state.records, hoy).filter(c => !areaVista() || c.area === areaVista());
  const sel = state.campanaClave && campanas.find(c => c.clave === state.campanaClave);
  if (sel) return renderCampanaDetalle(sel, hoy);

  let html = '<div class="content">';
  html += `<div class="page-head"><div><h1 class="page-title">Campañas</h1><div class="page-sub">Casos CR, DA y DF agrupados por mes. La entrega vence el día 10 del mes siguiente.</div></div>${filtroArea()}</div>`;
  if (!campanas.length) return html + vacio('campanas', 'No hay instalaciones con códigos de campaña (CR, DA o DF).') + '</div>';
  html += '<div class="list">';
  campanas.forEach(c => {
    const entrega = state.campanas?.[c.clave]?.entrega;
    const r = c.resumen;
    html += `<div class="card" onclick="abrirCampanaTrabajo('${c.clave}')"><div class="card-inner">
      <div class="card-top"><div><div class="card-titulo">${c.nombre}</div><div class="card-sub">${c.area}</div></div>
        ${entrega ? '<span class="tag tag-verde"><i class="ic ic-check"></i> Entregada</span>' : tagPlazo(c.fechaEntrega, hoy)}</div>
      <div class="chips-linea">${['CR', 'DA', 'DF'].filter(s => c.subtipos[s]).map(s => `<span class="chip-dato"><b>${c.subtipos[s]}</b> ${s}</span>`).join('')}<span class="chip-dato"><b>${r.total}</b> ${r.total === 1 ? 'medición' : 'mediciones'}</span></div>
      ${barraEtapas(r)}
      <div class="card-footer"><span class="card-date">Entrega ${fmtDate(c.fechaEntrega)}</span><span class="card-date">${entrega ? 'Entregada ' + firmado(entrega) : ''}</span></div>
    </div></div>`;
  });
  return html + '</div></div>';
}

function barraEtapas(r) {
  const partes = [['programada', 'gris'], ['en_campo', 'azul'], ['descarga_pendiente', 'amarillo'], ['retirada', 'verde']];
  let barra = '<div class="barra">';
  partes.forEach(([k, color]) => { if (r[k]) barra += `<span class="barra-${color}" style="flex:${r[k]}"></span>`; });
  barra += '</div><div class="barra-leyenda">';
  partes.forEach(([k, color]) => { if (r[k]) barra += `<span><i class="punto punto-${color}"></i>${r[k]} ${ETAPAS[k].toLowerCase()}</span>`; });
  return barra + '</div>';
}

function renderCampanaDetalle(c, hoy) {
  const entrega = state.campanas?.[c.clave]?.entrega;
  const pendientesDescarga = c.resumen.descarga_pendiente;
  const enCampo = c.resumen.en_campo + c.resumen.programada;
  let html = '<div class="content">';
  html += `<div class="page-head"><div><h1 class="page-title">${c.nombre}</h1><div class="page-sub">${c.area} · ${c.resumen.total} ${c.resumen.total === 1 ? 'medición' : 'mediciones'}</div></div></div>`;
  html += '<div class="panel">';
  html += `<div class="panel-fila"><span>Entrega en el sistema CPT DELSUR</span><b>${fmtDate(c.fechaEntrega)}</b></div>`;
  if (entrega) {
    html += `<div class="aviso aviso-verde"><i class="ic ic-check"></i> Entregada el ${firmado(entrega)}</div>`;
    html += `<button class="btn btn-secondary" onclick="desmarcarCampanaEntregada('${c.clave}')">Quitar marca de entregada</button>`;
  } else {
    html += `<div class="panel-fila"><span>Plazo</span>${tagPlazo(c.fechaEntrega, hoy)}</div>`;
    if (enCampo || pendientesDescarga) {
      html += `<div class="aviso aviso-amarillo"><i class="ic ic-alerta"></i> ${[enCampo ? enCampo + ' en campo o programadas' : '', pendientesDescarga ? pendientesDescarga + ' con descarga pendiente' : ''].filter(Boolean).join(' y ')}</div>`;
    }
    html += `<button class="btn btn-primary" onclick="marcarCampanaEntregada('${c.clave}')"><i class="ic ic-check"></i> Marcar como cargada en CPT DELSUR</button>`;
  }
  html += '</div>';
  html += barraEtapas(c.resumen);
  html += '<div class="section-title" style="margin-top:16px">Mediciones</div><div class="filas">';
  [...c.registros].sort((a, b) => (a.caso || '').localeCompare(b.caso || ''))
    .forEach(r => { html += filaInstalacion(r, hoy, `<span class="tag tag-gris">${subtipoCampana(r.caso)}</span>`); });
  return html + '</div></div>';
}

// ── RECLAMOS ──

export function renderReclamos() {
  const hoy = hoyLocal();
  const reclamos = registrosDeTipo(state.records, 'reclamo').filter(delArea);
  let html = '<div class="content">';
  html += `<div class="page-head"><div><h1 class="page-title">Reclamos</h1><div class="page-sub">Casos RE. El informe se entrega 8 días calendario después del retiro.</div></div>${filtroArea()}</div>`;
  if (!reclamos.length) return html + vacio('reclamos', 'No hay instalaciones con códigos de reclamo (RE).') + '</div>';

  const informe = reclamos.filter(r => r.retirado && !r.informeEntregado)
    .sort((a, b) => (fechaInformeReclamo(a.fechaRetiroReal) || '').localeCompare(fechaInformeReclamo(b.fechaRetiroReal) || ''));
  const enCampo = reclamos.filter(r => !r.retirado);
  const entregados = reclamos.filter(r => r.retirado && r.informeEntregado);

  html += seccion('Informe pendiente', informe.length, informe.map(r => {
    const limite = fechaInformeReclamo(r.fechaRetiroReal);
    return filaConAccion(r, hoy, limite ? `Informe para el ${fmtDate(limite)} ${tagPlazo(limite, hoy)}` : 'Sin fecha de retiro registrada',
      `<button class="btn-accion" onclick="marcarInformeEntregado('${r.id}')"><i class="ic ic-check"></i> Informe entregado</button>`);
  }));
  html += seccion('En campo', enCampo.length, enCampo.map(r => filaConAccion(r, hoy, r.fechaRetiro ? `Retiro programado ${fmtDate(r.fechaRetiro)}` : '', '')));
  html += seccion('Informe entregado', entregados.length, entregados.map(r => filaConAccion(r, hoy, `Entregado ${firmado(r.informeEntregado)}`,
    `<button class="btn-link" onclick="desmarcarInformeEntregado('${r.id}')">Deshacer</button>`)));
  return html + '</div>';
}

function seccion(titulo, n, filas) {
  if (!n) return '';
  return `<div class="section-title">${titulo} (${n})</div><div class="filas">${filas.join('')}</div>`;
}

function filaConAccion(r, hoy, linea, accion) {
  return `<div class="fila fila-con-accion">
    <div class="fila-main">
      <div class="fila-link" onclick="goToInstall('${r.id}')">
        <div class="fila-titulo mono">${esc(r.caso) || 'Sin caso'} ${tagEtapa(r, hoy)}</div>
        <div class="fila-sub">${esc(r.lugar)}${r.serie ? ' · ' + esc(r.serie) : ''}</div>
      </div>
      ${linea ? `<div class="fila-plazo">${linea}</div>` : ''}
    </div>
    ${accion ? `<div class="fila-accion">${accion}</div>` : ''}
  </div>`;
}

// ── REQUERIMIENTOS ──

export function renderRequerimientos() {
  const hoy = hoyLocal();
  const reqs = registrosDeTipo(state.records, 'requerimiento').filter(delArea);
  let html = '<div class="content">';
  html += `<div class="page-head"><div><h1 class="page-title">Requerimientos</h1><div class="page-sub">Mediciones esporádicas (otros códigos). La fecha de entrega se anota en cada una.</div></div>${filtroArea()}</div>`;
  if (!reqs.length) return html + vacio('requerimientos', 'No hay requerimientos registrados.') + '</div>';

  const pendientes = reqs.filter(r => !r.entregaRealizada)
    .sort((a, b) => (a.entregaLimite || '9').localeCompare(b.entregaLimite || '9') || (b.fechaInstalacion || '').localeCompare(a.fechaInstalacion || ''));
  const entregados = reqs.filter(r => r.entregaRealizada);

  html += seccion('Por entregar', pendientes.length, pendientes.map(r => filaConAccion(r, hoy,
    `<label class="fecha-inline">Entrega <input type="date" value="${r.entregaLimite || ''}" onchange="setEntregaLimite('${r.id}', this.value)"></label>${r.entregaLimite ? ' ' + tagPlazo(r.entregaLimite, hoy) : ''}`,
    `<button class="btn-accion" onclick="marcarRequerimientoEntregado('${r.id}')"><i class="ic ic-check"></i> Entregado</button>`)));
  html += seccion('Entregados', entregados.length, entregados.map(r => filaConAccion(r, hoy, `Entregado ${firmado(r.entregaRealizada)}`,
    `<button class="btn-link" onclick="desmarcarRequerimientoEntregado('${r.id}')">Deshacer</button>`)));
  return html + '</div>';
}

// ── SEGUIMIENTO FT ──

export function renderFT() {
  return `<div class="content">
    <div class="page-head"><div><h1 class="page-title">Seguimiento FT</h1></div></div>
    ${vacio('ft', 'El seguimiento de casos FT se agregará en una próxima etapa, cuando definamos juntos cómo se registra cada caso.')}
  </div>`;
}
