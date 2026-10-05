// Precampaña: tabla de casos de una campaña, importación de listados y edición de un caso
import { contarTipos, faltantes, ordenarCasos, SISTEMAS, sistemaDeCodigo } from '../domain/listados.js';
import { MESES } from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';

const esc = s => escapeHtml(s ?? '');
const falta = '<span class="falta">Falta</span>';
const celda = v => (v === undefined || v === null || v === '' ? falta : esc(v));
const coords = c => (c.lat != null && c.lat !== '' && c.lng != null ? `<span class="mono">${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}</span>` : falta);

const FILTROS = [['todos', 'Todos'], ['CR', 'CR'], ['DA', 'DA'], ['DF', 'DF'], ['faltantes', 'Con datos faltantes']];

export function renderCasosCampana(c) {
  const casos = ordenarCasos(c.casos);
  const conFaltantes = casos.filter(x => faltantes(x).length);
  const filtro = state.casosFiltro || 'todos';
  const q = (state.casosBusqueda || '').trim().toLowerCase();
  const visibles = casos.filter(x => (filtro === 'todos' || (filtro === 'faltantes' ? faltantes(x).length : x.tipo === filtro))
    && (!q || [x.codigo, x.nc, x.nombre, x.direccion || x.direccionEnte].some(v => String(v || '').toLowerCase().includes(q))));
  const n = contarTipos(c.casos);
  const importado = state.campanas?.[c.clave]?.importado;

  let html = '<div class="section-title" style="margin-top:16px">Casos de la campaña</div>';
  html += '<div class="panel">';
  html += `<div class="chips-linea" style="margin-top:0">${['CR', 'DA', 'DF'].filter(t => n[t]).map(t => `<span class="chip-dato"><b>${n[t]}</b> ${t}</span>`).join('')}
    ${conFaltantes.length ? `<span class="tag tag-amarillo"><i class="ic ic-alerta"></i> ${conFaltantes.length} con datos faltantes</span>` : '<span class="tag tag-verde"><i class="ic ic-check"></i> Datos completos</span>'}</div>`;
  if (importado) html += `<div class="page-sub">Importado el ${fmtDate(importado.fecha)} por ${esc(importado.por)}</div>`;
  html += `<div class="acciones-casos">
    <label class="btn-accion"><i class="ic ic-excel"></i> Completar con control de puntos<input type="file" accept=".xlsx,.xls,.csv" hidden onchange="subirArchivoCampana('${c.clave}', 'control', this.files)"></label>
    <label class="btn-accion"><i class="ic ic-map-pin"></i> Completar coordenadas<input type="file" accept=".xlsx,.xls,.csv" hidden onchange="subirArchivoCampana('${c.clave}', 'coordenadas', this.files)"></label>
    <button class="btn-accion" onclick="exportarListado('${c.clave}')"><i class="ic ic-descargar"></i> Exportar listado</button>
  </div>`;
  html += '</div>';

  html += '<div class="casos-filtros"><div class="segmento">' + FILTROS.map(([k, label]) => `<button class="${filtro === k ? 'active' : ''}" onclick="setCasosFiltro('${k}')">${label}${k === 'faltantes' ? ` (${conFaltantes.length})` : ''}</button>`).join('') + '</div>';
  html += `<input class="search-input casos-buscar" placeholder="Buscar código, NC o nombre" value="${esc(state.casosBusqueda || '')}" oninput="setCasosBusqueda(this.value)" ${state.casosBusqueda ? 'data-active="true"' : ''}></div>`;

  html += '<div class="tabla-wrap"><table class="tabla-casos"><thead><tr><th>Código</th><th>NC</th><th>Nombre</th><th>Dirección</th><th>CT/DS</th><th>Medidor</th><th>Alimentador</th><th>Urb.</th><th>Coordenadas</th></tr></thead><tbody>';
  visibles.forEach(x => {
    const cambiado = x.codigo && x.codigoEnte && x.codigo !== x.codigoEnte;
    html += `<tr onclick="abrirCaso('${c.clave}', '${x.id}')">
      <td class="mono"><b>${esc(x.codigo || x.codigoEnte)}</b>${cambiado ? `<small>Ente: ${esc(x.codigoEnte)}</small>` : ''}${x.crRelacionado ? `<small>Usuario de ${esc(x.crRelacionado)}</small>` : ''}</td>
      <td class="mono">${esc(x.nc)}</td><td>${esc(x.nombre)}</td><td class="col-dir">${esc(x.direccion || x.direccionEnte)}</td>
      <td>${celda(x.ct)}</td><td>${celda(x.medidor)}</td><td>${celda(x.alimentador)}</td><td>${celda(x.urbanidad)}</td><td>${coords(x)}</td>
    </tr>`;
  });
  if (!visibles.length) html += '<tr><td colspan="9" class="tabla-vacia">No hay casos con ese filtro</td></tr>';
  return html + '</tbody></table></div>';
}

// ── IMPORTAR LISTADOS ──

const NIVEL = { MT: 'Media tensión (CR)', BT: 'Baja tensión (CR)', DA: 'Armónicos (DA)', DF: 'Flicker (DF)' };

