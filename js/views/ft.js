// Pestaña Seguimiento FT: casos fuera de tolerancia de todas las campañas, con su plazo de 90 días
import { casosFT, DIAS_SOLUCION_FT, RUTAS_FT } from '../domain/ft.js';
import { hoyLocal, nombreCampana } from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { areaVista, filtroArea, tagPlazo } from './trabajo.js';

const esc = s => escapeHtml(s ?? '');

export function renderFT() {
  const hoy = hoyLocal();
  const lista = casosFT(state.campanas, state.records, hoy).filter(x => !areaVista() || x.area === areaVista());
  let html = '<div class="content">';
  html += `<div class="page-head"><div><h1 class="page-title">Seguimiento FT</h1><div class="page-sub">Casos fuera de tolerancia. Hay ${DIAS_SOLUCION_FT} días calendario desde la instalación de la medición inicial; solo la remedición normalizada cierra el caso.</div></div>${filtroArea()}</div>`;
  if (!lista.length) {
    return html + `<div class="empty"><i class="empty-icon ic ic-ft"></i><div class="empty-text">No hay casos fuera de tolerancia. Aparecen aquí al marcar un resultado como "Fuera (FT)" en la pestaña Resultados de la campaña.</div></div></div>`;
  }
  const abiertos = lista.filter(x => !x.cerrado);
  const cerrados = lista.filter(x => x.cerrado);
  const tarjeta = x => {
    const pct = x.dias === null ? 0 : Math.min(100, Math.round(x.dias * 100 / DIAS_SOLUCION_FT));
    return `<div class="card" onclick="abrirFT('${x.clave}', '${x.id}')"><div class="card-inner">
      <div class="card-top"><div><div class="card-titulo mono">${esc(x.codigo)}</div><div class="card-sub">${esc(x.caso.nombre)} · ${nombreCampana(x)} · ${esc(x.area)}</div></div>
        ${x.cerrado ? '<span class="tag tag-verde"><i class="ic ic-check"></i> Cerrado</span>' : x.limite ? tagPlazo(x.limite, hoy) : '<span class="falta">Sin fecha de instalación</span>'}</div>
      ${x.dias !== null ? `<div class="barra"><span class="${x.vencido ? 'barra-rojo' : pct >= 80 ? 'barra-amarillo' : 'barra-azul'}" style="flex:${pct}"></span><span style="flex:${100 - pct}"></span></div>
        <div class="barra-leyenda"><span>Día ${x.dias} de ${DIAS_SOLUCION_FT}</span><span>Instalación ${fmtDate(x.inicio)} · plazo ${fmtDate(x.limite)}</span></div>` : ''}
      <div class="chips-linea">
        ${x.ft.aviso ? `<span class="tag tag-verde">Aviso enviado ${fmtDate(x.ft.aviso.fecha)}</span>` : '<span class="tag tag-rojo">Falta avisar a DELSUR</span>'}
        ${x.ft.ruta ? `<span class="chip-dato">${esc(x.ft.ruta)}</span>` : ''}
        ${x.remedicionInstalada ? `<span class="chip-dato">Remedición ${esc(x.remedicionInstalada.codigo)} ${x.remedicionInstalada.retirado ? 'retirada' : 'en campo'}</span>` : ''}
        ${x.vencido ? '<span class="tag tag-rojo">Más de 90 días: se penalizan los 90 días y la compensación sigue</span>' : ''}
      </div>
    </div></div>`;
  };
  if (abiertos.length) html += `<div class="section-title">Abiertos (${abiertos.length})</div><div class="list">${abiertos.map(tarjeta).join('')}</div>`;
  if (cerrados.length) html += `<div class="section-title" style="margin-top:16px">Cerrados (${cerrados.length})</div><div class="list">${cerrados.map(tarjeta).join('')}</div>`;
  return html + '</div>';
}

