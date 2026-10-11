// Herramienta Dibujar: subir una imagen y dibujar encima; se descarga como PNG (confirmado: no se guarda en la base).
// El borrador queda solo en este navegador (localStorage). Mientras se arrastra se repinta solo el SVG, sin render().
import { caja, COLORES, coloresTramos, leerFilasTabla, definiciones, GROSORES, medidaEtiqueta, medidaReducida, mover, nuevoId, redimensionar, siguienteEtiqueta, svgElemento, svgExportable, tamano, TAM_TEXTO } from '../domain/dibujo.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

const CLAVE = 'nettracker_dibujo';
const HISTORIAL_MAX = 60;

export function nuevoDibujo() {
  return { fondo: null, elementos: [], sel: null, herramienta: 'seleccionar', simbolo: 'transformador', color: COLORES[0], grosor: 'medio', tamTexto: 'mediano', prefijo: 'P', fondoEtiqueta: '#fde047', tramo: null, historial: [], rehacer: [] };
}
export function cargarBorrador() {
  const d = nuevoDibujo();
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (g && Array.isArray(g.elementos)) Object.assign(d, { fondo: g.fondo || null, elementos: g.elementos });
  } catch { /* sin borrador */ }
  return d;
}
let avisoEspacio = false;
function guardarBorrador() {
  const d = state.dibujo; if (!d) return;
  try { localStorage.setItem(CLAVE, JSON.stringify({ fondo: d.fondo, elementos: d.elementos })); avisoEspacio = false; } catch {
    if (!avisoEspacio) showToast('El dibujo es muy grande para guardarse como borrador en este navegador; descárgalo antes de cerrar');
    avisoEspacio = true;
  }
}

const dib = () => state.dibujo;
const seleccionado = () => dib()?.elementos.find(e => e.id === dib().sel) || null;
function memorizar() {
  const d = dib();
  d.historial.push(JSON.stringify(d.elementos));
  if (d.historial.length > HISTORIAL_MAX) d.historial.shift();
  d.rehacer = [];
}
function reemplazar(el) { const d = dib(); d.elementos = d.elementos.map(e => (e.id === el.id ? el : e)); }
// Escala de los símbolos y textos según el tamaño del lienzo
const escalaBase = () => { const { w, h } = tamano(dib()); return Math.max(w, h) / 1600; };

// ── Repintado directo del SVG (durante el arrastre) ──
export function capaHTML(d) {
  const { w, h } = tamano(d); const ui = Math.max(w, h) / 1100;
  return definiciones(d.elementos) + d.elementos.map(e => svgElemento(e, { sel: e.id === d.sel, ui })).join('');
}
function repintar() {
  const capa = document.getElementById('dib-capa');
  if (capa) capa.innerHTML = capaHTML(dib());
}

function punto(ev) {
  const svg = document.getElementById('dib-svg');
  const m = svg.getScreenCTM().inverse();
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m);
  return [p.x, p.y];
}