export function renderImportListados() {
  const imp = state.importListados;
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += '<div class="modal-head"><div class="modal-titulo">Importar listados del ente</div><button class="modal-cerrar" onclick="cerrarImportListados()" title="Cerrar">✕</button></div>';
  html += '<div class="page-sub" style="margin-bottom:12px">Sube los listados de MT, BT, armónicos (DA) y flicker (FK); pueden ir todos juntos. Los DA y DF se ligan al CR del mismo usuario y toman su área.</div>';
  html += `<label class="zona-archivo"><i class="ic ic-subir"></i><span>${imp ? 'Elegir otros archivos' : 'Elegir archivos de Excel'}</span><input type="file" accept=".xlsx,.xls" multiple hidden onchange="leerListadosEnte(this.files)"></label>`;
  if (imp) {
    html += '<div class="section-title" style="margin-top:14px">Archivos</div><div class="filas">';
    imp.archivos.forEach(a => {
      html += `<div class="fila"><div class="fila-main"><div class="fila-titulo">${esc(a.nombre)}</div><div class="fila-sub">${a.error ? `<span class="txt-rojo">${esc(a.error)}</span>` : `${NIVEL[a.nivel] || 'Tipo no reconocido'} · ${a.casos.length} casos`}</div></div></div>`;
    });
    html += '</div>';
    if (imp.campanas.length) {
      html += '<div class="section-title">Se va a guardar</div><div class="filas">';
      imp.campanas.forEach(c => {
        const n = contarTipos(c.casos);
        const existe = state.campanas?.[c.clave]?.casos;
        html += `<div class="fila"><div class="fila-main"><div class="fila-titulo">${MESES[c.mes - 1]} ${c.anio} · ${c.area}</div>
          <div class="fila-sub">${['CR', 'DA', 'DF'].filter(t => n[t]).map(t => `${n[t]} ${t}`).join(' · ')}</div>
          ${existe ? '<div class="fila-plazo"><span class="tag tag-amarillo">Ya existe</span> Se actualizan los datos del ente sin tocar lo que ya completaron o corrigieron</div>' : ''}</div></div>`;
      });
      html += '</div>';
    }
    if (imp.avisos.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>${imp.avisos.map(esc).join('<br>')}</div></div>`;
    html += `<button class="btn btn-primary" style="margin-top:14px" ${imp.campanas.length ? '' : 'disabled'} onclick="guardarImportListados()">Guardar campañas</button>`;
  }
  html += '<button class="btn btn-secondary" onclick="cerrarImportListados()">Cancelar</button>';
  return html + '</div></div>';
}

// ── EDITAR UN CASO ──

export function renderCasoModal() {
  const { clave, id } = state.casoEdit;
  const caso = state.campanas?.[clave]?.casos?.[id] || {};
  const f = state.casoForm;
  const campo = (k, label, extra = '') => `<div class="field"><label>${label}</label><input id="caso-${k}" value="${esc(f[k])}" oninput="setCasoField('${k}', this.value)" ${extra}></div>`;
  const sistema = sistemaDeCodigo(f.codigo);
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(f.codigo)}</div><div class="page-sub">NC ${esc(caso.nc)}${caso.crRelacionado ? ' · usuario de ' + esc(caso.crRelacionado) : ''}${caso.codigoEnte && caso.codigoEnte !== f.codigo ? ' · el ente lo envió como ' + esc(caso.codigoEnte) : ''}</div></div><button class="modal-cerrar" onclick="cerrarCaso()" title="Cerrar">✕</button></div>`;
  if (sistema) {
    html += `<div class="field"><label>Tipo de sistema verificado en campo</label><div class="segmento segmento-ancho">${Object.entries(SISTEMAS).map(([k, label]) => `<button class="${Number(k) === sistema ? 'active' : ''}" onclick="setCasoSistema(${k})">${label}</button>`).join('')}</div></div>`;
  }
  html += campo('nombre', 'Nombre');
  html += campo('direccion', 'Dirección');
  html += '<div class="row">' + campo('ct', 'CT/DS') + campo('medidor', 'Medidor') + '</div>';
  html += '<div class="row">' + campo('alimentador', 'Alimentador', 'placeholder="AL091-23000"') + `<div class="field"><label>Urbanidad</label><select onchange="setCasoField('urbanidad', this.value)"><option value="">—</option>${['U', 'R'].map(u => `<option value="${u}" ${f.urbanidad === u ? 'selected' : ''}>${u === 'U' ? 'U (urbano)' : 'R (rural)'}</option>`).join('')}</select></div></div>`;
  html += '<div class="row">' + campo('lat', 'Latitud', 'inputmode="decimal"') + campo('lng', 'Longitud', 'inputmode="decimal"') + '</div>';
  html += campo('tipoInstalacion', 'Tipo de instalación (control de puntos)');
  html += '<button class="btn btn-primary" onclick="guardarCaso()">Guardar cambios</button>';
  html += '<button class="btn btn-secondary" onclick="cerrarCaso()">Cancelar</button>';
  return html + '</div></div>';
}
