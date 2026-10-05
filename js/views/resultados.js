// Pestaña Resultados de una campaña (cuadro resumen) y su editor
import { ordenarCasos } from '../domain/listados.js';
import { CR_OBLIGATORIOS_MT } from '../domain/multiplicadores.js';
import { corteSubida, instalacionDeCaso, MEDICION, resultadoCaso, resumenResultados, situacionCaso } from '../domain/resultados.js';
import { hoyLocal } from '../domain/trabajo.js';
import { casosFT, DIAS_SOLUCION_FT } from '../domain/ft.js';
import { state } from '../state.js';
import { hayTXTEnMemoria } from '../actions/resultados.js';
import { UMBRAL_FT } from '../domain/analisis.js';
import { escapeHtml, fmtDate } from '../utils.js';

const esc = s => escapeHtml(s ?? '');
const CLASE_SITUACION = { sin_instalar: 'tag-gris', sin_medir: 'tag-gris', en_campo: 'tag-azul', descarga: 'tag-amarillo', descargado: 'tag-verde' };

export function filasResultados(c) {
  const hoy = hoyLocal();
  return ordenarCasos(c.casos).map(caso => {
    const inst = instalacionDeCaso(caso, state.records);
    return { caso, inst, situacion: situacionCaso(caso, inst, hoy), resultado: resultadoCaso(caso, inst) };
  });
}

const tagMedicion = r => ({
  valida: '<span class="tg verde"><i class="ic ic-check"></i> Válida</span>',
  fallida: '<span class="tg rojo"><i class="ic ic-x"></i> Fallida</span>',
  revisar: '<span class="tg ambar"><i class="ic ic-alerta"></i> Por revisar</span>',
  no_medida: '<span class="tg gris">No medida</span>',
}[r.medicion] || '');

const esFT = r => r.medicion === 'valida' && r.tolerancia === 'fuera';
const FILTRO_RES = {
  todos: () => true,
  valida: f => f.resultado.medicion === 'valida',
  ft: f => esFT(f.resultado),
  fallida: f => f.resultado.medicion === 'fallida',
  revisar: f => f.resultado.medicion === 'revisar',
  pendiente: f => !f.resultado.medicion && f.situacion.clave !== 'sin_medir',
};

// Bloque rojo con los casos fuera de tolerancia: se penalizan, hay que avisar y remedir en 90 días
function bloqueFT(c, hoy) {
  const lista = casosFT({ [c.clave]: state.campanas?.[c.clave] }, state.records, hoy);
  if (!lista.length) return '';
  const sinAviso = lista.filter(x => !x.ft.aviso && !x.cerrado).length;
  let html = '<div class="ft-bloque">';
  html += `<div class="ft-head"><div class="ft-head-ic"><i class="ic ic-sirena"></i></div><div class="ft-head-tx">
    <div class="ft-head-t">${lista.length} ${lista.length === 1 ? 'caso fuera de tolerancia' : 'casos fuera de tolerancia'}</div>
    <div class="ft-head-s">Se penalizan. Avisa a DELSUR de inmediato y normaliza con una remedición antes de ${DIAS_SOLUCION_FT} días desde la instalación.</div></div>
    ${sinAviso ? `<span class="hero-chip rojo" style="background:#fff;color:#b91c1c;border-color:#fff">${sinAviso} sin avisar</span>` : ''}</div>`;
  lista.forEach(x => {
    const pct = x.dias === null ? 0 : Math.min(100, Math.round(x.dias * 100 / DIAS_SOLUCION_FT));
    const feb = x.caso.resultado?.febNoPer;
    html += `<div class="ft-item" onclick="abrirFT('${c.clave}', '${x.id}')">
      <div class="ft-pct">${feb === undefined || feb === '' ? '—' : esc(feb) + '%'}<small>FebNoPer</small></div>
      <div class="ft-info"><b>${esc(x.codigo)}</b><div class="n">${esc(x.caso.nombre)}</div>
        <div class="tags">${x.cerrado ? '<span class="tg verde"><i class="ic ic-check"></i> Normalizado</span>' : x.ft.aviso ? `<span class="tg verde"><i class="ic ic-correo"></i> Avisado ${fmtDate(x.ft.aviso.fecha)}</span>` : '<span class="tg rojo"><i class="ic ic-correo"></i> Falta avisar a DELSUR</span>'}
          ${x.limite ? `<span class="tg ${x.vencido ? 'rojo' : 'gris'}"><i class="ic ic-reloj"></i> ${x.vencido ? 'Plazo vencido' : `Día ${x.dias} de ${DIAS_SOLUCION_FT} · hasta ${fmtDate(x.limite)}`}</span>` : '<span class="tg gris">Sin instalación registrada</span>'}
          ${x.ft.ruta ? `<span class="tg azul">${esc(x.ft.ruta)}</span>` : ''}</div>
        ${x.limite && !x.cerrado ? `<div class="ft-dias"><i class="${x.vencido || pct >= 80 ? 'mal' : ''}" style="width:${pct}%"></i></div>` : ''}</div>
      <i class="ic ic-chevron-right" style="color:var(--text3)"></i></div>`;
  });
  html += '<div class="ft-pie"><button class="b b-g" onclick="switchTab(\'ft\')"><i class="ic ic-ft"></i> Ir a Seguimiento FT</button></div>';
  return html + '</div>';
}