let arrastre = null;
export function dibPointerDown(ev) {
  const d = dib(); if (!d) return;
  ev.preventDefault();
  const svg = document.getElementById('dib-svg');
  svg.setPointerCapture?.(ev.pointerId);
  const [x, y] = punto(ev);
  const base = { id: nuevoId(), color: d.color, grosor: GROSORES[d.grosor] * escalaBase() };
  const h = d.herramienta;
  if (h === 'seleccionar') {
    const tirador = ev.target.closest?.('[data-tirador]')?.dataset.tirador;
    if (tirador && seleccionado()) { memorizar(); arrastre = { modo: 'tirador', tirador, cambio: false }; return; }
    const id = ev.target.closest?.('[data-id]')?.dataset.id;
    d.sel = id || null;
    // Con algo seleccionado se puede arrastrar: se repinta solo el SVG (render() al soltar, para no perder el arrastre)
    if (id) { memorizar(); arrastre = { modo: 'mover', ultimo: [x, y], cambio: false }; repintar(); } else render();
    return;
  }
  // Tramo de red: cada toque agrega un vértice; doble toque, Enter o "Terminar tramo" lo cierran
  if (h === 'tramo') {
    const t = d.tramo && d.elementos.find(e => e.id === d.tramo);
    const ahora = ev.timeStamp; // tiempo del toque (para el doble toque)
    if (t) {
      const [lx, ly] = t.puntos[t.puntos.length - 1];
      if (ahora - (d.ultimoToque || 0) < 350 && Math.hypot(x - lx, y - ly) < 25 * escalaBase()) { d.ultimoToque = 0; return terminarTramoDib(); }
      reemplazar({ ...t, puntos: [...t.puntos, [x, y]] });
      d.ultimoToque = ahora; guardarBorrador(); repintar();
      return;
    }
    memorizar();
    const nuevo = { ...base, grosor: base.grosor * 1.6, tipo: 'polilinea', puntos: [[x, y]] };
    d.elementos.push(nuevo); d.sel = nuevo.id; d.tramo = nuevo.id; d.ultimoToque = ahora;
    repintar(); render();
    return;
  }
  memorizar();
  let el;
  if (h === 'etiqueta') {
    // Se toca el punto (poste) y se arrastra hasta donde va el cuadro; con un toque, el cuadro queda arriba a la derecha
    const tam = Math.round(20 * escalaBase());
    el = { id: base.id, tipo: 'etiqueta', texto: siguienteEtiqueta(d.elementos, d.prefijo), fondo: d.fondoEtiqueta, tam, tx: x, ty: y, x: x + tam * 1.5, y: y - tam * 4 };
    d.elementos.push(el); d.sel = el.id;
    arrastre = { modo: 'etiqueta', cambio: false };
    repintar();
    return;
  }
  if (h === 'leyenda' || h === 'tabla') {
    const tam = Math.round(18 * escalaBase());
    el = h === 'leyenda'
      ? { id: base.id, tipo: 'leyenda', x, y, tam, fondo: '#fde2d3', entradas: (coloresTramos(d.elementos).length ? coloresTramos(d.elementos) : [d.color]).map(c => ({ color: c, texto: 'Descripción del tramo' })) }
      : { id: base.id, tipo: 'tabla', x, y, tam, encabezado: ['REFERENCIA', 'DISTANCIA [m]'], filas: [['P1W1', '']] };
    d.elementos.push(el); d.sel = el.id; d.herramienta = 'seleccionar';
    guardarBorrador(); render();
    return;
  }
  if (h === 'linea' || h === 'flecha') el = { ...base, tipo: h, x1: x, y1: y, x2: x, y2: y };
  else if (h === 'rect' || h === 'elipse') el = { ...base, tipo: h, x, y, w: 0, h: 0 };
  else if (h === 'trazo') el = { ...base, tipo: 'trazo', puntos: [[x, y]] };
  else if (h === 'texto') {
    el = { id: base.id, tipo: 'texto', color: d.color, x, y, texto: 'Texto', tam: Math.round(TAM_TEXTO[d.tamTexto] * escalaBase()) };
    d.elementos.push(el); d.sel = el.id; d.herramienta = 'seleccionar';
    guardarBorrador(); render();
    const inp = document.getElementById('dib-texto'); if (inp) { inp.focus(); inp.select(); }
    return;
  } else if (h === 'simbolo') {
    const escala = 1.5 * escalaBase();
    el = { id: base.id, tipo: 'simbolo', simbolo: d.simbolo, color: d.color, grosor: base.grosor, escala, rot: 0, x: x - 30 * escala, y: y - 30 * escala };
    d.elementos.push(el); d.sel = el.id;
    guardarBorrador(); repintar(); render();
    return;
  }
  d.elementos.push(el); d.sel = el.id;
  arrastre = { modo: h === 'trazo' ? 'trazo' : 'tirador', tirador: h === 'linea' || h === 'flecha' ? 'p2' : 'esquina', nuevo: true, cambio: false };
  repintar();
}

let cuadro = null;
export function dibPointerMove(ev) {
  if (!arrastre || !dib()) return;
  ev.preventDefault();
  const [x, y] = punto(ev);
  const el = seleccionado(); if (!el) return;
  arrastre.cambio = true;
  if (arrastre.modo === 'mover') {
    reemplazar(mover(el, x - arrastre.ultimo[0], y - arrastre.ultimo[1]));
    arrastre.ultimo = [x, y];
  } else if (arrastre.modo === 'trazo') reemplazar({ ...el, puntos: [...el.puntos, [x, y]] });
  else if (arrastre.modo === 'etiqueta') { const m = medidaEtiqueta(el); reemplazar({ ...el, x: x - m.w / 2, y: y - m.h / 2 }); }
  else reemplazar(redimensionar(el, arrastre.tirador, x, y));
  if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = null; repintar(); });
}

export function dibPointerUp() {
  const d = dib(); if (!arrastre || !d) return;
  const a = arrastre; arrastre = null;
  const el = seleccionado();
  // Un clic sin arrastrar con línea, figura o trazo no deja un elemento vacío
  if (a.modo === 'etiqueta') { /* la etiqueta queda aunque no se arrastre */ } else if (a.nuevo && el) {
    const b = caja(el);
    if (b.w < 4 && b.h < 4) { d.elementos = d.elementos.filter(e => e.id !== el.id); d.sel = null; d.historial.pop(); }
  } else if (!a.cambio && a.modo !== 'trazo') d.historial.pop();
  guardarBorrador();
  repintar(); render();
}

