// Pestaña Dibujar (Herramientas): lámina de red sobre una imagen (captura del mapa, foto o plano), sin relación con
// ningún caso. Editor como un programa de diseño: barra de herramientas a la izquierda, el lienzo en todo el espacio
// libre, panel de propiedades a la derecha (lo seleccionado o la herramienta activa) y arriba el proyecto, deshacer,
// imagen y exportar. En el celular las herramientas van en una tira abajo y las propiedades en una hoja que se abre.
import { cargarBorrador, partesSVG, viewBoxDib, zoomPct } from '../actions/dibujo.js';
import { COLORES, GROSORES, SIMBOLOS, TAM_TEXTO } from '../domain/dibujo.js';
import { ACCIONES_PUNTO, ESTILOS_ETIQUETA, fmtMetros, metrosTramo, metrosVano, nombreRed, nombresVanos, TIPOS_TRAMO } from '../domain/plano.js';
import { ALTURAS_POSTE, CALIBRES, ESTRUCTURAS, nombreEstructura, TIPOS_CONDUCTOR } from '../domain/red.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';

const esc = s => escapeHtml(s ?? '');
const ic = (d, t = 20) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const mini = (k, tam = 22) => { const s = SIMBOLOS[k]; const c = s.color || 'currentColor'; return `<svg viewBox="-2 -2 64 64" width="${tam}" height="${tam}" color="${c}" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">${s.svg}</svg>`; };
const muestraTramo = (k, w = 34, color = null) => { const t = TIPOS_TRAMO[k]; return `<svg viewBox="0 0 ${w} 12" width="${w}" height="12"><line x1="2" y1="6" x2="${w - 2}" y2="6" stroke="${color || t.color}" stroke-width="${4 * t.ancho}" stroke-linecap="round" ${t.dash ? `stroke-dasharray="${t.dash.split(' ').map(v => v * 4).join(' ')}"` : ''}/></svg>`; };

