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

  let html = '<div class="bloque">';
  html += `<div class="bloque-head"><div class="bloque-titulo">Datos de los casos</div>${conFaltantes.length ? `<span class="tg ambar"><i class="ic ic-alerta"></i> ${conFaltantes.length} con datos faltantes</span>` : '<span class="tg verde"><i class="ic ic-check"></i> Datos completos</span>'}</div>`;
  const tile = (k, v, l, clase) => `<button class="tile ${clase} ${filtro === k ? 'sel' : ''} ${v ? '' : 'vacio'}" onclick="setCasosFiltro('${filtro === k ? 'todos' : k}')"><span class="v">${v}</span><span class="l">${l}</span></button>`;
  html += '<div class="tiles">' + ['CR', 'DA', 'DF'].filter(t => n[t]).map(t => tile(t, n[t], { CR: 'Regulación (CR)', DA: 'Armónicos (DA)', DF: 'Flicker (DF)' }[t], 't-azul')).join('')
    + tile('faltantes', conFaltantes.length, 'Con datos faltantes', conFaltantes.length ? 't-ambar' : 't-verde') + '</div>';
  html += `<div class="barra-acciones">
    <label class="b b-p"><i class="ic ic-excel"></i> Completar con control de puntos<input type="file" accept=".xlsx,.xls,.csv" hidden onchange="subirArchivoCampana('${c.clave}', 'control', this.files)"></label>
    <button class="b b-g" onclick="completarCoordenadasBase('${c.clave}')"><i class="ic ic-map-pin"></i> Completar coordenadas</button>
    <label class="b b-l" title="Desde un Excel o CSV con NC, latitud y longitud">o desde un archivo<input type="file" accept=".xlsx,.xls,.xlsm,.csv" hidden onchange="subirArchivoCampana('${c.clave}', 'coordenadas', this.files)"></label>
    <span class="sep"></span>
    <button class="b b-g" onclick="exportarListado('${c.clave}')"><i class="ic ic-descargar"></i> Exportar listado</button>
    <button class="b b-g" onclick="exportarMapa('${c.clave}')" title="Archivo KML para importar en Google My Maps"><i class="ic ic-map-pin"></i> Mapa para My Maps</button>
  </div>`;
  html += `<details class="ayuda"><summary><i class="ic ic-ayuda"></i> ¿De dónde salen los datos?</summary><p>El control de puntos completa CT/DS, medidor, alimentador y urbanidad (se busca por código y, si no está, por NC). Las coordenadas salen de la base cargada en la app. Lo que corrijas a mano en un caso no se vuelve a cambiar.${importado ? ` Listados importados el ${fmtDate(importado.fecha)} por ${esc(importado.por)}.` : ''}</p></details>`;
  html += '</div>';

  html += `<div class="filtros">${FILTROS.map(([k, label]) => `<button class="pildora ${filtro === k ? 'active' : ''}" onclick="setCasosFiltro('${k}')">${label}${k === 'faltantes' ? ` <b>${conFaltantes.length}</b>` : ''}</button>`).join('')}
    <input class="search-input buscar casos-buscar" placeholder="Buscar código, NC o nombre" value="${esc(state.casosBusqueda || '')}" oninput="setCasosBusqueda(this.value)" ${state.casosBusqueda ? 'data-active="true"' : ''}></div>`;

  html += '<div class="tabla-caja"><div class="tabla-scroll"><table class="tabla-r tabla-casos"><thead><tr><th>Código</th><th>NC</th><th>Dirección</th><th>CT/DS</th><th>Medidor</th><th>Alimentador</th><th>Urb.</th><th>Coordenadas</th></tr></thead><tbody>';
  visibles.forEach(x => {
    const cambiado = x.codigo && x.codigoEnte && x.codigo !== x.codigoEnte;
    html += `<tr onclick="abrirCaso('${c.clave}', '${x.id}')">
      <td class="cod"><b>${esc(x.codigo || x.codigoEnte)}</b><small>${esc(x.nombre)}</small>${cambiado ? `<small>Ente: ${esc(x.codigoEnte)}</small>` : ''}${x.crRelacionado ? `<small>Usuario de ${esc(x.crRelacionado)}</small>` : ''}</td>
      <td class="num" data-l="NC">${esc(x.nc)}${x.ncControl ? `<small class="txt-ambar" title="El control de puntos trae este código con otro NC">Control: ${esc(x.ncControl)}</small>` : ''}</td>
      <td class="col-dir ancho" data-l="Dirección">${esc(x.direccion || x.direccionEnte)}</td>
      <td data-l="CT/DS">${celda(x.ct)}</td><td data-l="Medidor">${celda(x.medidor)}</td><td data-l="Alimentador">${celda(x.alimentador)}</td><td data-l="Urbanidad">${celda(x.urbanidad)}</td><td data-l="Coordenadas">${coords(x)}</td>
    </tr>`;
  });
  if (!visibles.length) html += '<tr><td colspan="8" class="vacia tabla-vacia">No hay casos con ese filtro</td></tr>';
  return html + '</tbody></table></div></div>';
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
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(f.codigo)}</div><div class="page-sub">NC ${esc(caso.nc)}${caso.ncControl ? ' · en el control de puntos: ' + esc(caso.ncControl) : ''}${caso.crRelacionado ? ' · usuario de ' + esc(caso.crRelacionado) : ''}${caso.codigoEnte && caso.codigoEnte !== f.codigo ? ' · el ente lo envió como ' + esc(caso.codigoEnte) : ''}</div></div><button class="modal-cerrar" onclick="cerrarCaso()" title="Cerrar">✕</button></div>`;
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

// Cuántos pasos de la precampaña están listos
export function avancePrecampana(c) {
  const g = state.campanas?.[c.clave] || {};
  const p = g.precampana || {};
  const conFaltantes = c.casos.filter(x => faltantes(x).length).length;
  const auto = {
    listados: g.importado ? `${fmtDate(g.importado.fecha)} · ${esc(g.importado.por)}` : null,
    datos: c.casos.length && !conFaltantes ? 'Todos los casos tienen sus datos' : null,
  };
  const hechos = PASOS_PRECAMPANA.filter(([k]) => auto[k] || p[k]).length;
  return { hechos, total: PASOS_PRECAMPANA.length, auto, marcados: p, conFaltantes };
}

export function renderPrecampana(c) {
  const { hechos, total, auto, marcados: p, conFaltantes } = avancePrecampana(c);
  const actual = PASOS_PRECAMPANA.findIndex(([k]) => !(auto[k] || p[k]));
  let html = '<div class="bloque">';
  html += `<div class="bloque-head"><div class="bloque-titulo">Pasos de la precampaña <span class="cuenta">${hechos} de ${total}</span></div>
    <button class="b b-l" onclick="abrirConfigCartas()"><i class="ic ic-ajustes"></i> Datos de las cartas</button></div>`;
  html += `<div class="meta ${hechos === total ? 'ok' : ''}"><div class="meta-tx">${hechos === total ? 'Precampaña completa' : `Sigue: ${PASOS_PRECAMPANA[actual][1]}`}</div><div class="meta-barra"><i style="width:${Math.round(hechos * 100 / total)}%"></i></div><div class="meta-num">${Math.round(hechos * 100 / total)}<small> %</small></div></div>`;
  html += '<div class="tl pasos">';
  PASOS_PRECAMPANA.forEach(([k, label, tipo], i) => {
    const hecho = p[k] || null;
    const listo = auto[k] || hecho;
    let detalle = auto[k] || (hecho ? `${fmtDate(hecho.fecha)} · ${esc(hecho.por)}${hecho.total ? ` · ${hecho.total} casos` : ''}` : '');
    let claseDetalle = '';
    if (k === 'datos' && !listo) { detalle = `${conFaltantes} ${conFaltantes === 1 ? 'caso' : 'casos'} con datos faltantes`; claseDetalle = 'falta-tx'; }
    let accion = '';
    if (k === 'datos' && !listo) accion = '<button class="b b-g" onclick="setCampanaVista(\'casos\')"><i class="ic ic-usuarios"></i> Ver casos</button>';
    if (tipo === 'manual') accion = hecho ? `<button class="b b-l" onclick="desmarcarPaso('${c.clave}', '${k}')">Deshacer</button>` : `<button class="b ${i === actual ? 'b-p' : 'b-g'}" onclick="marcarPaso('${c.clave}', '${k}')"><i class="ic ic-check"></i> Marcar</button>`;
    if (k === 'cartas') accion = `<button class="b ${hecho || i !== actual ? 'b-g' : 'b-p'}" onclick="abrirDocumentos('${c.clave}', 'cartas')"><i class="ic ic-correo"></i> ${hecho ? 'Generar de nuevo' : 'Generar cartas'}</button>`;
    if (k === 'hojas') accion = `<button class="b ${hecho || i !== actual ? 'b-g' : 'b-p'}" onclick="abrirDocumentos('${c.clave}', 'hojas')"><i class="ic ic-archivo"></i> ${hecho ? 'Generar de nuevo' : 'Generar hojas'}</button>`;
    html += `<div class="tl-paso paso ${listo ? 'listo paso-listo' : ''} ${i === actual ? 'actual' : ''}"><div class="tl-num">${listo ? '<i class="ic ic-check"></i>' : i + 1}</div>
      <div class="tl-cuerpo"><div class="tl-tx paso-texto"><b>${label}</b>${detalle ? `<small class="${claseDetalle}">${detalle}</small>` : ''}</div>${accion}</div></div>`;
  });
  html += '</div>';
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