// ── Barra de herramientas ──
export function setHerramientaDib(h) { const d = dib(); if (!d) return; cerrarTramo(); d.herramienta = h; if (h !== 'seleccionar') d.sel = null; render(); }
// Cierra el tramo en curso; con un solo punto no queda
function cerrarTramo() {
  const d = dib(); if (!d?.tramo) return;
  const t = d.elementos.find(e => e.id === d.tramo);
  if (t && t.puntos.length < 2) { d.elementos = d.elementos.filter(e => e.id !== t.id); d.sel = null; d.historial.pop(); }
  d.tramo = null; guardarBorrador();
}
export function terminarTramoDib() { cerrarTramo(); render(); }
export function setSimboloDib(s) { const d = dib(); if (!d) return; d.simbolo = s; d.herramienta = 'simbolo'; d.sel = null; render(); }
export function setColorDib(c) {
  const d = dib(); if (!d) return; d.color = c;
  const el = seleccionado(); if (el) { memorizar(); reemplazar({ ...el, color: c }); guardarBorrador(); }
  render();
}
export function setGrosorDib(g) {
  const d = dib(); if (!d) return; d.grosor = g;
  const el = seleccionado();
  if (el && el.tipo !== 'texto') { memorizar(); reemplazar({ ...el, grosor: GROSORES[g] * escalaBase() }); guardarBorrador(); }
  render();
}
export function setTamTextoDib(t) {
  const d = dib(); if (!d) return; d.tamTexto = t;
  const el = seleccionado(); if (el?.tipo === 'texto') { memorizar(); reemplazar({ ...el, tam: Math.round(TAM_TEXTO[t] * escalaBase()) }); guardarBorrador(); }
  render();
}
// Mientras se escribe solo se repinta el SVG (el campo no pierde el foco)
let textoMemorizado = null;
export function textoDib(v) {
  const el = seleccionado(); if (el?.tipo !== 'texto' && el?.tipo !== 'etiqueta') return;
  if (textoMemorizado !== el.id) { memorizar(); textoMemorizado = el.id; }
  reemplazar({ ...el, texto: v }); repintar(); guardarBorrador();
}
export function finTextoDib() { textoMemorizado = null; render(); }

// ── Etiquetas, leyenda y tabla ──
export function setPrefijoDib(v) { const d = dib(); if (d) d.prefijo = String(v || '').trim().slice(0, 6) || 'P'; }
export function setFondoEtiquetaDib(c) {
  const d = dib(); if (!d) return; d.fondoEtiqueta = c;
  const el = seleccionado(); if (el?.tipo === 'etiqueta') { memorizar(); reemplazar({ ...el, fondo: c }); guardarBorrador(); }
  render();
}
// Cambios de texto mientras se escribe: un solo paso de deshacer por elemento y sin perder el foco
function editar(cambio) {
  const el = seleccionado(); if (!el) return;
  if (textoMemorizado !== el.id) { memorizar(); textoMemorizado = el.id; }
  reemplazar(cambio(el)); repintar(); guardarBorrador();
}
export function leyendaTextoDib(i, v) { editar(el => ({ ...el, entradas: el.entradas.map((e, k) => (k === i ? { ...e, texto: v } : e)) })); }
export function leyendaColorDib(i) { const c = dib().color; editar(el => ({ ...el, entradas: el.entradas.map((e, k) => (k === i ? { ...e, color: c } : e)) })); textoMemorizado = null; render(); }
export function agregarEntradaLeyendaDib() {
  const d = dib(); const el = seleccionado(); if (el?.tipo !== 'leyenda') return;
  memorizar();
  const usados = el.entradas.map(e => e.color);
  const nuevo = coloresTramos(d.elementos).find(c => !usados.includes(c)) || d.color;
  reemplazar({ ...el, entradas: [...el.entradas, { color: nuevo, texto: 'Descripción del tramo' }] }); guardarBorrador(); render();
}
export function quitarEntradaLeyendaDib(i) {
  const el = seleccionado(); if (el?.tipo !== 'leyenda' || el.entradas.length <= 1) return;
  memorizar(); reemplazar({ ...el, entradas: el.entradas.filter((_, k) => k !== i) }); guardarBorrador(); render();
}
export function tablaEncabezadoDib(c, v) { editar(el => ({ ...el, encabezado: el.encabezado.map((x, k) => (k === c ? v : x)) })); }
export function tablaFilasDib(texto) { editar(el => ({ ...el, filas: leerFilasTabla(texto) })); }
export function finEdicionDib() { textoMemorizado = null; render(); }