export function renderResultados(c) {
  const hoy = hoyLocal();
  const filas = filasResultados(c);
  const n = resumenResultados(filas);
  const filtro = FILTRO_RES[state.resultadosFiltro] ? state.resultadosFiltro : 'todos';
  const visibles = filas.filter(FILTRO_RES[filtro]);
  let html = bloqueFT(c, hoy);

  html += '<div class="bloque">';
  html += '<div class="bloque-head"><div class="bloque-titulo">Resultados de la campaña</div></div>';
  const tile = (k, v, l, clase, icono = '') => `<button class="tile ${clase} ${filtro === k ? 'sel' : ''} ${v ? '' : 'vacio'}" onclick="setResultadosFiltro('${filtro === k ? 'todos' : k}')">${icono ? `<i class="ic ic-${icono}"></i>` : ''}<span class="v">${v}</span><span class="l">${l}</span></button>`;
  html += '<div class="tiles resumen-estado-lista">'
    + tile('valida', n.valida, 'Válidas', 't-verde', 'check')
    + tile('ft', n.ft, 'Fuera de tolerancia', n.ft ? 't-rojo pulso' : 't-gris', 'sirena')
    + tile('fallida', n.fallida, 'Fallidas', 't-morado', 'x')
    + tile('revisar', n.revisar, 'Por revisar', 't-ambar', 'alerta')
    + tile('pendiente', n.pendiente, 'Sin resultado', 't-azul', 'reloj') + '</div>';
  const corte = c.area === 'CPT MT' ? corteSubida(filas, CR_OBLIGATORIOS_MT) : null;
  if (c.area === 'CPT MT') {
    const ok = n.crValidas >= CR_OBLIGATORIOS_MT;
    html += `<div class="meta ${ok ? 'ok' : ''}"><div class="meta-tx">CR obligatorios con medición válida<small>${corte.codigo ? `<b class="txt-corte">Se sube al sistema hasta ${esc(corte.codigo)}</b> · ` : `Faltan ${corte.faltan} CR válidas para saber hasta cuál se sube · `}${n.daValidas} DA y ${n.dfValidas} DF válidas${n.sinMedir ? ` · ${n.sinMedir} no se medirán` : ''}</small></div>
      <div class="meta-barra"><i style="width:${Math.min(100, Math.round(n.crValidas * 100 / CR_OBLIGATORIOS_MT))}%"></i></div><div class="meta-num">${n.crValidas}<small> / ${CR_OBLIGATORIOS_MT}</small></div></div>`;
  }
  html += `<div class="barra-acciones">
    <label class="b b-p"><i class="ic ic-subir"></i> Analizar TXT<input type="file" accept=".txt" multiple hidden onchange="analizarTXT('${c.clave}', this.files)"></label>
    ${hayTXTEnMemoria(c.clave) ? `<button class="b b-g" onclick="recalcularTXT('${c.clave}')"><i class="ic ic-repetir"></i> Recalcular con los datos actuales</button>` : ''}
    <span class="sep"></span>
    <button class="b b-g" onclick="exportarCuadroResumen('${c.clave}')"><i class="ic ic-excel"></i> Exportar cuadro resumen</button>
    <button class="b b-g" onclick="exportarAnalisis('${c.clave}')"><i class="ic ic-grafica"></i> Exportar análisis (Resumen de la macro)</button>
  </div>`;
  html += `<details class="ayuda"><summary><i class="ic ic-ayuda"></i> ¿Cómo se calculan?</summary><p>Sube los TXT de ECAMEC (el nombre del archivo es el código del caso): se validan y se calcula el FebNoPer como en la macro. Más de ${UMBRAL_FT * 100} % es fuera de tolerancia. Las advertencias quedan "por revisar": corrige el dato del caso (suele ser el nivel de tensión) y recalcula. También se puede anotar el resultado a mano tocando el caso.</p></details>`;
  html += '</div>';

  if (filtro !== 'todos') html += `<div class="filtros"><span class="pildora active">${{ valida: 'Válidas', ft: 'Fuera de tolerancia', fallida: 'Fallidas', revisar: 'Por revisar', pendiente: 'Sin resultado' }[filtro]} <b>${visibles.length}</b></span><button class="b b-l" onclick="setResultadosFiltro('todos')">Ver todos</button></div>`;

  html += '<div class="tabla-caja"><div class="tabla-scroll"><table class="tabla-r tabla-casos"><thead><tr><th>Código</th><th>Situación</th><th>Instalación</th><th>Resultado</th><th>FebNoPer</th></tr></thead><tbody>';
  // Después del corte, los CR ya no se suben al sistema
  let pasoCorte = false;
  const despuesDelCorte = new Set();
  filas.forEach(f => { if (pasoCorte && f.caso.tipo === 'CR') despuesDelCorte.add(f.caso.id); if (corte?.codigo && (f.caso.codigo || f.caso.codigoEnte) === corte.codigo) pasoCorte = true; });
  visibles.forEach(({ caso, inst, situacion, resultado: r }) => {
    const ft = esFT(r);
    const esCorte = corte?.codigo && (caso.codigo || caso.codigoEnte) === corte.codigo;
    const noSube = despuesDelCorte.has(caso.id);
    html += `<tr class="${ft ? 'fila-ft' : ''} ${esCorte ? 'fila-corte' : ''} ${noSube ? 'fila-no-sube' : ''}" onclick="abrirResultado('${c.clave}', '${caso.id}')">
      <td class="cod"><b>${esc(caso.codigo || caso.codigoEnte)}</b><small>${esc(caso.nombre)}</small>${esCorte ? '<span class="tg azul tg-corte"><i class="ic ic-bandera"></i> Hasta aquí se sube</span>' : ''}${noSube ? '<small>No se sube</small>' : ''}</td>
      <td data-l="Situación"><span class="tag ${CLASE_SITUACION[situacion.clave]}">${esc(situacion.texto)}</span></td>
      <td data-l="Instalación" class="${inst ? '' : 'vacio-m'}">${inst ? `${fmtDate(inst.fechaInstalacion)}<small>${esc(inst.serie)}${inst.fechaRetiroReal ? ' · retiro ' + fmtDate(inst.fechaRetiroReal) : ''}</small>` : '—'}</td>
      <td data-l="Resultado">${r.medicion ? `${ft ? '<span class="tg ft"><i class="ic ic-sirena"></i> Fuera de tolerancia</span>' : tagMedicion(r)}${r.tolerancia === 'dentro' ? ' <span class="tg verde">Dentro</span>' : ''}${r.desdeDescarga ? '<small>según la descarga</small>' : ''}${r.analisis ? `<small>${esc(r.analisis.detalle)}</small>` : ''}${r.nota ? `<small>${esc(r.nota)}</small>` : ''}` : situacion.clave === 'sin_medir' ? '<span class="tg gris">No medida</span>' : '<span class="falta">Pendiente</span>'}</td>
      <td data-l="FebNoPer" class="num">${r.febNoPer === '' ? '—' : `<span class="${ft ? 'ft-valor' : ''}">${esc(r.febNoPer)} %</span>`}</td>
    </tr>`;
  });
  if (!visibles.length) html += '<tr><td colspan="5" class="vacia">No hay casos con ese filtro</td></tr>';
  return html + '</tbody></table></div></div>';
}

