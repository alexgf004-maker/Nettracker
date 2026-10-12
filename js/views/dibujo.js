// Pestaña Dibujar (Herramientas): lámina de red sobre una imagen (captura del mapa, foto o plano), sin relación con
// ningún caso. Barra por grupos (red, anotar, dibujo libre, escala), fila de opciones de alto fijo y el cajetín.
import { cargarBorrador, partesSVG, viewBoxDib, zoomPct } from '../actions/dibujo.js';
import { COLORES, GROSORES, SIMBOLOS, TAM_TEXTO } from '../domain/dibujo.js';
import { ACCIONES_PUNTO, ESTILOS_ETIQUETA, fmtMetros, metrosTramo, metrosVano, nombresVanos, TIPOS_TRAMO } from '../domain/plano.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { heroSeccion } from './componentes.js';

const esc = s => escapeHtml(s ?? '');
const ic = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const mini = (k, tam = 22) => { const s = SIMBOLOS[k]; const c = s.color || 'currentColor'; return `<svg viewBox="-2 -2 64 64" width="${tam}" height="${tam}" color="${c}" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">${s.svg}</svg>`; };
const muestraTramo = (k, w = 34) => { const t = TIPOS_TRAMO[k]; return `<svg viewBox="0 0 ${w} 12" width="${w}" height="12"><line x1="2" y1="6" x2="${w - 2}" y2="6" stroke="${t.color}" stroke-width="${4 * t.ancho}" stroke-linecap="round" ${t.dash ? `stroke-dasharray="${t.dash.split(' ').map(v => v * 4).join(' ')}"` : ''}/></svg>`; };

const SIMBOLOS_RED = Object.keys(SIMBOLOS).filter(k => SIMBOLOS[k].grupo === 'red');
const SIMBOLOS_DIAGRAMA = Object.keys(SIMBOLOS).filter(k => SIMBOLOS[k].grupo === 'diagrama');
const ANOTAR = [
  ['etiqueta', 'Etiqueta de punto (P1, W1…)', ic('<rect x="11" y="3" width="10" height="7" rx="2"/><path d="M11 9L4 20"/><circle cx="4" cy="20" r="1.4" fill="currentColor"/>')],
  ['cota', 'Cota (medir distancia)', ic('<path d="M3 17L17 3"/><path d="M2 14l4 4M14 2l4 4"/><path d="M10 21h11"/>')],
  ['texto', 'Texto', ic('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>')],
  ['flecha', 'Flecha', ic('<line x1="4" y1="20" x2="19" y2="5"/><path d="M10 5h9v9"/>')],
];
const LIBRE = [
  ['seleccionar', 'Seleccionar y mover', ic('<path d="M5 3l14 8-6 2-3 6z"/>')],
  ['linea', 'Línea', ic('<line x1="4" y1="20" x2="20" y2="4"/>')],
  ['rect', 'Rectángulo', ic('<rect x="4" y="6" width="16" height="12" rx="1"/>')],
  ['elipse', 'Círculo', ic('<ellipse cx="12" cy="12" rx="8" ry="7"/>')],
  ['trazo', 'Trazo libre', ic('<path d="M3 17c3-6 5 2 8-4s5 2 8-6"/>')],
  ['unifilar', 'Símbolos de unifilar', ic('<circle cx="12" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>')],
];