export function girarDib() { const el = seleccionado(); if (el?.tipo !== 'simbolo') return; memorizar(); reemplazar({ ...el, rot: ((el.rot || 0) + 90) % 360 }); guardarBorrador(); render(); }
export function duplicarDib() {
  const d = dib(); const el = seleccionado(); if (!el) return;
  memorizar();
  const off = 30 * escalaBase();
  const copia = { ...mover(el, off, off), id: nuevoId() };
  d.elementos.push(copia); d.sel = copia.id; guardarBorrador(); render();
}
export function borrarDib() {
  const d = dib(); if (!d?.sel) return;
  memorizar(); d.elementos = d.elementos.filter(e => e.id !== d.sel); d.sel = null; guardarBorrador(); render();
}
export function alFrenteDib() {
  const d = dib(); const el = seleccionado(); if (!el) return;
  memorizar(); d.elementos = [...d.elementos.filter(e => e.id !== el.id), el]; guardarBorrador(); render();
}
export function deshacerDib() {
  const d = dib(); if (!d?.historial.length) return;
  d.rehacer.push(JSON.stringify(d.elementos)); d.elementos = JSON.parse(d.historial.pop());
  if (!d.elementos.some(e => e.id === d.sel)) d.sel = null;
  guardarBorrador(); render();
}
export function rehacerDib() {
  const d = dib(); if (!d?.rehacer.length) return;
  d.historial.push(JSON.stringify(d.elementos)); d.elementos = JSON.parse(d.rehacer.pop());
  guardarBorrador(); render();
}
export function nuevoLienzoDib() {
  const d = dib(); if (!d) return;
  if ((d.elementos.length || d.fondo) && !confirm('¿Empezar un dibujo nuevo? Se borra el actual (descárgalo antes si lo necesitas).')) return;
  state.dibujo = nuevoDibujo(); guardarBorrador(); render();
}

// ── Imagen de fondo ──
export function subirFondoDib(files) {
  const f = files?.[0]; if (!f) return;
  if (!/^image\//.test(f.type)) return showToast('Elige una imagen (JPG o PNG)');
  const lector = new FileReader();
  lector.onload = () => {
    const img = new Image();
    img.onload = () => {
      const { w, h } = medidaReducida(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const d = dib();
      const habia = d.elementos.length > 0;
      // Las fotos van en JPG (pesan mucho menos); las capturas con transparencia quedan en PNG
      d.fondo = { src: f.type === 'image/png' && f.size < 1.5e6 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9), w, h };
      guardarBorrador(); render();
      if (habia) showToast('Imagen cambiada; los dibujos se conservan');
    };
    img.onerror = () => showToast('No se pudo leer la imagen');
    img.src = lector.result;
  };
  lector.readAsDataURL(f);
}
export function quitarFondoDib() {
  const d = dib(); if (!d?.fondo) return;
  if (!confirm('¿Quitar la imagen de fondo? Los dibujos se conservan.')) return;
  d.fondo = null; guardarBorrador(); render();
}

// ── Exportar ──
function pngDelDibujo() {
  return new Promise((resolve, reject) => {
    const d = dib(); const { w, h } = tamano(d);
    const url = URL.createObjectURL(new Blob([svgExportable(d)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo generar la imagen')); };
    img.src = url;
  });
}
export async function descargarDib() {
  const d = dib(); if (!d) return;
  if (!d.fondo && !d.elementos.length) return showToast('Todavía no hay nada que descargar');
  const sel = d.sel; d.sel = null; repintar();
  try {
    const b = await pngDelDibujo();
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `dibujo-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (err) { showToast(err.message); }
  d.sel = sel; repintar();
}
export async function copiarDib() {
  const d = dib(); if (!d) return;
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return showToast('Este navegador no permite copiar imágenes; usa Descargar PNG');
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngDelDibujo() })]);
    showToast('Imagen copiada: pégala en Word con Ctrl+V');
  } catch { showToast('No se pudo copiar; usa Descargar PNG'); }
}

// Atajos: Supr/Retroceso borra, Ctrl+Z deshace, Ctrl+Y o Ctrl+Mayús+Z rehace, Esc suelta la selección
document.addEventListener('keydown', ev => {
  if (state.tab !== 'dibujar' || !dib()) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  const k = ev.key.toLowerCase();
  if (dib().tramo && (k === 'enter' || k === 'escape')) { ev.preventDefault(); return terminarTramoDib(); }
  if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); ev.shiftKey ? rehacerDib() : deshacerDib(); } else if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); rehacerDib(); } else if ((k === 'delete' || k === 'backspace') && dib().sel) { ev.preventDefault(); borrarDib(); } else if (k === 'escape') { dib().sel = null; render(); }
});
