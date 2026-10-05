// Pestañas de Trabajo: Campañas, Reclamos, Requerimientos y Seguimiento FT.
// Todo se arma a partir de las instalaciones según el código del caso.
import { userArea } from '../config.js';
import {
  agruparCampanas, areaDeInstalacion, diasEntre, ETAPAS, etapaInstalacion, fechaInformeReclamo, hoyLocal,
  registrosDeTipo, subtipoCampana, urgencia,
} from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { avancePrecampana, renderCasosCampana, renderPrecampana } from './casos.js';
import { contarTipos, faltantes } from '../domain/listados.js';
import { grupoDeEstado, resumenMultiplicadores } from '../domain/multiplicadores.js';
import { resumenResultados } from '../domain/resultados.js';
import { renderFechas } from './fechas.js';
import { renderMultiplicadores } from './multiplicadores.js';
import { filasResultados, renderResultados } from './resultados.js';

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

// Avance de una campaña por paso del proceso (lo usan la lista y el encabezado del detalle)
export function avanceCampana(c) {
  const g = state.campanas?.[c.clave] || {};
  const casos = c.casos;
  const pre = avancePrecampana(c);
  const mult = resumenMultiplicadores(casos);
  const listos = casos.filter(x => grupoDeEstado(x.mult?.estado) === 'listos');
  const conFecha = casos.filter(x => x.programa?.fecha).length;
  const fechas = new Set(casos.map(x => x.programa?.fecha).filter(Boolean)).size;
  const filas = casos.length ? filasResultados(c) : [];
  const res = resumenResultados(filas);
  const ft = filas.filter(f => f.resultado.medicion === 'valida' && f.resultado.tolerancia === 'fuera');
  const ftSinAviso = ft.filter(f => !f.caso.ft?.aviso).length;
  const pasos = [
    ['precampana', 'Precampaña', pre.hechos === pre.total],
    ['multiplicadores', 'Multiplicadores', casos.length > 0 && mult.porGrupo.por_resolver === 0],
    ['fechas', 'Fechas', listos.length > 0 && listos.every(x => x.programa?.fecha)],
    ['resultados', 'Resultados', res.valida > 0 && res.pendiente === 0 && res.revisar === 0],
    ['entrega', 'Entrega', !!g.entrega],
  ];
  return { pre, mult, listos: listos.length, conFecha, fechas, res, ft, ftSinAviso, pasos, entrega: g.entrega };
}

const CLASE_CHIP_PLAZO = { vencido: 'rojo', hoy: 'rojo', proximo: 'ambar', ok: '' };