export function renderResultadoModal() {
  const { clave, id } = state.resultadoEdit;
  const caso = state.campanas?.[clave]?.casos?.[id] || {};
  const f = state.resultadoForm;
  const seg = (k, opciones) => `<div class="segmento segmento-ancho">${Object.entries(opciones).map(([v, label]) => `<button class="${f[k] === v ? 'active' : ''}" onclick="setResultadoOpcion('${k}', '${v}')">${label}</button>`).join('')}</div>`;
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(caso.codigo || caso.codigoEnte)}</div><div class="page-sub">${esc(caso.nombre)}</div></div><button class="modal-cerrar" onclick="cerrarResultado()" title="Cerrar">✕</button></div>`;
  html += `<div class="field"><label>Medición</label>${seg('medicion', MEDICION)}</div>`;
  if (f.medicion === 'valida') {
    html += `<div class="field"><label>Tolerancia</label>${seg('tolerancia', { dentro: 'Dentro', fuera: 'Fuera (FT)' })}</div>`;
    html += `<div class="field"><label>FebNoPer (%)</label><input id="res-febNoPer" inputmode="decimal" value="${esc(f.febNoPer)}" oninput="setResultadoField('febNoPer', this.value)"></div>`;
  }
  html += `<div class="field"><label>Observaciones</label><input id="res-nota" value="${esc(f.nota)}" oninput="setResultadoField('nota', this.value)" placeholder="Por qué falló, situación final, etc."></div>`;
  html += '<button class="btn btn-primary" onclick="guardarResultado()">Guardar</button>';
  html += '<button class="btn btn-secondary" onclick="cerrarResultado()">Cancelar</button>';
  return html + '</div></div>';
}

// Vista previa del análisis de los TXT
const CLASE_ESTADO = { VALIDA: 'tag-verde', FALLIDA: 'tag-rojo', ADVERTENCIA: 'tag-amarillo' };
const fnp = v => (typeof v === 'number' ? `${(v * 100).toFixed(2)} %` : esc(v));

export function renderAnalisisModal() {
  const imp = state.analisisTXT;
  const n = { VALIDA: 0, FALLIDA: 0, ADVERTENCIA: 0 };
  imp.filas.forEach(f => { n[f.analisis.estado]++; });
  const ft = imp.filas.filter(f => f.resultado.tolerancia === 'fuera').length;
  let html = '<div class="modal-overlay"><div class="modal hoja modal-ancha">';
  html += `<div class="modal-head"><div class="modal-titulo">Análisis de ${imp.filas.length} ${imp.filas.length === 1 ? 'medición' : 'mediciones'}</div><button class="modal-cerrar" onclick="cerrarAnalisis()" title="Cerrar">✕</button></div>`;
  html += `<div class="chips-linea"><span class="tag tag-verde">${n.VALIDA} válidas</span><span class="tag tag-rojo">${n.FALLIDA} fallidas</span><span class="tag tag-amarillo">${n.ADVERTENCIA} por revisar</span>${ft ? `<span class="tag tag-rojo">${ft} fuera de tolerancia</span>` : ''}</div>`;
  if (imp.sinCaso.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>Sin caso con ese código (no se guardan): ${imp.sinCaso.map(esc).join(', ')}</div></div>`;
  const manuales = imp.filas.filter(f => f.manual);
  if (manuales.length) html += `<div class="aviso aviso-azul avisos-lista"><i class="ic ic-info"></i><div>Reemplaza el resultado anotado a mano en: ${manuales.map(f => esc(f.codigo)).join(', ')}</div></div>`;
  html += '<div class="tabla-wrap"><table class="tabla-casos"><thead><tr><th>Archivo</th><th>Estado</th><th>FebNoPer</th><th>Registros</th><th>Intervalo</th><th>Instalación</th><th>Detalle</th></tr></thead><tbody>';
  imp.filas.forEach(({ analisis: a }) => {
    html += `<tr><td class="mono"><b>${esc(a.archivo)}</b></td><td><span class="tag ${CLASE_ESTADO[a.estado]}">${a.estado === 'ADVERTENCIA' ? 'POR REVISAR' : a.estado}</span></td>
      <td class="mono ${typeof a.febNoPer === 'number' && a.febNoPer > UMBRAL_FT ? 'txt-rojo' : ''}">${fnp(a.febNoPer)}</td><td class="mono">${a.registros}</td><td>${esc(a.intervalo)}</td>
      <td>${esc(a.tipoInstalacion)}<small>${a.nivelTension || '—'} V · ${esc(a.urbanidad || '—')}</small></td><td class="col-dir">${esc(a.detalle)}</td></tr>`;
  });
  html += '</tbody></table></div>';
  html += `<button class="btn btn-primary" ${imp.filas.length ? '' : 'disabled'} onclick="guardarAnalisis()">Guardar resultados</button>`;
  html += '<button class="btn btn-secondary" onclick="cerrarAnalisis()">Cancelar</button>';
  return html + '</div></div>';
}