export function renderDibujar() {
  state.dibujo ??= cargarBorrador();
  const d = state.dibujo;
  const p = partesSVG(d);
  const sel = d.elementos.find(e => e.id === d.sel) || null;
  const h = d.herramienta;
  const btn = (titulo, icono, activo, accion, extra = '') => `<button class="dib-btn ${activo ? 'activo' : ''}" title="${titulo}" aria-label="${titulo}" onclick="${accion}" ${extra}>${icono}</button>`;
  let html = `<div class="content dib-pagina ${state.dibAmpliado ? 'ampliada' : ''}">`;
  html += heroSeccion({
    eyebrow: 'Herramientas', titulo: 'Dibujar',
    sub: 'Lámina de red sobre la captura del mapa: tramos por tipo, simbología, etiquetas de puntos, distancias reales y cajetín con simbología, tabla de distancias, escala y norte. Se guarda como proyecto para el equipo (para modificarlo después) y se descarga en PNG para Word.',
    acciones: `<label class="hero-btn blanco"><i class="ic ic-subir"></i> ${d.fondo ? 'Cambiar imagen' : 'Subir imagen'}<input type="file" accept="image/*" hidden onchange="subirFondoDib(this.files); this.value=''"></label>`,
  });

  html += barraProyecto(d);
  if (state.dibProyectos === 'lista') return html + listaProyectos(d) + '</div>';

  // ── Barra por grupos ──
  const grupo = (titulo, cuerpo) => `<div class="dib-grupo-t"><small>${titulo}</small><div class="dib-grupo">${cuerpo}</div></div>`;
  const esUnifilar = h === 'simbolo' && SIMBOLOS[d.simbolo]?.grupo === 'diagrama';
  html += `<div class="dib-barra">
    ${grupo('Red', btn('Tramo de red', ic('<path d="M3 19l6-8 5 4 7-10" stroke-width="3"/>'), h === 'tramo', "setHerramientaDib('tramo')")
      + SIMBOLOS_RED.map(k => btn(SIMBOLOS[k].nombre, mini(k), h === 'simbolo' && d.simbolo === k, `setSimboloDib('${k}')`)).join(''))}
    ${grupo('Anotar', ANOTAR.map(([k, t, i]) => btn(t, i, h === k, `setHerramientaDib('${k}')`)).join(''))}
    ${grupo('Dibujo libre', LIBRE.map(([k, t, i]) => (k === 'unifilar'
      ? btn(t, i, esUnifilar, `setSimboloDib('${SIMBOLOS[d.simbolo]?.grupo === 'diagrama' ? d.simbolo : 'transformador'}')`)
      : btn(t, i, h === k, `setHerramientaDib('${k}')`))).join(''))}
    ${grupo('Escala', `<button class="b ${h === 'calibrar' ? 'b-p' : 'b-g'}" onclick="setHerramientaDib('calibrar')">${d.escala ? 'Recalibrar' : 'Calibrar'}</button>
      <span class="tg ${d.escala ? 'verde' : 'ambar'}">${d.escala ? `1 m = ${(1 / d.escala).toFixed(1)} px` : 'Sin escala'}</span>`)}
    ${grupo('Color y grosor', COLORES.map(c => `<button class="dib-color ${d.color === c ? 'activo' : ''}" style="background:${c}" title="Color" aria-label="Color ${c}" onclick="setColorDib('${c}')"></button>`).join('')
      + Object.keys(GROSORES).map(g => `<button class="dib-btn dib-btn-chico ${d.grosor === g ? 'activo' : ''}" title="Grosor ${g}" aria-label="Grosor ${g}" onclick="setGrosorDib('${g}')"><span class="dib-grosor" style="height:${GROSORES[g]}px"></span></button>`).join(''))}
    <div class="dib-grupo dib-final">
      ${btn('Deshacer', ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>'), false, 'deshacerDib()', d.historial.length ? '' : 'disabled')}
      ${btn('Rehacer', ic('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>'), false, 'rehacerDib()', d.rehacer.length ? '' : 'disabled')}
      <button class="b b-p" onclick="descargarDib()"><i class="ic ic-descargar"></i> Descargar PNG</button>
      <button class="b b-g" onclick="copiarDib()">Copiar</button>
      <button class="b b-l" onclick="nuevoLienzoDib()">Nuevo</button>
    </div></div>`;

  // Paleta de símbolos de unifilar
  if (esUnifilar) {
    html += `<div class="dib-simbolos">${SIMBOLOS_DIAGRAMA.map(k => `<button class="dib-simbolo ${d.simbolo === k ? 'activo' : ''}" onclick="setSimboloDib('${k}')" title="${SIMBOLOS[k].nombre}">${mini(k, 30)}<span>${SIMBOLOS[k].nombre}</span></button>`).join('')}</div>`;
  }

  // ── Fila de opciones (alto fijo: el lienzo no salta) ──
  const tiposTramo = actual => Object.entries(TIPOS_TRAMO).map(([k, t]) => `<button class="dib-chip ${actual === k ? 'activo' : ''}" onclick="setTipoTramoDib('${k}')">${muestraTramo(k)}${t.nombre}</button>`).join('');
  const estilos = actual => Object.entries(ESTILOS_ETIQUETA).map(([k, e]) => `<button class="dib-chip ${actual === k ? 'activo' : ''}" onclick="setEstiloEtiquetaDib('${k}')"><span class="dib-chip-etq" style="background:${e.fondo};color:${e.texto}">${esc(e.prefijo || 'Aa')}</span>${e.nombre}</button>`).join('');
  const acciones = (extra = '') => `${extra}<button class="b b-g" onclick="duplicarDib()">Duplicar</button><button class="b b-g" onclick="alFrenteDib()">Al frente</button><button class="b b-l dib-borrar" onclick="borrarDib()">Borrar</button>`;
  let fila;
  if (h === 'calibrar') {
    fila = d.calibracion && Math.hypot(d.calibracion.x2 - d.calibracion.x1, d.calibracion.y2 - d.calibracion.y1) > 10
      ? `<label class="dib-prefijo">La línea mide <input id="dib-metros" inputmode="decimal" placeholder="Ej. 50" onkeydown="if (event.key === 'Enter') aplicarCalibracionDib()"> metros</label><button class="b b-p" onclick="aplicarCalibracionDib()">Aplicar escala</button><button class="b b-l" onclick="cancelarCalibracionDib()">Cancelar</button>`
      : '<span class="page-sub">Traza una línea sobre algo cuya medida conozcas (la barra de escala del mapa, un vano o una calle medida en Google Maps con clic derecho → Medir distancia); luego escribe cuántos metros mide.</span><button class="b b-l" onclick="cancelarCalibracionDib()">Cancelar</button>';
  } else if (sel?.tipo === 'polilinea') {
    const movidos = Object.keys(sel.desfases || {}).length ? '<button class="b b-g" onclick="metrosASuLugarDib()">Metros a su lugar</button>' : '';
    fila = `${tiposTramo(sel.tramo)}<span class="tg gris dib-total-tramo">${metrosTramo(sel, d.escala) !== null ? `Total ${fmtMetros(metrosTramo(sel, d.escala))}` : ''}</span>${d.tramo === sel.id ? '<button class="b b-p" onclick="terminarTramoDib()"><i class="ic ic-check"></i> Terminar tramo</button>' : acciones(movidos)}`;
  } else if (h === 'tramo') {
    fila = `${tiposTramo(d.tramoTipo)}<span class="page-sub">Toca cada poste del recorrido; se ajusta al poste más cercano.</span>`;
  } else if (sel?.tipo === 'etiqueta') {
    fila = `<textarea id="dib-texto" rows="1" oninput="textoDib(this.value)" onchange="finTextoDib()" placeholder="Ej. P1: DS111267">${esc(sel.texto)}</textarea>${estilos(sel.estilo)}${acciones()}`;
  } else if (h === 'etiqueta') {
    fila = `${estilos(d.estiloEtiqueta)}<label class="dib-prefijo">Prefijo <input id="dib-prefijo" value="${esc(d.prefijo)}" maxlength="6" oninput="setPrefijoDib(this.value)"></label><span class="page-sub">Toca el poste y arrastra hasta donde va la etiqueta.</span>`;
  } else if (sel?.tipo === 'cota') {
    fila = `<span class="page-sub">${d.escala ? `Mide ${fmtMetros(Math.hypot(sel.x2 - sel.x1, sel.y2 - sel.y1) * d.escala)}. Arrastra sus extremos para ajustarla; la medida también se arrastra.` : 'Calibra la escala para ver los metros.'}</span>${acciones(sel.desfase ? '<button class="b b-g" onclick="metrosASuLugarDib()">Medida a su lugar</button>' : '')}`;
  } else if (sel?.tipo === 'texto') {
    fila = `<textarea id="dib-texto" rows="1" oninput="textoDib(this.value)" onchange="finTextoDib()" placeholder="Escribe el texto">${esc(sel.texto)}</textarea>${Object.keys(TAM_TEXTO).map(t => `<button class="b ${d.tamTexto === t ? 'b-p' : 'b-g'}" onclick="setTamTextoDib('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}${acciones()}`;
  } else if (sel?.tipo === 'leyenda' || sel?.tipo === 'tabla') {
    fila = `<span class="page-sub">Edita ${sel.tipo === 'leyenda' ? 'la leyenda' : 'la tabla'} debajo del dibujo.</span>${acciones()}`;
  } else if (sel) {
    fila = acciones(sel.tipo === 'simbolo' ? `<span class="page-sub">${esc(SIMBOLOS[sel.simbolo]?.nombre || '')}</span><button class="b b-g" onclick="girarDib()">Girar 90°</button>` : '');
  } else {
    fila = `<span class="page-sub">${{
      seleccionar: 'Toca un elemento para seleccionarlo y arrastrarlo; los metros de los vanos también se arrastran. Supr borra y Ctrl+Z deshace.',
      cota: d.escala ? 'Arrastra entre dos puntos para medir; se ajusta a los postes.' : 'La cota necesita la escala calibrada. Sin escala, escribe los metros de cada vano al seleccionar el tramo.',
      texto: 'Toca donde va el texto y escríbelo aquí.', flecha: 'Arrastra desde el inicio hasta donde apunta la flecha.',
      linea: 'Arrastra para trazar la línea.', rect: 'Arrastra para dibujar el rectángulo.', elipse: 'Arrastra para dibujar el círculo.', trazo: 'Dibuja a mano alzada.',
      simbolo: `Toca donde va: ${esc(SIMBOLOS[d.simbolo]?.nombre || '')}.`,
    }[h] || ''}${!d.fondo && !d.elementos.length ? ' Empieza subiendo la captura del mapa.' : ''}</span>`;
  }
  html += `<div class="dib-sel-barra">${fila}</div>`;

  // ── Lámina ──
  const zoom = `<div class="dib-zoom"><button class="dib-btn dib-btn-chico" title="Alejar" aria-label="Alejar" onclick="zoomDib(0.8)">${ic('<path d="M5 12h14"/>')}</button>
    <span id="dib-zoom-pct">${zoomPct()} %</span>
    <button class="dib-btn dib-btn-chico" title="Acercar" aria-label="Acercar" onclick="zoomDib(1.25)">${ic('<path d="M12 5v14M5 12h14"/>')}</button>
    <button class="b b-l" onclick="ajustarVistaDib()">Ajustar</button>
    <button class="b ${state.dibAmpliado ? 'b-p' : 'b-g'}" onclick="ampliarDib()">${state.dibAmpliado ? 'Salir de pantalla completa' : 'Pantalla completa'}</button></div>`;
  html += `<div class="dib-lienzo">${zoom}<svg id="dib-svg" class="dib-svg herr-${h}" viewBox="${viewBoxDib(d)}" onwheel="dibRueda(event)" onpointerdown="dibPointerDown(event)" onpointermove="dibPointerMove(event)" onpointerup="dibPointerUp(event)" onpointercancel="dibPointerUp(event)"><rect width="${p.w}" height="${p.H}" fill="#ffffff"/>${p.fondo}<g id="dib-capa">${p.capa}</g><g id="dib-cajetin">${p.cajetin}</g></svg></div>`;

  // Metros por vano del tramo seleccionado (escritos a mano; vacío = con la escala)
  if (sel?.tipo === 'polilinea' && d.tramo !== sel.id && sel.puntos.length > 1) {
    const nombres = nombresVanos(sel, d.elementos, 14 * Math.max(1, p.w / 1600));
    html += `<div class="bloque dib-editor"><div class="bloque-head"><div class="bloque-titulo">Metros por vano</div><span class="tg gris dib-total-tramo">${metrosTramo(sel, d.escala) !== null ? `Total ${fmtMetros(metrosTramo(sel, d.escala))}` : ''}</span></div>
      <div class="dib-vanos">${nombres.map((n, k) => {
        const i = k + 1; const manual = sel.metros?.[i] !== undefined; const auto = d.escala && !manual ? metrosVano({ ...sel, metros: {} }, i, d.escala) : null;
        return `<div class="field"><label>Vano ${i}: ${esc(n)}</label><input id="dib-vano-${i}" inputmode="decimal" value="${manual ? esc(sel.metros[i]) : ''}" placeholder="${auto !== null ? `${auto.toFixed(1)} (con la escala)` : 'metros'}" oninput="metrosVanoDib(${i}, this.value)" onchange="finVanoDib()"></div>`;
      }).join('')}</div>
      <div class="page-sub">${d.escala ? 'Si escribes los metros de un vano, mandan sobre los de la escala.' : 'Sin escala, escribe los metros de cada vano; salen sobre el tramo y en la tabla de distancias.'}</div></div>`;
  }
  // Textos rápidos de la etiqueta de punto
  if (sel?.tipo === 'etiqueta') {
    html += `<div class="bloque dib-editor"><div class="bloque-head"><div class="bloque-titulo">Texto rápido</div></div>
      <div class="dib-acciones">${ACCIONES_PUNTO.map(a => `<button class="dib-chip" onclick="accionEtiquetaDib('${esc(a)}')">${esc(a)}</button>`).join('')}</div>
      <div class="page-sub">Pone la acción después del nombre del punto (por ejemplo, "P8: Seccionar red BT"); luego puedes completarla arriba (por ejemplo, "Instalar transformador 23T1C de 25 kVA"). Para partir el texto en dos líneas usa Enter.</div></div>`;
  }

  // Editores de leyenda y tabla manuales (dibujos anteriores)
  if (sel?.tipo === 'leyenda') {
    html += `<div class="bloque dib-editor"><div class="bloque-head"><div class="bloque-titulo">Leyenda</div></div>
      ${sel.entradas.map((e, i) => `<div class="dib-fila"><button class="dib-color" style="background:${e.color}" title="Usar el color elegido" aria-label="Color de la fila ${i + 1}" onclick="leyendaColorDib(${i})"></button>
        <input id="dib-leyenda-${i}" value="${esc(e.texto)}" oninput="leyendaTextoDib(${i}, this.value)" onchange="finEdicionDib()">
        ${sel.entradas.length > 1 ? `<button class="b b-l" onclick="quitarEntradaLeyendaDib(${i})">Quitar</button>` : ''}</div>`).join('')}
      <div class="barra-acciones"><button class="b b-g" onclick="agregarEntradaLeyendaDib()"><i class="ic ic-plus"></i> Agregar fila</button></div></div>`;
  }
  if (sel?.tipo === 'tabla') {
    html += `<div class="bloque dib-editor"><div class="bloque-head"><div class="bloque-titulo">Tabla</div></div>
      <div class="form-analisis">${sel.encabezado.map((x, c) => `<div class="field"><label>Encabezado ${c + 1}</label><input id="dib-enc-${c}" value="${esc(x)}" oninput="tablaEncabezadoDib(${c}, this.value)" onchange="finEdicionDib()"></div>`).join('')}
      <div class="field field-ancho"><label>Filas: una por línea</label><textarea id="dib-filas" rows="4" oninput="tablaFilasDib(this.value)" onchange="finEdicionDib()">${esc(sel.filas.map(f => f.join(', ')).join('\n'))}</textarea></div></div></div>`;
  }

  // Datos del cajetín
  const l = d.lamina || {};
  const campo = (k, label, ph = '') => `<div class="field"><label>${label}</label><input id="dib-lam-${k}" value="${esc(l[k] || '')}" placeholder="${esc(ph)}" oninput="setLaminaDib('${k}', this.value)"></div>`;
  const check = (k, label) => `<label class="insp-check"><input type="checkbox" id="dib-lam-${k}" ${l[k] !== false ? 'checked' : ''} onchange="setLaminaDib('${k}', this.checked)"><span>${label}</span></label>`;
  html += `<div class="bloque dib-editor"><div class="bloque-head"><div class="bloque-titulo">Cajetín de la lámina</div>${d.escala ? '<button class="b b-l" onclick="quitarEscalaDib()">Quitar escala</button>' : ''}</div>
    <div class="insp-checks">${check('activa', 'Incluir el cajetín (título, simbología, distancias, escala y norte)')}${check('norte', 'Flecha de norte (la captura tiene el norte arriba)')}${check('distanciasEnTramos', 'Metros sobre cada vano de los tramos')}</div>
    ${l.activa !== false ? `<div class="form-analisis">${campo('titulo', 'Título', 'Ej. Referencia eléctrica o Propuesta')}${campo('subtitulo', 'Descripción', 'Ej. Nuevo transformador para el usuario')}${campo('proyecto', 'Proyecto / WO', 'Ej. WO-01-2025/638')}${campo('fecha', 'Fecha')}${campo('elaboro', 'Elaboró')}
      <div class="field"><label>Tabla de distancias</label><select id="dib-lam-distancias" onchange="setLaminaDib('distancias', this.value)"><option value="auto" ${l.distancias !== 'manual' ? 'selected' : ''}>Automática (entre puntos etiquetados)</option><option value="manual" ${l.distancias === 'manual' ? 'selected' : ''}>Manual</option></select></div>
      ${l.distancias === 'manual' ? `<div class="field field-ancho"><label>Filas: tramo y metros, una por línea (o pegadas de Excel)</label><textarea id="dib-lam-filas" rows="3" placeholder="P1 – W1, 50" onchange="setLaminaDib('filas', this.value)">${esc((l.filas || []).map(f => f.join(', ')).join('\n'))}</textarea></div>` : ''}</div>
      <div class="page-sub">${l.distancias === 'manual' ? 'Escribe las distancias a mano.' : 'La tabla se arma sola entre los puntos etiquetados que están sobre cada tramo, con los metros de los vanos (escritos a mano o con la escala).'}</div>` : ''}</div>`;
  return html + '</div>';
}