const SIMBOLOS_RED = Object.keys(SIMBOLOS).filter(k => SIMBOLOS[k].grupo === 'red');
const SIMBOLOS_DIAGRAMA = Object.keys(SIMBOLOS).filter(k => SIMBOLOS[k].grupo === 'diagrama');
const I = {
  seleccionar: ic('<path d="M5 3l14 8-6 2-3 6z"/>'),
  tramo: ic('<path d="M3 19l6-8 5 4 7-10" stroke-width="3"/>'),
  etiqueta: ic('<rect x="11" y="3" width="10" height="7" rx="2"/><path d="M11 9L4 20"/><circle cx="4" cy="20" r="1.4" fill="currentColor"/>'),
  cota: ic('<path d="M3 17L17 3"/><path d="M2 14l4 4M14 2l4 4"/><path d="M10 21h11"/>'),
  texto: ic('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  flecha: ic('<line x1="4" y1="20" x2="19" y2="5"/><path d="M10 5h9v9"/>'),
  linea: ic('<line x1="4" y1="20" x2="20" y2="4"/>'),
  rect: ic('<rect x="4" y="6" width="16" height="12" rx="1"/>'),
  elipse: ic('<ellipse cx="12" cy="12" rx="8" ry="7"/>'),
  trazo: ic('<path d="M3 17c3-6 5 2 8-4s5 2 8-6"/>'),
  unifilar: ic('<circle cx="12" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>'),
  calibrar: ic('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  deshacer: ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>'),
  rehacer: ic('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>'),
  menos: ic('<path d="M5 12h14"/>'), mas: ic('<path d="M12 5v14M5 12h14"/>'),
  imagen: ic('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>'),
  panel: ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
  ajustes: ic('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
};
// Colores para distinguir redes del mismo tipo (además del color propio de cada tipo)
const COLORES_RED = ['#a21caf', '#2563eb', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#7c3aed', '#ca8a04', '#111827'];
const NOMBRE_TIPO = { polilinea: 'Tramo de red', simbolo: 'Símbolo', etiqueta: 'Etiqueta de punto', cota: 'Cota', texto: 'Texto', flecha: 'Flecha', linea: 'Línea', rect: 'Rectángulo', elipse: 'Círculo', trazo: 'Trazo libre', leyenda: 'Leyenda', tabla: 'Tabla' };
const AYUDA = {
  seleccionar: 'Toca un elemento para seleccionarlo y arrastrarlo; los metros de los vanos también se arrastran. Supr borra y Ctrl+Z deshace.',
  tramo: 'Toca cada poste del recorrido; se ajusta al poste o a la línea más cercana. Doble toque, Enter o "Terminar tramo" para cerrar.',
  simbolo: 'Toca donde va; cae sobre el poste o la línea más cercana. Tocar uno que ya está lo selecciona (para moverlo o agrandarlo).',
  etiqueta: 'Toca el poste y arrastra hasta donde va la etiqueta.',
  cota: 'Arrastra entre dos puntos para medir; se ajusta a los postes.',
  texto: 'Toca donde va el texto y escríbelo en el panel.', flecha: 'Arrastra desde el inicio hasta donde apunta la flecha.',
  linea: 'Arrastra para trazar la línea.', rect: 'Arrastra para dibujar el rectángulo.', elipse: 'Arrastra para dibujar el círculo.', trazo: 'Dibuja a mano alzada.',
  calibrar: 'Traza una línea sobre algo cuya medida conozcas y escribe cuántos metros mide.',
};

export function renderDibujar() {
  state.dibujo ??= cargarBorrador();
  const d = state.dibujo;
  const p = partesSVG(d);
  const sel = d.elementos.find(e => e.id === d.sel) || null;
  const h = d.herramienta;
  const panelAbierto = state.dibPanel !== false;
  let html = `<div class="dib-pagina dib-app ${state.dibAmpliado ? 'ampliada' : ''} ${panelAbierto ? '' : 'sin-panel'} ${state.dibPanelMovil ? 'panel-movil' : ''}">`;
  html += barraSuperior(d);
  html += '<div class="dib-cuerpo">';
  html += barraHerramientas(d, h);

  // ── Lienzo ──
  const zoom = `<div class="dib-zoom"><button class="dib-btn dib-btn-chico" title="Alejar" aria-label="Alejar" onclick="zoomDib(0.8)">${I.menos}</button>
    <span id="dib-zoom-pct">${zoomPct()} %</span>
    <button class="dib-btn dib-btn-chico" title="Acercar" aria-label="Acercar" onclick="zoomDib(1.25)">${I.mas}</button>
    <button class="b b-l" onclick="ajustarVistaDib()">Ajustar</button>
    <button class="b ${state.dibAmpliado ? 'b-p' : 'b-g'}" onclick="ampliarDib()">${state.dibAmpliado ? 'Salir de pantalla completa' : 'Pantalla completa'}</button></div>`;
  const ayuda = `<div class="dib-panel-ayuda">${esc(sel && h === 'seleccionar' ? `${NOMBRE_TIPO[sel.tipo] || ''} seleccionado. Arrástralo para moverlo; sus propiedades están en el panel.` : AYUDA[h] || '')}${!d.fondo && !d.elementos.length ? ' Empieza subiendo la captura del mapa (arriba, "Subir imagen").' : ''}</div>`;
  html += `<div class="dib-lienzo">${zoom}<svg id="dib-svg" class="dib-svg herr-${h}" viewBox="${viewBoxDib(d)}" onwheel="dibRueda(event)" onpointerdown="dibPointerDown(event)" onpointermove="dibPointerMove(event)" onpointerup="dibPointerUp(event)" onpointercancel="dibPointerUp(event)"><rect width="${p.w}" height="${p.H}" fill="#ffffff"/>${p.fondo}<g id="dib-capa">${p.capa}</g><g id="dib-cajetin">${p.cajetin}</g></svg>
    <button class="dib-abrir-panel" onclick="abrirPanelMovilDib(true)">${I.ajustes}<span>${esc(tituloPanel(d, sel, h))}</span></button></div>`;

  html += `<aside class="dib-panel" aria-label="Propiedades"><div class="dib-panel-cab"><b>${esc(tituloPanel(d, sel, h))}</b>
    <button class="dib-btn dib-btn-chico dib-cerrar-movil" title="Cerrar" aria-label="Cerrar propiedades" onclick="abrirPanelMovilDib(false)">✕</button></div>
    ${ayuda}<div class="dib-panel-cuerpo">${panel(d, sel, h, p)}</div></aside>`;
  html += '</div>';
  if (state.dibProyectos === 'lista') html += `<div class="modal-overlay dib-modal" onclick="if (event.target === this) setVistaProyectosDib(null)"><div class="modal hoja">${listaProyectos(d)}</div></div>`;
  if (state.dibProyectos === 'guardar') html += `<div class="modal-overlay dib-modal" onclick="if (event.target === this) setVistaProyectosDib(null)"><div class="modal hoja">${formGuardar()}</div></div>`;
  return html + '</div>';
}

// ── Barra superior: proyecto, deshacer, imagen, exportar ──
function barraSuperior(d) {
  const n = Object.keys(state.dibujos || {}).length;
  const proyecto = d.proyecto
    ? `<span class="dib-proy-nombre" title="${esc(d.proyecto.referencia || '')}"><b>${esc(d.proyecto.nombre)}</b>${d.proyecto.referencia ? ` · ${esc(d.proyecto.referencia)}` : ''}</span>
      <span class="tg ${d.sinGuardar ? 'ambar' : 'verde'}">${d.sinGuardar ? 'Cambios sin guardar' : 'Guardado'}</span>
      <button class="b ${d.sinGuardar ? 'b-p' : 'b-g'}" onclick="guardarProyectoDib()">Guardar</button>`
    : `<span class="page-sub dib-borrador">Borrador${d.elementos.length || d.fondo ? ' sin guardar' : ''}</span><button class="b b-p" onclick="guardarProyectoDib()">Guardar como proyecto</button>`;
  const btn = (t, i, acc, extra = '') => `<button class="dib-btn" title="${t}" aria-label="${t}" onclick="${acc}" ${extra}>${i}</button>`;
  return `<div class="dib-superior">
    <div class="dib-proyecto">${proyecto}<button class="b b-g" aria-label="Proyectos guardados${n ? ` (${n})` : ''}" title="Proyectos guardados" onclick="setVistaProyectosDib('lista')">Proyectos${n ? ` (${n})` : ''}</button>${d.proyecto ? '<button class="b b-l" onclick="soltarProyectoDib()">Cerrar proyecto</button>' : ''}</div>
    <div class="dib-sup-grupo">${btn('Deshacer', I.deshacer, 'deshacerDib()', d.historial.length ? '' : 'disabled')}${btn('Rehacer', I.rehacer, 'rehacerDib()', d.rehacer.length ? '' : 'disabled')}</div>
    <div class="dib-sup-grupo"><label class="b b-g dib-subir" title="${d.fondo ? 'Cambiar imagen' : 'Subir imagen'}">${I.imagen}<span>${d.fondo ? 'Cambiar imagen' : 'Subir imagen'}</span><input type="file" accept="image/*" hidden onchange="subirFondoDib(this.files); this.value=''"></label></div>
    <div class="dib-sup-grupo dib-sup-fin"><button class="b b-p" onclick="descargarDib()"><i class="ic ic-descargar"></i> Descargar PNG</button><button class="b b-g" onclick="copiarDib()">Copiar</button><button class="b b-l" onclick="nuevoLienzoDib()">Nuevo</button>
      ${btn(state.dibPanel === false ? 'Mostrar propiedades' : 'Ocultar propiedades', I.panel, 'togglePanelDib()', 'class="dib-btn dib-toggle-panel"')}</div>
  </div>`;
}

// ── Herramientas (columna a la izquierda; tira abajo en el celular) ──
function barraHerramientas(d, h) {
  const btn = (titulo, icono, activo, accion) => `<button class="dib-btn ${activo ? 'activo' : ''}" title="${titulo}" aria-label="${titulo}" onclick="${accion}">${icono}</button>`;
  const esUnifilar = h === 'simbolo' && SIMBOLOS[d.simbolo]?.grupo === 'diagrama';
  const grupo = (t, cuerpo) => `<div class="dib-herr-grupo"><small>${t}</small><div>${cuerpo}</div></div>`;
  return `<nav class="dib-herramientas" aria-label="Herramientas">
    ${grupo('', btn('Seleccionar y mover (V)', I.seleccionar, h === 'seleccionar', "setHerramientaDib('seleccionar')"))}
    ${grupo('Red', btn('Tramo de red', I.tramo, h === 'tramo', "setHerramientaDib('tramo')") + SIMBOLOS_RED.map(k => btn(SIMBOLOS[k].nombre, mini(k), h === 'simbolo' && d.simbolo === k, `setSimboloDib('${k}')`)).join(''))}
    ${grupo('Anotar', btn('Etiqueta de punto (P1, W1…)', I.etiqueta, h === 'etiqueta', "setHerramientaDib('etiqueta')") + btn('Cota (medir distancia)', I.cota, h === 'cota', "setHerramientaDib('cota')")
      + btn('Texto', I.texto, h === 'texto', "setHerramientaDib('texto')") + btn('Flecha', I.flecha, h === 'flecha', "setHerramientaDib('flecha')"))}
    ${grupo('Libre', btn('Línea', I.linea, h === 'linea', "setHerramientaDib('linea')") + btn('Rectángulo', I.rect, h === 'rect', "setHerramientaDib('rect')") + btn('Círculo', I.elipse, h === 'elipse', "setHerramientaDib('elipse')")
      + btn('Trazo libre', I.trazo, h === 'trazo', "setHerramientaDib('trazo')") + btn('Símbolos de unifilar', I.unifilar, esUnifilar, `setSimboloDib('${SIMBOLOS[d.simbolo]?.grupo === 'diagrama' ? d.simbolo : 'transformador'}')`))}
    ${grupo('Escala', btn(d.escala ? 'Recalibrar la escala' : 'Calibrar la escala', I.calibrar, h === 'calibrar', "setHerramientaDib('calibrar')"))}
  </nav>`;
}

function tituloPanel(d, sel, h) {
  if (h === 'calibrar') return 'Calibrar la escala';
  if (sel) return sel.tipo === 'simbolo' ? SIMBOLOS[sel.simbolo]?.nombre || 'Símbolo' : sel.tipo === 'polilinea' ? (d.tramo === sel.id ? 'Trazando tramo' : nombreRed(sel)) : NOMBRE_TIPO[sel.tipo] || 'Elemento';
  if (h === 'simbolo') return SIMBOLOS[d.simbolo]?.nombre || 'Símbolo';
  if (h === 'tramo') return 'Tramo de red';
  if (h !== 'seleccionar') return NOMBRE_TIPO[h] || 'Herramienta';
  return 'Lámina';
}

// ── Panel de propiedades ──
const seccion = (titulo, cuerpo) => `<section class="dib-sec">${titulo ? `<h4>${titulo}</h4>` : ''}${cuerpo}</section>`;
const opcion = (v, t, sel) => `<option value="${esc(v)}" ${String(sel ?? '') === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
// Altura y estructuras de un poste (los mismos controles en Dibujar y en Levantamiento)
export function controlesPoste({ altura, estructuras }, acc) {
  const lista = estructuras || [];
  return `<div class="field"><label>Altura del poste (pies)</label><input id="${acc.id}-altura" inputmode="numeric" list="${acc.id}-alturas" value="${esc(altura || '')}" placeholder="Ej. 35" onchange="${acc.altura}(this.value)">
      <datalist id="${acc.id}-alturas">${ALTURAS_POSTE.map(a => `<option value="${a}">${a}'</option>`).join('')}</datalist></div>
    <div class="field"><label>Estructuras</label>
      <div class="dib-estructuras">${lista.map((c, i) => `<span class="dib-estr" title="${esc(nombreEstructura(c))}">${esc(c)}<button aria-label="Quitar ${esc(c)}" onclick="${acc.quitar}(${i})">✕</button></span>`).join('') || '<span class="page-sub">Ninguna</span>'}</div>
      <select id="${acc.id}-estructura" onchange="${acc.agregar}(this.value); this.value=''"><option value="">Agregar estructura…</option>${ESTRUCTURAS.map(g => `<optgroup label="${esc(g.grupo)}">${g.items.map(it => `<option value="${it.codigo}">${it.codigo} · ${esc(it.nombre)}</option>`).join('')}</optgroup>`).join('')}</select>
      <div class="dib-estr-otra"><input id="${acc.id}-estr-otra" placeholder="Otro código" onkeydown="if (event.key === 'Enter') ${acc.escrita}()"><button class="b b-g" onclick="${acc.escrita}()">Agregar</button></div></div>`;
}
// Calibre y tipo de conductor
export function controlesConductor(c, acc) {
  return `<div class="dib-dos"><div class="field"><label>Calibre</label><input id="${acc.id}-calibre" list="${acc.id}-calibres" value="${esc(c?.calibre || '')}" placeholder="Ej. #2" onchange="${acc.fn}('calibre', this.value)">
      <datalist id="${acc.id}-calibres">${CALIBRES.map(x => `<option value="${x}">`).join('')}</datalist></div>
    <div class="field"><label>Tipo</label><select id="${acc.id}-tipo" onchange="${acc.fn}('tipo', this.value)">${opcion('', '—', c?.tipo || '')}${TIPOS_CONDUCTOR.map(t => opcion(t, t, c?.tipo)).join('')}</select></div></div>`;
}
function panel(d, sel, h, p) {
  const tiposTramo = actual => `<div class="dib-lista">${Object.entries(TIPOS_TRAMO).map(([k, t]) => `<button class="dib-chip ${actual === k ? 'activo' : ''}" onclick="setTipoTramoDib('${k}')">${muestraTramo(k)}${t.nombre}</button>`).join('')}</div>`;
  const coloresRed = (actual, tipo) => `<div class="dib-colores">
      <button class="dib-color-auto ${!actual ? 'activo' : ''}" title="El del tipo" aria-label="Color del tipo de red" onclick="setColorRedDib(null)">${muestraTramo(tipo, 26)}</button>
      ${COLORES_RED.map(c => `<button class="dib-color ${actual === c ? 'activo' : ''}" style="background:${c}" title="Red de este color" aria-label="Red color ${c}" onclick="setColorRedDib('${c}')"></button>`).join('')}
      <label class="dib-color dib-color-libre" title="Otro color" style="background:${actual && !COLORES_RED.includes(actual) ? actual : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'}"><input type="color" value="${actual || '#a21caf'}" onchange="setColorRedDib(this.value)" aria-label="Otro color de red"></label></div>`;
  const colores = () => `<div class="dib-colores">${COLORES.map(c => `<button class="dib-color ${d.color === c ? 'activo' : ''}" style="background:${c}" title="Color" aria-label="Color ${c}" onclick="setColorDib('${c}')"></button>`).join('')}</div>`;
  const grosores = () => `<div class="dib-colores">${Object.keys(GROSORES).map(g => `<button class="dib-btn dib-btn-chico ${d.grosor === g ? 'activo' : ''}" title="Grosor ${g}" aria-label="Grosor ${g}" onclick="setGrosorDib('${g}')"><span class="dib-grosor" style="height:${GROSORES[g]}px"></span></button>`).join('')}</div>`;
  const tamano = (texto = 'Tamaño') => `<div class="dib-tamano"><span>${texto}</span><button class="dib-btn dib-btn-chico" title="Más chico" aria-label="Más chico" onclick="setTamanoDib(0.85)">${I.menos}</button><button class="dib-btn dib-btn-chico" title="Más grande" aria-label="Más grande" onclick="setTamanoDib(1.18)">${I.mas}</button></div>`;
  const acciones = (extra = '') => seccion('', `<div class="dib-acciones-el">${extra}<button class="b b-g" onclick="duplicarDib()">Duplicar</button><button class="b b-g" onclick="alFrenteDib()">Al frente</button><button class="b b-l dib-borrar" onclick="borrarDib()">Borrar</button></div>`);
  const nota = t => `<div class="page-sub">${t}</div>`;

  // Calibrar
  if (h === 'calibrar') {
    const lista = d.calibracion && Math.hypot(d.calibracion.x2 - d.calibracion.x1, d.calibracion.y2 - d.calibracion.y1) > 10;
    return seccion('', lista
      ? `<label class="dib-prefijo">La línea mide <input id="dib-metros" inputmode="decimal" placeholder="Ej. 50" onkeydown="if (event.key === 'Enter') aplicarCalibracionDib()"> metros</label><div class="dib-acciones-el"><button class="b b-p" onclick="aplicarCalibracionDib()">Aplicar escala</button><button class="b b-l" onclick="cancelarCalibracionDib()">Cancelar</button></div>`
      : `${nota('Traza una línea sobre algo cuya medida conozcas (la barra de escala del mapa, un vano o una calle medida en Google Maps con clic derecho → Medir distancia); luego escribe cuántos metros mide.')}<div class="dib-acciones-el"><button class="b b-l" onclick="cancelarCalibracionDib()">Cancelar</button></div>`);
  }

  // Tramo seleccionado (o en trazo)
  if (sel?.tipo === 'polilinea') {
    const total = metrosTramo(sel, d.escala);
    let html = '';
    if (d.tramo === sel.id) html += seccion('', `${nota(AYUDA.tramo)}<button class="b b-p" onclick="terminarTramoDib()"><i class="ic ic-check"></i> Terminar tramo</button>`);
    html += seccion('Tipo de red', tiposTramo(sel.tramo));
    html += seccion('Color de la red', `${coloresRed(sel.colorRed, sel.tramo)}${nota('Para distinguir redes del mismo tipo (por ejemplo, de dos transformadores). Cada color sale aparte en la simbología.')}`);
    html += seccion('Nombre en la simbología', `<input id="dib-nombre-red" value="${esc(sel.nombreRed || '')}" placeholder="${esc(TIPOS_TRAMO[sel.tramo]?.nombre || '')}" oninput="setNombreRedDib(this.value)" onchange="finEdicionDib()">`);
    html += seccion('Conductor', `${controlesConductor(sel.conductor, { id: 'dib-cond', fn: 'setConductorDib' })}<div class="page-sub">Los tramos que traces después salen con este conductor.</div>`);
    html += seccion('Grosor', tamano('Grosor de la línea'));
    if (d.tramo !== sel.id && sel.puntos.length > 1) {
      const nombres = nombresVanos(sel, d.elementos, 14 * Math.max(1, p.w / 1600));
      html += seccion(`Metros por vano <span class="dib-total-tramo">${total !== null ? `Total ${fmtMetros(total)}` : ''}</span>`, `<div class="dib-vanos">${nombres.map((n, k) => {
        const i = k + 1; const manual = sel.metros?.[i] !== undefined; const auto = d.escala && !manual ? metrosVano({ ...sel, metros: {} }, i, d.escala) : null;
        return `<div class="field"><label>Vano ${i}: ${esc(n)}</label><div class="dib-vano-fila"><input id="dib-vano-${i}" inputmode="decimal" value="${manual ? esc(sel.metros[i]) : ''}" placeholder="${auto !== null ? `${auto.toFixed(1)} (con la escala)` : 'metros'}" oninput="metrosVanoDib(${i}, this.value)" onchange="finVanoDib()">
          <select id="dib-vano-cal-${i}" aria-label="Calibre del vano ${i}" onchange="setCalibreVanoDib(${i}, this.value)">${opcion('', sel.conductor?.calibre ? `${sel.conductor.calibre} (del tramo)` : 'Calibre', sel.calibres?.[i] || '')}${CALIBRES.map(c => opcion(c, c, sel.calibres?.[i])).join('')}</select></div></div>`;
      }).join('')}</div>${nota(d.escala ? 'Si escribes los metros de un vano, mandan sobre los de la escala.' : 'Sin escala, escribe los metros de cada vano; salen sobre el tramo y en la tabla de distancias.')}`);
      html += acciones(Object.keys(sel.desfases || {}).length ? '<button class="b b-g" onclick="metrosASuLugarDib()">Metros a su lugar</button>' : '');
    }
    return html;
  }
  if (h === 'tramo') {
    return seccion('', nota(AYUDA.tramo)) + seccion('Tipo de red', tiposTramo(d.tramoTipo)) + seccion('Color de la red', coloresRed(d.colorRed, d.tramoTipo))
      + (d.conductor ? seccion('Conductor', nota(`Los tramos nuevos salen con ${esc([d.conductor.calibre, d.conductor.tipo].filter(Boolean).join(' '))}; se cambia al seleccionar el tramo.`)) : '') + seccion('Grosor', grosores());
  }

  // Símbolo seleccionado
  if (sel?.tipo === 'simbolo') {
    const red = SIMBOLOS[sel.simbolo]?.grupo === 'red';
    return seccion('', `<div class="dib-simbolo-sel">${mini(sel.simbolo, 34)}<span>${esc(SIMBOLOS[sel.simbolo]?.nombre || '')}</span></div>${tamano()}${red ? nota('Los postes que pongas después salen de este tamaño.') : ''}`)
      + (red ? seccion('Datos del poste', controlesPoste(sel, { id: 'dib-poste', altura: 'setAlturaDib', agregar: 'agregarEstructuraDib', quitar: 'quitarEstructuraDib', escrita: 'agregarEstructuraEscritaDib' })) : seccion('Color', colores()))
      + acciones(`<button class="b b-g" onclick="girarDib()">Girar 90°</button>${sel.desfase ? '<button class="b b-g" onclick="metrosASuLugarDib()">Datos a su lugar</button>' : ''}`);
  }
  if (h === 'simbolo') {
    const red = SIMBOLOS[d.simbolo]?.grupo === 'red';
    let html = seccion('', `<div class="dib-simbolo-sel">${mini(d.simbolo, 34)}<span>${esc(SIMBOLOS[d.simbolo]?.nombre || '')}</span></div>${nota(AYUDA.simbolo)}`);
    if (red) html += seccion('Tamaño de los nuevos', `<div class="dib-tamano"><span>${Math.round((d.tamNuevos || 1) * 100)} %</span><button class="dib-btn dib-btn-chico" aria-label="Nuevos más chicos" title="Más chicos" onclick="setTamNuevosDib(0.85)">${I.menos}</button><button class="dib-btn dib-btn-chico" aria-label="Nuevos más grandes" title="Más grandes" onclick="setTamNuevosDib(1.18)">${I.mas}</button></div>`);
    else html += seccion('Símbolos de unifilar', `<div class="dib-simbolos">${SIMBOLOS_DIAGRAMA.map(k => `<button class="dib-simbolo ${d.simbolo === k ? 'activo' : ''}" onclick="setSimboloDib('${k}')" title="${SIMBOLOS[k].nombre}">${mini(k, 30)}<span>${SIMBOLOS[k].nombre}</span></button>`).join('')}</div>`) + seccion('Color', colores()) + seccion('Grosor', grosores());
    return html;
  }

  // Etiqueta
  const estilos = actual => `<div class="dib-lista">${Object.entries(ESTILOS_ETIQUETA).map(([k, e]) => `<button class="dib-chip ${actual === k ? 'activo' : ''}" onclick="setEstiloEtiquetaDib('${k}')"><span class="dib-chip-etq" style="background:${e.fondo};color:${e.texto}">${esc(e.prefijo || 'Aa')}</span>${e.nombre}</button>`).join('')}</div>`;
  if (sel?.tipo === 'etiqueta') {
    return seccion('Texto', `<textarea id="dib-texto" rows="2" oninput="textoDib(this.value)" onchange="finTextoDib()" placeholder="Ej. P1: DS111267">${esc(sel.texto)}</textarea>${nota('Enter parte el texto en dos líneas.')}`)
      + seccion('Texto rápido', `<div class="dib-acciones">${ACCIONES_PUNTO.map(a => `<button class="dib-chip" onclick="accionEtiquetaDib('${esc(a)}')">${esc(a)}</button>`).join('')}</div>`)
      + seccion('Estilo', estilos(sel.estilo)) + seccion('', tamano()) + acciones();
  }
  if (h === 'etiqueta') {
    return seccion('', nota(AYUDA.etiqueta)) + seccion('Estilo', estilos(d.estiloEtiqueta))
      + seccion('Numeración', `<label class="dib-prefijo">Prefijo <input id="dib-prefijo" value="${esc(d.prefijo)}" maxlength="6" oninput="setPrefijoDib(this.value)"></label>`);
  }
  if (sel?.tipo === 'cota') {
    return seccion('', nota(d.escala ? `Mide ${fmtMetros(Math.hypot(sel.x2 - sel.x1, sel.y2 - sel.y1) * d.escala)}. Arrastra sus extremos para ajustarla; la medida también se arrastra.` : 'Calibra la escala para ver los metros.') + tamano())
      + acciones(sel.desfase ? '<button class="b b-g" onclick="metrosASuLugarDib()">Medida a su lugar</button>' : '');
  }
  if (sel?.tipo === 'texto') {
    return seccion('Texto', `<textarea id="dib-texto" rows="2" oninput="textoDib(this.value)" onchange="finTextoDib()" placeholder="Escribe el texto">${esc(sel.texto)}</textarea>`)
      + seccion('Tamaño', `<div class="dib-acciones-el">${Object.keys(TAM_TEXTO).map(t => `<button class="b ${d.tamTexto === t ? 'b-p' : 'b-g'}" onclick="setTamTextoDib('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>${tamano('Ajuste fino')}`)
      + seccion('Color', colores()) + acciones();
  }
  if (sel?.tipo === 'leyenda') {
    return seccion('Leyenda', `${sel.entradas.map((e, i) => `<div class="dib-fila"><button class="dib-color" style="background:${e.color}" title="Usar el color elegido" aria-label="Color de la fila ${i + 1}" onclick="leyendaColorDib(${i})"></button>
        <input id="dib-leyenda-${i}" value="${esc(e.texto)}" oninput="leyendaTextoDib(${i}, this.value)" onchange="finEdicionDib()">
        ${sel.entradas.length > 1 ? `<button class="b b-l" onclick="quitarEntradaLeyendaDib(${i})">Quitar</button>` : ''}</div>`).join('')}
      <button class="b b-g" onclick="agregarEntradaLeyendaDib()"><i class="ic ic-plus"></i> Agregar fila</button>`) + seccion('Color', colores()) + seccion('', tamano()) + acciones();
  }
  if (sel?.tipo === 'tabla') {
    return seccion('Tabla', `${sel.encabezado.map((x, c) => `<div class="field"><label>Encabezado ${c + 1}</label><input id="dib-enc-${c}" value="${esc(x)}" oninput="tablaEncabezadoDib(${c}, this.value)" onchange="finEdicionDib()"></div>`).join('')}
      <div class="field"><label>Filas: una por línea</label><textarea id="dib-filas" rows="4" oninput="tablaFilasDib(this.value)" onchange="finEdicionDib()">${esc(sel.filas.map(f => f.join(', ')).join('\n'))}</textarea></div>`) + seccion('', tamano()) + acciones();
  }
  if (sel) return seccion('Color', colores()) + seccion('Grosor', grosores()) + acciones();
  if (h !== 'seleccionar') return seccion('', nota(AYUDA[h] || '')) + seccion('Color', colores()) + seccion('Grosor', grosores());

  // Sin selección: la lámina (cajetín), la escala y la imagen
  return panelLamina(d);
}

function panelLamina(d) {
  const l = d.lamina || {};
  const campo = (k, label, ph = '') => `<div class="field"><label>${label}</label><input id="dib-lam-${k}" value="${esc(l[k] || '')}" placeholder="${esc(ph)}" oninput="setLaminaDib('${k}', this.value)"></div>`;
  const check = (k, label) => `<label class="insp-check"><input type="checkbox" id="dib-lam-${k}" ${l[k] !== false ? 'checked' : ''} onchange="setLaminaDib('${k}', this.checked)"><span>${label}</span></label>`;
  let html = seccion('Escala', `<div class="dib-acciones-el"><span class="tg ${d.escala ? 'verde' : 'ambar'}">${d.escala ? `1 m = ${(1 / d.escala).toFixed(1)} px` : 'Sin escala'}</span>
    <button class="b b-g" onclick="setHerramientaDib('calibrar')">${d.escala ? 'Recalibrar' : 'Calibrar'}</button>${d.escala ? '<button class="b b-l" onclick="quitarEscalaDib()">Quitar escala</button>' : ''}</div>
    <div class="page-sub">Sin escala también puedes escribir los metros de cada vano al seleccionar el tramo.</div>`);
  html += seccion('Cajetín de la lámina', `<div class="insp-checks">${check('activa', 'Incluir el cajetín (título, simbología, distancias, escala y norte)')}${check('norte', 'Flecha de norte (la captura tiene el norte arriba)')}${check('distanciasEnTramos', 'Metros sobre cada vano de los tramos')}${check('verCalibre', 'Calibre y tipo de conductor en los vanos')}${check('verAltura', 'Altura de los postes')}${check('verEstructuras', 'Estructuras de los postes')}${check('verAcometidas', 'Acometidas por vano y su resumen')}</div>
    ${l.activa !== false ? `${campo('titulo', 'Título', 'Ej. Referencia eléctrica o Propuesta')}${campo('subtitulo', 'Descripción', 'Ej. Nuevo transformador para el usuario')}${campo('proyecto', 'Proyecto / WO', 'Ej. WO-01-2025/638')}${campo('fecha', 'Fecha')}${campo('elaboro', 'Elaboró')}
      <div class="field"><label>Tabla de distancias</label><select id="dib-lam-distancias" onchange="setLaminaDib('distancias', this.value)"><option value="auto" ${l.distancias !== 'manual' ? 'selected' : ''}>Automática (entre puntos etiquetados)</option><option value="manual" ${l.distancias === 'manual' ? 'selected' : ''}>Manual</option></select></div>
      ${l.distancias === 'manual' ? `<div class="field"><label>Filas: tramo y metros, una por línea (o pegadas de Excel)</label><textarea id="dib-lam-filas" rows="3" placeholder="P1 – W1, 50" onchange="setLaminaDib('filas', this.value)">${esc((l.filas || []).map(f => f.join(', ')).join('\n'))}</textarea></div>` : ''}
      <div class="page-sub">${l.distancias === 'manual' ? 'Escribe las distancias a mano.' : 'La tabla se arma sola entre los puntos etiquetados que están sobre cada tramo, con los metros de los vanos.'}</div>` : ''}`);
  if (d.fondo) html += seccion('Imagen de fondo', '<button class="b b-l" onclick="quitarFondoDib()">Quitar imagen</button>');
  html += seccion('Atajos', '<div class="page-sub">V seleccionar · Supr borrar · Ctrl+Z deshacer · + / − zoom · 0 ajustar · barra espaciadora + arrastrar para moverte · Ctrl + rueda zoom · Esc soltar</div>');
  return html;
}

// ── Proyectos (en una ventana encima del editor) ──
function formGuardar() {
  return `<div class="modal-head"><div class="modal-titulo">Guardar como proyecto</div><button class="modal-cerrar" onclick="setVistaProyectosDib(null)" title="Cerrar">✕</button></div>
    <div class="form-analisis"><div class="field"><label>Nombre</label><input id="dib-proy-nombre" placeholder="Ej. Propuesta nuevo transformador Col. Las Flores"></div>
    <div class="field"><label>Referencia (opcional)</label><input id="dib-proy-ref" placeholder="WO, NC, reclamo…"></div></div>
    <div class="barra-acciones"><button class="b b-p" onclick="guardarComoProyectoDib()">Guardar</button><button class="b b-l" onclick="setVistaProyectosDib(null)">Cancelar</button></div>
    <div class="page-sub">Queda guardado en la base para el equipo: cualquiera lo abre y lo modifica desde su celular o compu.</div>`;
}
function listaProyectos(d) {
  const lista = Object.entries(state.dibujos || {}).map(([id, x]) => ({ id, ...x }))
    .sort((a, b) => String(b.editado?.fecha || b.creado?.fecha || '').localeCompare(String(a.editado?.fecha || a.creado?.fecha || '')));
  let html = '<div class="modal-head"><div class="modal-titulo">Proyectos guardados</div><button class="modal-cerrar" onclick="setVistaProyectosDib(null)" title="Cerrar">✕</button></div>';
  if (!lista.length) return html + '<div class="empty"><div class="empty-text">Todavía no hay proyectos guardados.</div></div>';
  return html + `<div class="list">${lista.map(x => `<div class="camp-card dib-proy-card ${d.proyecto?.id === x.id ? 'activo' : ''}"><div class="camp-card-cuerpo">
    <div class="exp-nombre">${esc(x.nombre)}</div>
    <div class="exp-sub">${esc([x.referencia, x.editado ? `Modificado ${fmtDate(x.editado.fecha)} · ${x.editado.por}` : ''].filter(Boolean).join(' · '))}</div>
    <div class="barra-acciones"><button class="b b-p" onclick="abrirProyectoDib('${x.id}')">${d.proyecto?.id === x.id ? 'Abierto' : 'Abrir'}</button><button class="b b-l" onclick="eliminarProyectoDib('${x.id}')">Eliminar</button></div></div></div>`).join('')}</div>`;
}