export function renderCampanas() {
  const hoy = hoyLocal();
  const campanas = agruparCampanas(state.records, hoy, state.campanas).filter(c => !areaVista() || c.area === areaVista());
  const sel = state.campanaClave && campanas.find(c => c.clave === state.campanaClave);
  if (sel) return renderCampanaDetalle(sel, hoy);

  let html = '<div class="content">';
  html += `<div class="hero"><div class="hero-top"><div><div class="hero-eyebrow">Trabajo</div><h1 class="hero-titulo">Campañas</h1>
    <div class="hero-sub">Casos CR, DA y DF por mes. La entrega en el sistema CPT DELSUR vence el día 10 del mes siguiente.</div></div></div>
    <div class="hero-acciones page-hero-acciones"><button class="hero-btn blanco" onclick="abrirImportListados()"><i class="ic ic-subir"></i> Importar listados del ente</button>${filtroAreaHero()}</div></div>`;
  if (!campanas.length) return html + vacio('campanas', 'Todavía no hay campañas. Importa los listados que manda el ente para empezar la precampaña.') + '</div>';
  html += '<div class="list">';
  campanas.forEach(c => {
    const a = avanceCampana(c);
    const r = c.resumen;
    const actual = a.pasos.findIndex(([, , ok]) => !ok);
    const total = c.casos.length || r.total;
    html += `<div class="camp-card" onclick="abrirCampanaTrabajo('${c.clave}')">
      <div class="camp-card-top ${a.entrega ? 'entregada' : ''}"><div><div class="hero-eyebrow">${esc(c.area)}</div><div class="hero-titulo" style="font-size:19px">${c.nombre}</div></div>
        ${a.entrega ? '<span class="hero-chip"><i class="ic ic-check"></i> Entregada</span>' : `<span class="hero-chip ${CLASE_CHIP_PLAZO[urgencia(c.fechaEntrega, hoy)]}">${textoPlazo(c.fechaEntrega, hoy)}</span>`}</div>
      <div class="camp-card-cuerpo">
        ${c.casos.length ? `<div class="camp-pasos">${a.pasos.map(([, , ok], i) => `<i class="${ok ? 'ok' : i === actual ? 'en' : ''}" title="${a.pasos[i][1]}"></i>`).join('')}</div>
        <div class="camp-pasos-l"><span>${actual < 0 ? 'Todo listo' : 'Paso actual: ' + a.pasos[actual][1]}</span><span>Entrega ${fmtDate(c.fechaEntrega)}</span></div>` : `<div class="camp-pasos-l" style="margin-top:4px"><span>${r.total} ${r.total === 1 ? 'medición registrada' : 'mediciones registradas'}</span><span>Entrega ${fmtDate(c.fechaEntrega)}</span></div>`}
        <div class="camp-datos">
          <div class="camp-dato"><b>${total}</b> <span>${total === 1 ? 'caso' : 'casos'}</span></div>
          <div class="camp-dato"><b>${a.listos}</b> <span>listos</span></div>
          <div class="camp-dato"><b>${a.res.valida}</b> <span>válidas</span></div>
          <div class="camp-dato ${a.ft.length ? 'rojo' : ''}"><b>${a.ft.length}</b> <span>FT</span></div>
        </div>
      </div></div>`;
  });
  return html + '</div></div>';
}