// Proyecto abierto (o borrador) con guardar; formulario de nombre para guardar uno nuevo
function barraProyecto(d) {
  const n = Object.keys(state.dibujos || {}).length;
  const abrir = `<button class="b b-g" onclick="setVistaProyectosDib(${state.dibProyectos === 'lista' ? 'null' : "'lista'"})">${state.dibProyectos === 'lista' ? 'Volver al dibujo' : `Proyectos guardados${n ? ` (${n})` : ''}`}</button>`;
  if (state.dibProyectos === 'guardar') {
    return `<div class="bloque dib-proyecto"><div class="bloque-head"><div class="bloque-titulo">Guardar como proyecto</div></div>
      <div class="form-analisis"><div class="field"><label>Nombre</label><input id="dib-proy-nombre" placeholder="Ej. Propuesta nuevo transformador Col. Las Flores"></div>
      <div class="field"><label>Referencia (opcional)</label><input id="dib-proy-ref" placeholder="WO, NC, reclamo…"></div></div>
      <div class="barra-acciones"><button class="b b-p" onclick="guardarComoProyectoDib()">Guardar</button><button class="b b-l" onclick="setVistaProyectosDib(null)">Cancelar</button></div>
      <div class="page-sub">Queda guardado en la base para el equipo: cualquiera lo abre y lo modifica desde su celular o compu.</div></div>`;
  }
  if (d.proyecto) {
    return `<div class="dib-proyecto barra-acciones"><span class="dib-proy-nombre"><b>${esc(d.proyecto.nombre)}</b>${d.proyecto.referencia ? ` · ${esc(d.proyecto.referencia)}` : ''}</span>
      <span class="tg ${d.sinGuardar ? 'ambar' : 'verde'}">${d.sinGuardar ? 'Cambios sin guardar' : 'Guardado'}</span>
      <button class="b ${d.sinGuardar ? 'b-p' : 'b-g'}" onclick="guardarProyectoDib()">Guardar</button>${abrir}<button class="b b-l" onclick="soltarProyectoDib()">Cerrar proyecto</button></div>`;
  }
  return `<div class="dib-proyecto barra-acciones"><span class="page-sub">Borrador${d.elementos.length || d.fondo ? ' sin guardar' : ''}</span>
    <button class="b b-p" onclick="guardarProyectoDib()">Guardar como proyecto</button>${abrir}</div>`;
}
function listaProyectos(d) {
  const lista = Object.entries(state.dibujos || {}).map(([id, x]) => ({ id, ...x }))
    .sort((a, b) => String(b.editado?.fecha || b.creado?.fecha || '').localeCompare(String(a.editado?.fecha || a.creado?.fecha || '')));
  if (!lista.length) return '<div class="empty"><div class="empty-text">Todavía no hay proyectos guardados.</div></div>';
  return `<div class="list">${lista.map(x => `<div class="camp-card dib-proy-card ${d.proyecto?.id === x.id ? 'activo' : ''}"><div class="camp-card-cuerpo">
    <div class="exp-nombre">${esc(x.nombre)}</div>
    <div class="exp-sub">${esc([x.referencia, x.editado ? `Modificado ${fmtDate(x.editado.fecha)} · ${x.editado.por}` : ''].filter(Boolean).join(' · '))}</div>
    <div class="barra-acciones"><button class="b b-p" onclick="abrirProyectoDib('${x.id}')">${d.proyecto?.id === x.id ? 'Abierto' : 'Abrir'}</button><button class="b b-l" onclick="eliminarProyectoDib('${x.id}')">Eliminar</button></div></div></div>`).join('')}</div>`;
}
