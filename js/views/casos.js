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

  let html = '<div class="panel">';
  html += `<div class="chips-linea" style="margin-top:0">${['CR', 'DA', 'DF'].filter(t => n[t]).map(t => `<span class="chip-dato"><b>${n[t]}</b> ${t}</span>`).join('')}
    ${conFaltantes.length ? `<span class="tag tag-amarillo"><i class="ic ic-alerta"></i> ${conFaltantes.length} con datos faltantes</span>` : '<span class="tag tag-verde"><i class="ic ic-check"></i> Datos completos</span>'}</div>`;
  if (importado) html += `<div class="page-sub">Importado el ${fmtDate(importado.fecha)} por ${esc(importado.por)}</div>`;
  html += `<div class="acciones-casos">
    <label class="btn-accion"><i class="ic ic-excel"></i> Completar con control de puntos<input type="file" accept=".xlsx,.xls,.csv" hidden onchange="subirArchivoCampana('${c.clave}', 'control', this.files)"></label>
    <button class="btn-accion" onclick="completarCoordenadasBase('${c.clave}')"><i class="ic ic-map-pin"></i> Completar coordenadas</button>
    <label class="btn-link" title="Desde un Excel o CSV con NC, latitud y longitud">o desde un archivo<input type="file" accept=".xlsx,.xls,.xlsm,.csv" hidden onchange="subirArchivoCampana('${c.clave}', 'coordenadas', this.files)"></label>
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

// ── SEGUIMIENTO DE LA PRECAMPAÑA ──

// Pasos: los automáticos se cumplen solos; los manuales se marcan con quién y cuándo
export const PASOS_PRECAMPANA = [
  ['listados', 'Listados del ente importados', 'auto'],
  ['datos', 'Datos completos (CT/DS, medidor, alimentador, coordenadas)', 'auto'],
  ['cartas', 'Cartas generadas', 'auto'],
  ['firma', 'Firma de las cartas solicitada por correo', 'manual'],
  ['firmadas', 'Cartas firmadas recibidas', 'manual'],
  ['hojas', 'Hojas de inspección generadas', 'auto'],
  ['contratista', 'Cartas y hojas entregadas al contratista', 'manual'],
  ['evidencias', 'Hojas llenas y fotos recibidas del contratista', 'manual'],
];

export function renderPrecampana(c) {
  const g = state.campanas?.[c.clave] || {};
  const p = g.precampana || {};
  const conFaltantes = c.casos.filter(x => faltantes(x).length).length;
  const estado = {
    listados: g.importado ? `${fmtDate(g.importado.fecha)} · ${esc(g.importado.por)}` : null,
    datos: c.casos.length && !conFaltantes ? 'Todos los casos tienen sus datos' : null,
  };
  const hechos = PASOS_PRECAMPANA.filter(([k]) => estado[k] || p[k]).length;
  let html = '<div class="panel">';
  html += `<div class="panel-titulo"><i class="ic ic-clipboard"></i> ${hechos} de ${PASOS_PRECAMPANA.length} pasos<span class="progreso"><span style="width:${Math.round(hechos * 100 / PASOS_PRECAMPANA.length)}%"></span></span></div>`;
  html += '<div class="pasos">';
  PASOS_PRECAMPANA.forEach(([k, label, tipo]) => {
    const hecho = p[k] || null;
    const listo = estado[k] || hecho;
    let detalle = estado[k] || (hecho ? `${fmtDate(hecho.fecha)} · ${esc(hecho.por)}${hecho.total ? ` · ${hecho.total} casos` : ''}` : '');
    if (k === 'datos' && !listo) detalle = `${conFaltantes} ${conFaltantes === 1 ? 'caso' : 'casos'} con datos faltantes`;
    let accion = '';
    if (tipo === 'manual') accion = hecho ? `<button class="btn-link" onclick="desmarcarPaso('${c.clave}', '${k}')">Deshacer</button>` : `<button class="btn-accion" onclick="marcarPaso('${c.clave}', '${k}')"><i class="ic ic-check"></i> Marcar</button>`;
    if (k === 'cartas') accion = `<button class="btn-accion" onclick="abrirDocumentos('${c.clave}', 'cartas')"><i class="ic ic-correo"></i> ${hecho ? 'Generar de nuevo' : 'Generar cartas'}</button>`;
    if (k === 'hojas') accion = `<button class="btn-accion" onclick="abrirDocumentos('${c.clave}', 'hojas')"><i class="ic ic-archivo"></i> ${hecho ? 'Generar de nuevo' : 'Generar hojas'}</button>`;
    html += `<div class="paso ${listo ? 'paso-listo' : ''}"><i class="ic ${listo ? 'ic-cuadro-check' : 'ic-cuadro'}"></i>
      <div class="paso-texto"><div>${label}</div>${detalle ? `<small>${detalle}</small>` : ''}</div>${accion}</div>`;
  });
  html += '</div>';
  html += `<button class="btn-link" style="margin-top:8px" onclick="abrirConfigCartas()">Datos de las cartas (firmante, contacto, contratista y logo)</button>`;
  return html + '</div>';
}

// ── GENERAR CARTAS U HOJAS ──

export function renderDocsModal() {
  const { clave, tipo } = state.docsModal;
  const g = state.campanas?.[clave] || {};
  const casos = ordenarCasos(Object.entries(g.casos || {}).map(([id, c]) => ({ id, ...c })));
  const f = state.docsForm;
  const incluidos = casos.filter(c => !f.excluidos[c.id]).length;
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div class="modal-titulo">${tipo === 'cartas' ? 'Generar cartas' : 'Generar hojas de inspección'}</div><button class="modal-cerrar" onclick="cerrarDocumentos()" title="Cerrar">✕</button></div>`;
  if (tipo === 'cartas') {
    html += `<div class="field"><label>Fecha de la carta</label><input type="date" value="${esc(f.fecha)}" onchange="setDocsField('fecha', this.value)"></div>`;
    html += `<div class="field"><label>Visita de instalación (completa la frase "realizar la visita para la instalación del mismo …")</label><input value="${esc(f.periodo)}" oninput="setDocsField('periodo', this.value)"></div>`;
  }
  html += `<div class="field"><label>Casos (${incluidos} de ${casos.length})</label>
    <div class="fila-plazo" style="margin:0 0 6px"><button class="btn-link" onclick="excluirTodos(false)">Todos</button><button class="btn-link" onclick="excluirTodos(true)">Ninguno</button></div>
    <div class="lista-casos">${casos.map(c => `<label class="caso-check"><input type="checkbox" ${f.excluidos[c.id] ? '' : 'checked'} onchange="toggleExcluirCaso('${c.id}')"><span class="mono">${esc(c.codigo || c.codigoEnte)}</span><span>${esc(c.nombre)}</span>${faltantes(c).length && tipo === 'hojas' ? '<span class="falta">Faltan datos</span>' : ''}</label>`).join('')}</div></div>`;
  html += `<button class="btn btn-primary" onclick="generarDocumentos()">${tipo === 'cartas' ? 'Generar' : 'Generar'} ${incluidos} ${tipo === 'cartas' ? (incluidos === 1 ? 'carta' : 'cartas') : (incluidos === 1 ? 'hoja' : 'hojas')}</button>`;
  html += '<button class="btn btn-secondary" onclick="cerrarDocumentos()">Cancelar</button>';
  return html + '</div></div>';
}

