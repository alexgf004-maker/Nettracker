// Pestaña Dibujar (Herramientas): imagen de fondo y dibujo encima, sin relación con ningún caso.
import { capaHTML, cargarBorrador } from '../actions/dibujo.js';
import { COLORES, GROSORES, SIMBOLOS, tamano, TAM_TEXTO } from '../domain/dibujo.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { heroSeccion } from './componentes.js';

const esc = s => escapeHtml(s ?? '');
const ic = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const HERRAMIENTAS = [
  ['seleccionar', 'Seleccionar y mover', ic('<path d="M5 3l14 8-6 2-3 6z"/>')],
  ['linea', 'Línea', ic('<line x1="4" y1="20" x2="20" y2="4"/>')],
  ['flecha', 'Flecha', ic('<line x1="4" y1="20" x2="19" y2="5"/><path d="M10 5h9v9"/>')],
  ['rect', 'Rectángulo', ic('<rect x="4" y="6" width="16" height="12" rx="1"/>')],
  ['elipse', 'Círculo', ic('<ellipse cx="12" cy="12" rx="8" ry="7"/>')],
  ['texto', 'Texto', ic('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>')],
  ['trazo', 'Trazo libre', ic('<path d="M3 17c3-6 5 2 8-4s5 2 8-6"/>')],
  ['simbolo', 'Símbolos eléctricos', ic('<circle cx="12" cy="9" r="5"/><circle cx="12" cy="15" r="5"/>')],
];
const miniSimbolo = (k, color = 'currentColor') => `<svg viewBox="-4 -4 68 68" width="34" height="34" color="${color}" stroke="${color}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round">${SIMBOLOS[k].svg}</svg>`;

export function renderDibujar() {
  state.dibujo ??= cargarBorrador();
  const d = state.dibujo;
  const { w, h } = tamano(d);
  const sel = d.elementos.find(e => e.id === d.sel) || null;
  let html = '<div class="content dib-pagina">';
  html += heroSeccion({
    eyebrow: 'Herramientas', titulo: 'Dibujar',
    sub: 'Sube una imagen (foto, captura o plano) y dibuja encima líneas, flechas, figuras, textos y símbolos eléctricos. Descárgala como PNG para pegarla en Word. No se guarda en la base: el borrador queda solo en este navegador.',
    acciones: `<label class="hero-btn blanco"><i class="ic ic-subir"></i> ${d.fondo ? 'Cambiar imagen' : 'Subir imagen'}<input type="file" accept="image/*" hidden onchange="subirFondoDib(this.files); this.value=''"></label>`,
  });

  // Barra: herramientas, color, grosor y acciones
  html += `<div class="dib-barra">
    <div class="dib-grupo">${HERRAMIENTAS.map(([k, t, i]) => `<button class="dib-btn ${d.herramienta === k ? 'activo' : ''}" title="${t}" aria-label="${t}" onclick="setHerramientaDib('${k}')">${i}</button>`).join('')}</div>
    <div class="dib-grupo">${COLORES.map(c => `<button class="dib-color ${d.color === c ? 'activo' : ''}" style="background:${c}" title="Color" aria-label="Color ${c}" onclick="setColorDib('${c}')"></button>`).join('')}</div>
    <div class="dib-grupo">${Object.keys(GROSORES).map(g => `<button class="dib-btn ${d.grosor === g ? 'activo' : ''}" title="Grosor ${g}" aria-label="Grosor ${g}" onclick="setGrosorDib('${g}')"><span class="dib-grosor" style="height:${GROSORES[g]}px"></span></button>`).join('')}</div>
    <div class="dib-grupo">
      <button class="dib-btn" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" onclick="deshacerDib()" ${d.historial.length ? '' : 'disabled'}>${ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>')}</button>
      <button class="dib-btn" title="Rehacer" aria-label="Rehacer" onclick="rehacerDib()" ${d.rehacer.length ? '' : 'disabled'}>${ic('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>')}</button>
    </div>
    <div class="dib-grupo dib-final">
      <button class="b b-p" onclick="descargarDib()"><i class="ic ic-descargar"></i> Descargar PNG</button>
      <button class="b b-g" onclick="copiarDib()">Copiar</button>
      ${d.fondo ? '<button class="b b-l" onclick="quitarFondoDib()">Quitar imagen</button>' : ''}
      <button class="b b-l" onclick="nuevoLienzoDib()">Nuevo</button>
    </div></div>`;

  // Paleta de símbolos
  if (d.herramienta === 'simbolo') {
    html += `<div class="dib-simbolos">${Object.entries(SIMBOLOS).map(([k, s]) => `<button class="dib-simbolo ${d.simbolo === k ? 'activo' : ''}" onclick="setSimboloDib('${k}')" title="${s.nombre}">${miniSimbolo(k)}<span>${s.nombre}</span></button>`).join('')}</div>`;
  }

  // Opciones del elemento seleccionado o la ayuda de la herramienta, en una fila de alto fijo (el lienzo no salta)
  let fila;
  if (sel) {
    fila = `${sel.tipo === 'texto' ? `<textarea id="dib-texto" rows="1" oninput="textoDib(this.value)" onchange="finTextoDib()" placeholder="Escribe el texto">${esc(sel.texto)}</textarea>
        ${Object.keys(TAM_TEXTO).map(t => `<button class="b ${d.tamTexto === t ? 'b-p' : 'b-g'}" onclick="setTamTextoDib('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}` : ''}
      ${sel.tipo === 'simbolo' ? '<button class="b b-g" onclick="girarDib()">Girar 90°</button>' : ''}
      <button class="b b-g" onclick="duplicarDib()">Duplicar</button>
      <button class="b b-g" onclick="alFrenteDib()">Al frente</button>
      <button class="b b-l dib-borrar" onclick="borrarDib()">Borrar</button>`;
  } else {
    fila = `<span class="page-sub">${{
      seleccionar: 'Toca un elemento para seleccionarlo y arrastrarlo. Supr borra lo seleccionado y Ctrl+Z deshace.',
      linea: 'Arrastra para trazar la línea.', flecha: 'Arrastra desde el inicio hasta donde apunta la flecha.',
      rect: 'Arrastra para dibujar el rectángulo.', elipse: 'Arrastra para dibujar el círculo.',
      texto: 'Toca donde va el texto y escríbelo en el recuadro que aparece aquí.', trazo: 'Dibuja a mano alzada.',
      simbolo: 'Toca la imagen donde va el símbolo. Después puedes moverlo, agrandarlo con el punto de la esquina o girarlo.',
    }[d.herramienta] || ''}${!d.fondo && !d.elementos.length ? ' Sin imagen se dibuja sobre una hoja en blanco.' : ''}</span>`;
  }
  html += `<div class="dib-sel-barra">${fila}</div>`;

  // Lienzo
  const fondo = d.fondo ? `<image href="${d.fondo.src}" x="0" y="0" width="${w}" height="${h}"/>` : `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
  html += `<div class="dib-lienzo"><svg id="dib-svg" class="dib-svg herr-${d.herramienta}" viewBox="0 0 ${w} ${h}" onpointerdown="dibPointerDown(event)" onpointermove="dibPointerMove(event)" onpointerup="dibPointerUp(event)" onpointercancel="dibPointerUp(event)">${fondo}<g id="dib-capa">${capaHTML(d)}</g></svg></div>`;
  return html + '</div>';
}
