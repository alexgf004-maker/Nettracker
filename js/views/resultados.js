// Pestaña Resultados de una campaña (cuadro resumen) y su editor
import { ordenarCasos } from '../domain/listados.js';
import { CR_OBLIGATORIOS_MT } from '../domain/multiplicadores.js';
import { instalacionDeCaso, MEDICION, resultadoCaso, resumenResultados, situacionCaso, TOLERANCIA } from '../domain/resultados.js';
import { hoyLocal } from '../domain/trabajo.js';
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

export function renderResultados(c) {
  const filas = filasResultados(c);
  const n = resumenResultados(filas);
  const dato = (num, label, clase = '') => `<div class="resumen-estado ${clase}"><b>${num}</b><span>${label}</span></div>`;
  let html = '<div class="panel">';
  html += `<div class="resumen-mult resumen-5">${dato(n.valida, 'Válidas')}${dato(n.fallida, 'Fallidas')}${dato(n.ft, 'Fuera de tolerancia')}${dato(n.revisar, 'Por revisar')}${dato(n.pendiente, 'Sin resultado')}</div>`;
  if (c.area === 'CPT MT') {
    const ok = n.crValidas >= CR_OBLIGATORIOS_MT;
    html += `<div class="aviso ${ok ? 'aviso-verde' : 'aviso-amarillo'}"><i class="ic ${ok ? 'ic-check' : 'ic-alerta'}"></i> ${n.crValidas} de ${CR_OBLIGATORIOS_MT} CR obligatorios con medición válida</div>`;
  }
  html += `<div class="chips-linea"><span class="chip-dato"><b>${n.crValidas}</b> CR válidas</span><span class="chip-dato"><b>${n.daValidas}</b> DA válidas</span><span class="chip-dato"><b>${n.dfValidas}</b> DF válidas</span>${n.sinMedir ? `<span class="chip-dato"><b>${n.sinMedir}</b> no medidas</span>` : ''}</div>`;
  html += `<div class="page-sub">Sube los TXT de ECAMEC (el nombre del archivo es el código del caso): se validan y se calcula el FebNoPer como en la macro. Más de ${UMBRAL_FT * 100} % es fuera de tolerancia. Las advertencias quedan "por revisar": corrige el dato del caso y recalcula. También se puede anotar el resultado a mano.</div>`;
  html += `<div class="acciones-casos">
    <label class="btn-accion"><i class="ic ic-subir"></i> Analizar TXT<input type="file" accept=".txt" multiple hidden onchange="analizarTXT('${c.clave}', this.files)"></label>
    ${hayTXTEnMemoria(c.clave) ? `<button class="btn-accion" onclick="recalcularTXT('${c.clave}')"><i class="ic ic-repetir"></i> Recalcular con los datos actuales</button>` : ''}
    <button class="btn-accion" onclick="exportarCuadroResumen('${c.clave}')"><i class="ic ic-excel"></i> Exportar cuadro resumen</button>
    <button class="btn-accion" onclick="exportarAnalisis('${c.clave}')"><i class="ic ic-grafica"></i> Exportar análisis (Resumen de la macro)</button>
  </div>`;
  html += '</div>';

  html += '<div class="tabla-wrap"><table class="tabla-casos"><thead><tr><th>Código</th><th>Situación</th><th>Instalación</th><th>Medición</th><th>Tolerancia</th><th>FebNoPer</th></tr></thead><tbody>';
  filas.forEach(({ caso, inst, situacion, resultado: r }) => {
    html += `<tr onclick="abrirResultado('${c.clave}', '${caso.id}')">
      <td class="mono"><b>${esc(caso.codigo || caso.codigoEnte)}</b><small>${esc(caso.nombre)}</small></td>
      <td><span class="tag ${CLASE_SITUACION[situacion.clave]}">${esc(situacion.texto)}</span></td>
      <td>${inst ? `${fmtDate(inst.fechaInstalacion)}<small>${esc(inst.serie)}${inst.fechaRetiroReal ? ' · retiro ' + fmtDate(inst.fechaRetiroReal) : ''}</small>` : '—'}</td>
      <td>${r.medicion ? `<span class="tag ${r.medicion === 'valida' ? 'tag-verde' : r.medicion === 'fallida' ? 'tag-rojo' : r.medicion === 'revisar' ? 'tag-amarillo' : 'tag-gris'}">${MEDICION[r.medicion]}</span>${r.desdeDescarga ? '<small>según la descarga</small>' : ''}${r.analisis ? `<small>${esc(r.analisis.detalle)}</small>` : ''}` : situacion.clave === 'sin_medir' ? '<span class="tag tag-gris">No medida</span>' : '<span class="falta">Pendiente</span>'}</td>
      <td>${r.tolerancia ? `<span class="tag ${r.tolerancia === 'fuera' ? 'tag-rojo' : 'tag-verde'}">${r.tolerancia === 'fuera' ? 'FT' : 'Dentro'}</span>` : '—'}</td>
      <td class="mono">${r.febNoPer === '' ? '—' : esc(r.febNoPer) + ' %'}</td>
    </tr>`;
  });
  return html + '</tbody></table></div>';
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