// Selector de área sobre fondo oscuro
function filtroAreaHero() {
  const mia = state.areaFiltro !== 'todas';
  return `<button class="hero-btn" onclick="setAreaFiltro('${mia ? 'todas' : 'mia'}')"><i class="ic ic-capas"></i> ${mia ? `Solo ${userArea()}` : 'Todas las áreas'}</button>`;
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
  const a = avanceCampana(c);
  const entrega = a.entrega;
  const pendientesDescarga = c.resumen.descarga_pendiente;
  const enCampo = c.resumen.en_campo + c.resumen.programada;
  const n = contarTipos(c.casos);
  let html = '<div class="content">';

  // Encabezado: campaña, plazo de entrega y lo más importante en números
  const plazo = entrega
    ? `<span class="hero-chip verde"><i class="ic ic-check"></i> Entregada el ${firmado(entrega)}</span>`
    : `<span class="hero-chip ${CLASE_CHIP_PLAZO[urgencia(c.fechaEntrega, hoy)]}"><i class="ic ic-calendario"></i> Entrega ${fmtDate(c.fechaEntrega)} · ${textoPlazo(c.fechaEntrega, hoy)}</span>`;
  const enCurso = [enCampo ? `${enCampo} en campo o programadas` : '', pendientesDescarga ? `${pendientesDescarga} con descarga pendiente` : ''].filter(Boolean).join(' · ');
  const tipos = ['CR', 'DA', 'DF'].filter(t => n[t]).map(t => `${n[t]} ${t}`).join(' · ');
  html += `<div class="hero"><div class="hero-top"><div><div class="hero-eyebrow">Campaña ${esc(c.area)}</div><h1 class="hero-titulo">${c.nombre}</h1>
      <div class="hero-sub">${[tipos, enCurso].filter(Boolean).join(' · ') || `${c.resumen.total} ${c.resumen.total === 1 ? 'medición' : 'mediciones'}`}</div></div>
      <div class="hero-acciones">${plazo}</div></div>`;
  if (c.casos.length) {
    html += `<div class="hero-kpis">
      <button class="hero-kpi" onclick="setCampanaVista('casos')"><b>${c.casos.length}</b><span>Casos</span></button>
      <button class="hero-kpi" onclick="setCampanaVista('multiplicadores')"><b>${a.listos}</b><span>Listos para medir</span></button>
      <button class="hero-kpi" onclick="setCampanaVista('resultados')"><b>${a.res.valida}</b><span>Mediciones válidas</span></button>
      <button class="hero-kpi ${a.ft.length ? 'alerta' : ''}" onclick="verFTCampana()"><b>${a.ft.length}</b><span>${a.ft.length ? (a.ftSinAviso ? `FT · ${a.ftSinAviso} sin avisar` : 'Fuera de tolerancia') : 'Fuera de tolerancia'}</span></button>
    </div>`;
  }
  html += `<div class="hero-acciones" style="margin-top:12px">${entrega
    ? `<button class="hero-btn" onclick="desmarcarCampanaEntregada('${c.clave}')">Quitar marca de entregada</button>`
    : `<button class="hero-btn blanco" onclick="marcarCampanaEntregada('${c.clave}')"><i class="ic ic-check"></i> Marcar como cargada en CPT DELSUR</button>`}</div>`;
  html += '</div>';

  // Pestañas como pasos del proceso, cada una con su estado
  const pasoOk = Object.fromEntries(a.pasos.map(([k, , ok]) => [k, ok]));
  const faltan = c.casos.filter(x => faltantes(x).length).length;
  const secciones = [
    ['precampana', 'Precampaña', 'pasos', `${a.pre.hechos} de ${a.pre.total} pasos`],
    ['casos', 'Casos', 'usuarios', faltan ? `${faltan} con datos faltantes` : `${c.casos.length} casos completos`],
    ['multiplicadores', 'Multiplicadores', 'sliders', `${a.listos} listos · ${a.mult.porGrupo.por_resolver} por resolver`],
    ['fechas', 'Fechas', 'calendario-dias', a.fechas ? `${a.fechas} ${a.fechas === 1 ? 'fecha' : 'fechas'} · ${a.conFecha} casos` : 'Sin programar'],
    ['resultados', 'Resultados', 'grafica', `${a.res.valida} válidas · ${a.res.pendiente} pendientes`],
    ['mediciones', 'Mediciones', 'instalaciones', `${c.registros.length} en la app`],
  ].filter(([k]) => c.casos.length || k === 'mediciones');
  const vista = secciones.some(([k]) => k === state.campanaVista) ? state.campanaVista : secciones[0][0];
  if (secciones.length > 1) {
    html += '<div class="pasos-tabs" role="tablist">' + secciones.map(([k, label, icono, estado]) => {
      const alerta = k === 'resultados' && a.ft.length;
      const listo = !alerta && (k === 'casos' ? !faltan : pasoOk[k]);
      return `<button role="tab" class="paso-tab ${vista === k ? 'active' : ''} ${listo ? 'listo' : ''} ${alerta ? 'alerta' : ''}" onclick="setCampanaVista('${k}')">
        <span class="paso-tab-ic"><i class="ic ic-${listo ? 'check' : icono}"></i></span><span class="paso-tab-tx"><b>${label}</b><small>${estado}</small></span>
        ${alerta ? `<span class="badge-ft">${a.ft.length} FT</span>` : ''}</button>`;
    }).join('') + '</div>';
  }
  if (vista === 'precampana') html += renderPrecampana(c);
  if (vista === 'casos') html += renderCasosCampana(c);
  if (vista === 'multiplicadores') html += renderMultiplicadores(c);
  if (vista === 'fechas') html += renderFechas(c);
  if (vista === 'resultados') html += renderResultados(c, a);
  if (vista === 'mediciones') {
    if (!c.registros.length) return html + vacio('instalaciones', 'Todavía no hay instalaciones registradas con códigos de esta campaña.') + '</div>';
    html += `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Mediciones en la app <span class="cuenta">${c.registros.length}</span></div></div>${barraEtapas(c.resumen)}</div>`;
    html += '<div class="filas">';
    [...c.registros].sort((x, y) => (x.caso || '').localeCompare(y.caso || ''))
      .forEach(r => { html += filaInstalacion(r, hoy, `<span class="tag tag-gris">${subtipoCampana(r.caso)}</span>`); });
    html += '</div>';
  }
  return html + '</div>';
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