// ── DATOS DE LAS CARTAS ──

export function renderConfigCartas() {
  const f = state.configCartasForm;
  const campo = (k, label, ph = '') => `<div class="field"><label>${label}</label><input id="cfg-${k}" value="${esc(f[k])}" placeholder="${esc(ph)}" oninput="setConfigCartasField('${k}', this.value)"></div>`;
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += '<div class="modal-head"><div class="modal-titulo">Datos de las cartas</div><button class="modal-cerrar" onclick="cerrarConfigCartas()" title="Cerrar">✕</button></div>';
  html += '<div class="page-sub" style="margin-bottom:12px">Se usan en todas las cartas. Se guardan en la base de datos de la app, no en el código.</div>';
  html += campo('firmante', 'Nombre de quien firma *') + campo('cargo', 'Cargo');
  html += '<div class="row">' + campo('telefono', 'Teléfono de contacto') + campo('email', 'Correo de contacto') + '</div>';
  html += campo('contratista', 'Empresa contratista', 'Nombre como aparece en la carta');
  html += '<div class="row">' + campo('distribuidora', 'Distribuidora') + campo('ciudad', 'Ciudad (Extendida en …)') + '</div>';
  html += campo('acuerdo', 'Acuerdo de la DGEHM') + campo('pie', 'Pie de página', 'Dirección y teléfonos de la empresa');
  html += `<div class="field"><label>Logo</label><div class="logo-config">${f.logo ? `<img src="${esc(f.logo)}" alt="Logo"><button class="btn-link" onclick="quitarLogo()">Quitar</button>` : '<span class="page-sub">Sin logo: se muestra el nombre de la distribuidora</span>'}
    <label class="btn-accion"><i class="ic ic-subir"></i> ${f.logo ? 'Cambiar' : 'Subir imagen'}<input type="file" accept="image/*" hidden onchange="cargarLogo(this.files)"></label></div></div>`;
  html += '<button class="btn btn-primary" onclick="guardarConfigCartas()">Guardar</button>';
  html += '<button class="btn btn-secondary" onclick="cerrarConfigCartas()">Cancelar</button>';
  return html + '</div></div>';
}
