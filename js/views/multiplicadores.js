// Pestaña Multiplicadores de una campaña: resumen por estado, tabla y editor de cada caso
import { ordenarCasos } from '../domain/listados.js';
import {
  calcularMultiplicador, CONFIGURACIONES, CR_OBLIGATORIOS_MT, estadosDe, GRUPOS_ESTADO, grupoDeEstado, historicoDe, POSICIONES_TAP,
  redondear, resumenMultiplicadores, TENSIONES_BT,
} from '../domain/multiplicadores.js';
import { MESES, nombreCampana } from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';

const esc = s => escapeHtml(s ?? '');

const TG_GRUPO = { listos: 'verde', por_resolver: 'ambar', no_se_miden: 'gris' };
const tgEstado = e => (e ? `<span class="tg ${TG_GRUPO[grupoDeEstado(e)]}">${esc(e)}</span>` : '<span class="falta">Sin estado</span>');

export function renderMultiplicadores(c) {
  const casos = ordenarCasos(c.casos);
  const r = resumenMultiplicadores(casos);
  const filtro = state.multFiltro || 'todos';
  const visibles = casos.filter(x => filtro === 'todos' || grupoDeEstado(x.mult?.estado) === filtro);

  let html = '<div class="bloque">';
  html += '<div class="bloque-head"><div class="bloque-titulo">Multiplicadores</div></div>';
  const CLASE = { listos: 't-verde', por_resolver: 't-ambar', no_se_miden: 't-gris' };
  const ICONO = { listos: 'check', por_resolver: 'alerta', no_se_miden: 'x' };
  html += '<div class="tiles resumen-mult">' + GRUPOS_ESTADO.map(([k, label]) => `<button class="tile ${CLASE[k]} ${filtro === k ? 'sel' : ''} ${r.porGrupo[k] ? '' : 'vacio'}" onclick="setMultFiltro('${filtro === k ? 'todos' : k}')"><i class="ic ic-${ICONO[k]}"></i><span class="v">${r.porGrupo[k]}</span><span class="l">${label}</span></button>`).join('') + '</div>';
  if (c.area === 'CPT MT') {
    const ok = r.crListos >= CR_OBLIGATORIOS_MT;
    html += `<div class="meta aviso ${ok ? 'ok' : ''}"><div class="meta-tx">${r.crListos} de ${CR_OBLIGATORIOS_MT} CR obligatorios listos para medir<small>${Object.entries(r.porEstado).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${n} ${esc(e || 'sin estado')}`).join(' · ')}</small></div>
      <div class="meta-barra"><i style="width:${Math.min(100, Math.round(r.crListos * 100 / CR_OBLIGATORIOS_MT))}%"></i></div><div class="meta-num">${r.crListos}<small> / ${CR_OBLIGATORIOS_MT}</small></div></div>`;
  } else {
    html += `<div class="chips-linea">${Object.entries(r.porEstado).sort((a, b) => b[1] - a[1]).map(([e, n]) => `<span class="chip-dato"><b>${n}</b> ${esc(e || 'Sin estado')}</span>`).join('')}</div>`;
  }
  html += `<div class="barra-acciones">
    <button class="b b-p" onclick="exportarMultiplicadores('${c.clave}')"><i class="ic ic-descargar"></i> Exportar multiplicadores</button>
    <label class="b b-g"><i class="ic ic-subir"></i> Importar desde Excel<input type="file" accept=".xlsx,.xlsm,.xls" hidden onchange="importarMultiplicadores(this.files)"></label>
    <span class="sep"></span>
    <button class="b b-g" onclick="exportarPorValidar('${c.clave}', 'listado')" ${r.porGrupo.por_resolver ? '' : 'disabled'} title="Excel con los puntos que faltan por validar en campo"><i class="ic ic-excel"></i> Listado por validar (${r.porGrupo.por_resolver})</button>
    <button class="b b-g" onclick="exportarPorValidar('${c.clave}', 'mapa')" ${r.porGrupo.por_resolver ? '' : 'disabled'} title="Archivo KML para importar en Google My Maps"><i class="ic ic-map-pin"></i> Mapa por validar</button>
  </div>`;
  html += '<details class="ayuda"><summary><i class="ic ic-ayuda"></i> ¿Cómo se calculan?</summary><p>Toca un caso para anotar lo que se vio en campo: configuración, posición del TAP, tensión según la placa del transformador, tensión de baja y X del medidor. El multiplicador ECAMEC, el DRANETZ y el TI se calculan con las mismas fórmulas del Excel. Si el usuario ya se midió antes, se puede usar su histórico. "Importar desde Excel" carga una hoja de multiplicadores ya hecha, con sus fechas y equipos.</p></details>';
  html += '</div>';

  if (filtro !== 'todos') html += `<div class="filtros"><span class="pildora active">${GRUPOS_ESTADO.find(([k]) => k === filtro)[1]} <b>${visibles.length}</b></span><button class="b b-l" onclick="setMultFiltro('todos')">Ver todos</button></div>`;

  html += '<div class="tabla-caja"><div class="tabla-scroll"><table class="tabla-r tabla-casos"><thead><tr><th>Código</th><th>Estado</th><th>Configuración</th><th>Multiplicador</th><th>X medidor · TI</th><th>Testblock</th></tr></thead><tbody>';
  visibles.forEach(x => {
    const m = x.mult || {}; const k = calcularMultiplicador(m);
    const tieneDatos = m.configuracion || k.ecamec;
    html += `<tr onclick="abrirMultiplicador('${c.clave}', '${x.id}')">
      <td class="cod"><b>${esc(x.codigo || x.codigoEnte)}</b><small>${esc(x.nombre)}</small>${x.alimentador ? `<small>${esc(x.alimentador)}</small>` : ''}</td>
      <td data-l="Estado">${tgEstado(m.estado)}</td>
      <td data-l="Configuración" class="${tieneDatos ? '' : 'vacio-m'}">${esc(m.configuracion) || '—'}${m.tap ? `<small>TAP ${esc(m.tap)}</small>` : ''}</td>
      <td data-l="Multiplicador" class="num ${tieneDatos ? '' : 'vacio-m'}">${esc(k.ecamec) || '—'}${k.dranetz !== null ? `<small>DRANETZ ${redondear(k.dranetz)}</small>` : ''}</td>
      <td data-l="X medidor · TI" class="num ${tieneDatos ? '' : 'vacio-m'}">${esc(m.xMedidor) || '—'}${k.ti ? `<small>TI ${esc(k.ti)}</small>` : ''}</td>
      <td data-l="Testblock" class="${m.testblock ? '' : 'vacio-m'}">${esc(m.testblock) || '—'}</td></tr>`;
  });
  if (!visibles.length) html += '<tr><td colspan="6" class="vacia tabla-vacia">No hay casos con ese filtro</td></tr>';
  return html + '</tbody></table></div></div>';
}

// Resultado calculado (se actualiza sin redibujar mientras se escribe)
export function htmlCalculo(m) {
  const k = calcularMultiplicador(m);
  const p = k.proyeccion;
  const proy = [['ab', p.ab], ['bc', p.bc], ['ac', p.ac]].filter(([, v]) => v !== null);
  return `<div class="calc"><small>Multiplicador ECAMEC</small><b class="mono">${esc(k.ecamec) || '—'}</b></div>
    <div class="calc"><small>Multiplicador DRANETZ</small><b class="mono">${redondear(k.dranetz) || '—'}</b></div>
    <div class="calc"><small>TI</small><b class="mono">${esc(k.ti) || '—'}</b></div>
    ${proy.length ? `<div class="calc calc-ancho"><small>Proyección al primario</small><b class="mono">${proy.map(([n, v]) => `${n}: ${redondear(v, 1)}`).join(' · ')}</b></div>` : ''}`;
}

export function renderMultModal() {
  const { clave, id } = state.multEdit;
  const caso = state.campanas?.[clave]?.casos?.[id] || {};
  const f = state.multForm;
  const sel = (k, opciones, vacio = '—') => `<select onchange="setMultSelect('${k}', this.value)"><option value="">${vacio}</option>${opciones.map(o => `<option ${String(f[k] ?? '') === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const inp = (k, ph = '', extra = 'inputmode="decimal"') => `<input id="mult-${k}" value="${esc(f[k])}" placeholder="${esc(ph)}" ${extra} oninput="setMultField('${k}', this.value)">`;
  const hist = historicoDe(caso.nc, state.campanas, clave);

  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(caso.codigo || caso.codigoEnte)}</div><div class="page-sub">${esc(caso.nombre)} · ${esc(caso.alimentador || 'sin alimentador')}</div></div><button class="modal-cerrar" onclick="cerrarMultiplicador()" title="Cerrar">✕</button></div>`;
  if (hist) {
    const k = calcularMultiplicador(hist.mult);
    html += `<div class="aviso aviso-azul"><i class="ic ic-reloj"></i><div style="flex:1">Histórico de ${nombreCampana(hist)} (${esc(hist.codigo)}): ${esc(hist.mult.configuracion || '')} · TAP ${esc(hist.mult.tap || '—')} · ${esc(k.ecamec)}${hist.mult.xMedidor ? ' · X ' + esc(hist.mult.xMedidor) : ''}</div>
      <button class="btn-accion" onclick="usarHistorico()">Usar</button></div>`;
  }
  html += `<div class="field"><label>Estado</label>${sel('estado', estadosDe(caso.tipo), 'Sin estado')}</div>`;
  html += `<div class="row"><div class="field"><label>Configuración</label>${sel('configuracion', CONFIGURACIONES)}</div><div class="field"><label>Posición de TAP</label>${sel('tap', POSICIONES_TAP)}</div></div>`;
  html += `<div class="row"><div class="field"><label>Tensión según TAP (V, de la placa del trafo)</label>${inp('tensionTap', '13200')}</div>
    <div class="field"><label>Tensión de baja (V)</label>${inp('tensionBT', '240', `inputmode="decimal" list="tensiones-bt"`)}<datalist id="tensiones-bt">${TENSIONES_BT.map(t => `<option value="${t}">`).join('')}</datalist></div></div>`;
  html += `<div class="row"><div class="field"><label>X medidor</label>${inp('xMedidor', '1')}</div><div class="field"><label>Testblock</label>${sel('testblock', ['Sí', 'No'])}</div></div>`;
  html += `<div class="field"><label>Lecturas de voltaje secundario (opcional, para proyectar al primario)</label><div class="row">${inp('vab', 'Vab')}${inp('vbc', 'Vbc')}${inp('vac', 'Vac')}</div></div>`;
  html += `<div class="calculo" id="mult-calculo">${htmlCalculo(f)}</div>`;
  html += `<div class="field"><label>Notas</label><input id="mult-notas" value="${esc(f.notas)}" oninput="setMultField('notas', this.value)" placeholder="Detalle o duda del caso"></div>`;
  html += '<button class="btn btn-primary" onclick="guardarMultiplicador()">Guardar</button>';
  html += '<button class="btn btn-secondary" onclick="cerrarMultiplicador()">Cancelar</button>';
  return html + '</div></div>';
}

// Vista previa del Excel de multiplicadores importado
export function renderImportMultModal() {
  const imp = state.importMult;
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div><div class="modal-titulo">Importar multiplicadores</div><div class="page-sub">${esc(imp.nombre)}</div></div><button class="modal-cerrar" onclick="cerrarImportMultiplicadores()" title="Cerrar">✕</button></div>`;
  if (!imp.planes.length) html += '<div class="aviso aviso-amarillo"><i class="ic ic-alerta"></i> Ningún caso del archivo coincide con las campañas importadas. Primero importa los listados del ente.</div>';
  imp.planes.forEach(p => {
    const g = state.campanas?.[p.clave] || {};
    const porEstado = {};
    p.asignaciones.forEach(a => { const e = a.mult.estado || 'Sin estado'; porEstado[e] = (porEstado[e] || 0) + 1; });
    html += `<div class="panel" style="margin-top:10px"><div class="panel-titulo">${MESES[(g.mes || 1) - 1]} ${g.anio} · ${esc(g.area)} <span class="chip-dato"><b>${p.asignaciones.length}</b> casos</span></div>`;
    html += `<div class="chips-linea">${Object.entries(porEstado).sort((a, b) => b[1] - a[1]).map(([e, n]) => `<span class="chip-dato"><b>${n}</b> ${esc(e)}</span>`).join('')}</div>`;
    if (p.dias.length) {
      html += '<div class="filas">' + p.dias.map(d => `<div class="panel-fila"><span>Fecha ${d.n}</span><b>${fmtDate(d.instalacion)}${d.retiro ? ' al ' + fmtDate(d.retiro) : ''} · ${d.casos} ${d.casos === 1 ? 'caso' : 'casos'}</b></div>`).join('') + '</div>';
      const conEquipo = p.asignaciones.filter(a => a.equipo).length;
      html += `<div class="page-sub" style="margin:6px 0">${conEquipo} casos con equipo asignado</div>`;
    }
    const reemplaza = p.asignaciones.filter(a => a.reemplaza);
    if (reemplaza.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>Ya tenían multiplicador y se reemplaza con el del archivo: ${reemplaza.map(a => esc(a.codigo)).join(', ')}</div></div>`;
    const corregidos = p.asignaciones.filter(a => a.codigoNuevo);
    if (corregidos.length) html += `<div class="aviso aviso-azul avisos-lista"><i class="ic ic-info"></i><div>Se actualiza el código (tipo de sistema verificado): ${corregidos.map(a => `${esc(a.codigo)} → ${esc(a.codigoNuevo)}`).join(', ')}</div></div>`;
    if (p.faltan.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>Sin datos en el archivo (quedan como están): ${p.faltan.map(esc).join(', ')}</div></div>`;
    html += '</div>';
  });
  if (imp.estadosRaros.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>Estados que la app no conoce (se guardan tal cual): ${imp.estadosRaros.map(esc).join(', ')}</div></div>`;
  if (imp.sinCaso.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>${imp.sinCaso.length} filas no coinciden con ningún caso importado: ${imp.sinCaso.slice(0, 12).map(f => esc(f.codigo)).join(', ')}${imp.sinCaso.length > 12 ? '…' : ''}</div></div>`;
  html += `<button class="btn btn-primary" style="margin-top:12px" ${imp.planes.length ? '' : 'disabled'} onclick="guardarImportMultiplicadores()">Guardar multiplicadores</button>`;
  html += '<button class="btn btn-secondary" onclick="cerrarImportMultiplicadores()">Cancelar</button>';
  return html + '</div></div>';
}
