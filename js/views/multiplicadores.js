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
const CLASE_GRUPO = { listos: 'tag-verde', por_resolver: 'tag-amarillo', no_se_miden: 'tag-gris' };
const tagEstado = e => (e ? `<span class="tag ${CLASE_GRUPO[grupoDeEstado(e)]}">${esc(e)}</span>` : '<span class="falta">Sin estado</span>');

export function renderMultiplicadores(c) {
  const casos = ordenarCasos(c.casos);
  const r = resumenMultiplicadores(casos);
  const filtro = state.multFiltro || 'todos';
  const visibles = casos.filter(x => filtro === 'todos' || grupoDeEstado(x.mult?.estado) === filtro);

  let html = '<div class="panel">';
  html += '<div class="resumen-mult">';
  GRUPOS_ESTADO.forEach(([k, label]) => {
    html += `<button class="resumen-estado ${filtro === k ? 'active' : ''}" onclick="setMultFiltro('${filtro === k ? 'todos' : k}')"><b>${r.porGrupo[k]}</b><span>${label}</span></button>`;
  });
  html += '</div>';
  if (c.area === 'CPT MT') {
    const ok = r.crListos >= CR_OBLIGATORIOS_MT;
    html += `<div class="aviso ${ok ? 'aviso-verde' : 'aviso-amarillo'}"><i class="ic ${ok ? 'ic-check' : 'ic-alerta'}"></i> ${r.crListos} de ${CR_OBLIGATORIOS_MT} CR obligatorios listos para medir</div>`;
  }
  html += `<div class="chips-linea">${Object.entries(r.porEstado).sort((a, b) => b[1] - a[1]).map(([e, n]) => `<span class="chip-dato"><b>${n}</b> ${esc(e || 'Sin estado')}</span>`).join('')}</div>`;
  html += `<div class="acciones-casos"><button class="btn-accion" onclick="exportarMultiplicadores('${c.clave}')"><i class="ic ic-descargar"></i> Exportar multiplicadores</button>
    <label class="btn-accion"><i class="ic ic-subir"></i> Importar desde Excel<input type="file" accept=".xlsx,.xlsm,.xls" hidden onchange="importarMultiplicadores(this.files)"></label>
    ${filtro !== 'todos' ? '<button class="btn-link" onclick="setMultFiltro(\'todos\')">Ver todos</button>' : ''}</div>`;
  html += '</div>';

  html += '<div class="tabla-wrap"><table class="tabla-casos"><thead><tr><th>Estado</th><th>Código</th><th>Alimentador</th><th>Configuración</th><th>TAP</th><th>Multiplicador ECAMEC</th><th>DRANETZ</th><th>X medidor</th><th>TI</th><th>Testblock</th></tr></thead><tbody>';
  visibles.forEach(x => {
    const m = x.mult || {}; const k = calcularMultiplicador(m);
    html += `<tr onclick="abrirMultiplicador('${c.clave}', '${x.id}')">
      <td>${tagEstado(m.estado)}</td><td class="mono"><b>${esc(x.codigo || x.codigoEnte)}</b><small>${esc(x.nombre)}</small></td><td>${esc(x.alimentador)}</td>
      <td>${esc(m.configuracion)}</td><td>${esc(m.tap)}</td><td class="mono">${esc(k.ecamec)}</td><td class="mono">${redondear(k.dranetz)}</td>
      <td class="mono">${esc(m.xMedidor)}</td><td class="mono">${esc(k.ti)}</td><td>${esc(m.testblock)}</td></tr>`;
  });
  if (!visibles.length) html += '<tr><td colspan="10" class="tabla-vacia">No hay casos con ese filtro</td></tr>';
  return html + '</tbody></table></div>';
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