export function renderFTModal() {
  const { clave, id } = state.ftEdit;
  const x = casosFT({ [clave]: state.campanas?.[clave] }, state.records, hoyLocal()).find(f => f.id === id);
  if (!x) return '';
  const ft = x.ft; const rem = ft.remedicion || {};
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(x.codigo)}</div><div class="page-sub">${esc(x.caso.nombre)} · FebNoPer ${esc(x.caso.resultado?.febNoPer ?? '—')} %</div></div><button class="modal-cerrar" onclick="cerrarFT()" title="Cerrar">✕</button></div>`;
  html += `<div class="panel-fila"><span>Instalación de la medición inicial</span><b>${fmtDate(x.inicio)}</b></div>`;
  html += `<div class="panel-fila"><span>Plazo de ${DIAS_SOLUCION_FT} días</span><b>${fmtDate(x.limite)}${x.dias !== null ? ` · día ${x.dias}` : ''}</b></div>`;

  html += '<div class="section-title" style="margin-top:12px">1. Aviso a DELSUR</div>';
  html += ft.aviso
    ? `<div class="aviso aviso-verde"><i class="ic ic-check"></i> Enviado el ${fmtDate(ft.aviso.fecha)} por ${esc(ft.aviso.por)} <button class="btn-link" onclick="quitarAvisoFT('${clave}', '${id}')">Deshacer</button></div>`
    : `<button class="btn btn-primary" onclick="marcarAvisoFT('${clave}', '${id}')"><i class="ic ic-correo"></i> Marcar aviso enviado por correo</button>`;

  html += '<div class="section-title" style="margin-top:12px">2. Ruta de solución</div>';
  html += `<div class="field"><select onchange="setRutaFT('${clave}', '${id}', this.value)"><option value="">Sin definir</option>${RUTAS_FT.map(r => `<option ${ft.ruta === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`;
  html += `<div class="field"><label>Compensación diaria informada (el cálculo de montos está pendiente de definir)</label><input inputmode="decimal" value="${esc(ft.compensacionDiaria ?? '')}" onchange="setCompensacionFT('${clave}', '${id}', this.value)"></div>`;

  html += '<div class="section-title" style="margin-top:12px">Bitácora</div><div class="filas">';
  (ft.notas || []).forEach(n => { html += `<div class="fila"><div class="fila-main"><div class="fila-sub">${fmtDate(n.fecha)} · ${esc(n.por)}</div><div>${esc(n.texto)}</div></div></div>`; });
  html += `</div><div class="row"><input id="ft-nota" value="${esc(state.ftNota)}" oninput="setFTNota(this.value)" placeholder="Ej.: mediciones aledañas, memo de soluciones, presupuesto enviado…"><button class="btn-accion" onclick="agregarNotaFT('${clave}', '${id}')">Agregar</button></div>`;

  html += '<div class="section-title" style="margin-top:12px">3. Remedición (cierra el caso)</div>';
  if (x.remedicionInstalada) html += `<div class="aviso aviso-azul"><i class="ic ic-info"></i> Instalación encontrada: ${esc(x.remedicionInstalada.codigo)} desde el ${fmtDate(x.remedicionInstalada.fecha)}${x.remedicionInstalada.retirado ? ' (retirada)' : ''}</div>`;
  html += `<div class="row"><div class="field"><label>Código</label><input value="${esc(rem.codigo || x.remedicionInstalada?.codigo || '')}" onchange="setRemedicionFT('${clave}', '${id}', 'codigo', this.value)"></div>
    <div class="field"><label>Fecha</label><input type="date" value="${esc(rem.fecha || '')}" onchange="setRemedicionFT('${clave}', '${id}', 'fecha', this.value)"></div></div>`;
  html += `<div class="field"><label>¿La remedición demuestra que el voltaje se normalizó?</label><div class="segmento segmento-ancho">
    <button class="${rem.normalizado === true ? 'active' : ''}" onclick="setRemedicionFT('${clave}', '${id}', 'normalizado', true)">Sí, se normalizó</button>
    <button class="${rem.normalizado === false ? 'active' : ''}" onclick="setRemedicionFT('${clave}', '${id}', 'normalizado', false)">No</button></div></div>`;
  html += x.cerrado ? '<div class="aviso aviso-verde"><i class="ic ic-check"></i> Caso cerrado por remedición normalizada</div>' : '';
  html += '<button class="btn btn-secondary" style="margin-top:8px" onclick="cerrarFT()">Cerrar</button>';
  return html + '</div></div>';
}
