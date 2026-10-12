// Herramienta Dibujar: subir una imagen y dibujar encima; se descarga como PNG (confirmado: no se guarda en la base).
// El borrador queda solo en este navegador (localStorage). Mientras se arrastra se repinta solo el SVG, sin render().
import { caja, COLORES, coloresTramos, GROSORES, leerFilasTabla, medidaEtiqueta, medidaReducida, mover, nuevoId, redimensionar, siguienteEtiqueta, SIMBOLOS, svgExportable, svgLamina, tamano, TAM_TEXTO } from '../domain/dibujo.js';
import { ajustar, anclas, escalaDe, ESTILOS_ETIQUETA, fmtMetros, metrosTramo, nombrePunto } from '../domain/plano.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

const CLAVE = 'nettracker_dibujo';
const HISTORIAL_MAX = 60;
const hoyTexto = () => new Date().toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function nuevaLamina() {
  return { activa: true, titulo: 'Propuesta', subtitulo: '', proyecto: '', fecha: hoyTexto(), elaboro: state.sesionUsuario?.nombre || '', norte: true, distancias: 'auto', filas: [], distanciasEnTramos: true };
}
export function nuevoDibujo() {
  return {
    fondo: null, elementos: [], escala: null, lamina: nuevaLamina(), sel: null, herramienta: 'seleccionar', simbolo: 'poste', color: COLORES[0], grosor: 'medio',
    tamTexto: 'mediano', tramoTipo: 'bt', estiloEtiqueta: 'existente', prefijo: 'P', tramo: null, calibracion: null, historial: [], rehacer: [],
  };
}
export function cargarBorrador() {
  const d = nuevoDibujo();
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (g && Array.isArray(g.elementos)) Object.assign(d, { fondo: g.fondo || null, elementos: g.elementos, escala: g.escala || null, lamina: { ...d.lamina, ...(g.lamina || {}) } });
  } catch { /* sin borrador */ }
  return d;
}
let avisoEspacio = false;
function guardarBorrador() {
  const d = state.dibujo; if (!d) return;
  try { localStorage.setItem(CLAVE, JSON.stringify({ fondo: d.fondo, elementos: d.elementos, escala: d.escala, lamina: d.lamina })); avisoEspacio = false; } catch {
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
export const uiDe = d => { const { w, h } = tamano(d); return Math.max(w, h) / 1100; };
// Ajuste a postes, vértices y puntos cercanos (tolerancia en píxeles de la imagen)
const ajustarPunto = (p, excluir = null) => ajustar(p, anclas(dib().elementos, SIMBOLOS), 18 * uiDe(dib()), excluir);

// ── Repintado directo del SVG (durante el arrastre) ──
export const partesSVG = d => svgLamina(d, { pantalla: true, ui: uiDe(d) });
function repintar() {
  const p = partesSVG(dib());
  const capa = document.getElementById('dib-capa'); if (capa) capa.innerHTML = p.capa;
  const caj = document.getElementById('dib-cajetin'); if (caj) caj.innerHTML = p.cajetin;
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
  let [x, y] = punto(ev);
  if (y > tamano(d).h) return; // el cajetín no se dibuja a mano
  const svg = document.getElementById('dib-svg');
  svg.setPointerCapture?.(ev.pointerId);
  const base = { id: nuevoId(), color: d.color, grosor: GROSORES[d.grosor] * escalaBase() };
  const h = d.herramienta;
  if (h === 'seleccionar') {
    const tirador = ev.target.closest?.('[data-tirador]')?.dataset.tirador;
    if (tirador && seleccionado()) { memorizar(); arrastre = { modo: 'tirador', tirador, cambio: false, ajuste: tirador === 'destino' || /^v\d+$/.test(tirador) || seleccionado().tipo === 'cota' }; return; }
    const id = ev.target.closest?.('[data-id]')?.dataset.id;
    d.sel = id || null;
    // Con algo seleccionado se puede arrastrar: se repinta solo el SVG (render() al soltar, para no perder el arrastre)
    if (id) { memorizar(); arrastre = { modo: 'mover', ultimo: [x, y], cambio: false }; repintar(); } else render();
    return;
  }
  // Calibrar la escala: se traza una línea sobre una distancia conocida
  if (h === 'calibrar') {
    d.calibracion = { x1: x, y1: y, x2: x, y2: y };
    arrastre = { modo: 'calibrar', cambio: false };
    repintar();
    return;
  }
  // Tramo de red: cada toque agrega un vértice (ajustado al poste más cercano); doble toque, Enter o "Terminar"
  if (h === 'tramo') {
    [x, y] = ajustarPunto([x, y], d.tramo);
    const t = d.tramo && d.elementos.find(e => e.id === d.tramo);
    const ahora = ev.timeStamp; // tiempo del toque (para el doble toque)
    if (t) {
      const [lx, ly] = t.puntos[t.puntos.length - 1];
      if (ahora - (d.ultimoToque || 0) < 350 && Math.hypot(x - lx, y - ly) < 25 * escalaBase()) { d.ultimoToque = 0; terminarTramoDib(); return; }
      reemplazar({ ...t, puntos: [...t.puntos, [x, y]] });
      d.ultimoToque = ahora; guardarBorrador(); repintar();
      return;
    }
    memorizar();
    const nuevo = { id: base.id, tipo: 'polilinea', tramo: d.tramoTipo, color: d.color, grosor: 6 * escalaBase() * (GROSORES[d.grosor] / GROSORES.medio), puntos: [[x, y]] };
    d.elementos.push(nuevo); d.sel = nuevo.id; d.tramo = nuevo.id; d.ultimoToque = ahora;
    repintar(); render();
    return;
  }
  memorizar();
  let el;
  if (h === 'etiqueta') {
    // Se toca el poste (se ajusta a su centro) y se arrastra hasta donde va la etiqueta; con un toque queda arriba a la derecha
    [x, y] = ajustarPunto([x, y]);
    const tam = Math.round(19 * escalaBase());
    el = { id: base.id, tipo: 'etiqueta', estilo: d.estiloEtiqueta, texto: siguienteEtiqueta(d.elementos, d.prefijo), tam, tx: x, ty: y, x: x + tam * 1.4, y: y - tam * 3.6 };
    d.elementos.push(el); d.sel = el.id;
    arrastre = { modo: 'etiqueta', cambio: false };
    repintar();
    return;
  }
  if (h === 'cota') {
    [x, y] = ajustarPunto([x, y]);
    el = { id: base.id, tipo: 'cota', x1: x, y1: y, x2: x, y2: y, tam: Math.round(15 * escalaBase()) };
    d.elementos.push(el); d.sel = el.id;
    arrastre = { modo: 'tirador', tirador: 'p2', nuevo: true, cambio: false, ajuste: true };
    repintar();
    return;
  }
  if (h === 'leyenda' || h === 'tabla') {
    const tam = Math.round(18 * escalaBase());
    el = h === 'leyenda'
      ? { id: base.id, tipo: 'leyenda', x, y, tam, fondo: '#ffffff', entradas: (coloresTramos(d.elementos).length ? coloresTramos(d.elementos) : [d.color]).map(c => ({ color: c, texto: 'Descripción del tramo' })) }
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
    // Símbolos de red en tamaño de plano; los de unifilar más grandes. Con el color propio del símbolo si lo trae
    const sim = SIMBOLOS[d.simbolo];
    const escala = (sim?.grupo === 'red' ? 0.6 : 1.5) * escalaBase();
    el = { id: base.id, tipo: 'simbolo', simbolo: d.simbolo, color: sim?.color || d.color, grosor: base.grosor, escala, rot: 0, x: x - 30 * escala, y: y - 30 * escala };
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
  let [x, y] = punto(ev);
  arrastre.cambio = true;
  if (arrastre.modo === 'calibrar') {
    Object.assign(dib().calibracion, { x2: x, y2: y });
  } else {
    const el = seleccionado(); if (!el) return;
    if (arrastre.ajuste) [x, y] = ajustarPunto([x, y], el.id);
    if (arrastre.modo === 'mover') {
      reemplazar(mover(el, x - arrastre.ultimo[0], y - arrastre.ultimo[1]));
      arrastre.ultimo = [x, y];
    } else if (arrastre.modo === 'trazo') reemplazar({ ...el, puntos: [...el.puntos, [x, y]] });
    else if (arrastre.modo === 'etiqueta') { const m = medidaEtiqueta(el); reemplazar({ ...el, x: x - m.w / 2, y: y - m.h / 2 }); }
    else reemplazar(redimensionar(el, arrastre.tirador, x, y));
  }
  if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = null; repintar(); });
}

export function dibPointerUp() {
  const d = dib(); if (!arrastre || !d) return;
  const a = arrastre; arrastre = null;
  if (a.modo === 'calibrar') { render(); setTimeout(() => document.getElementById('dib-metros')?.focus(), 0); return; }
  const el = seleccionado();
  // Un clic sin arrastrar con línea, cota, figura o trazo no deja un elemento vacío
  if (a.modo === 'etiqueta') { /* la etiqueta queda aunque no se arrastre */ } else if (a.nuevo && el) {
    const b = caja(el);
    if (b.w < 4 && b.h < 4) { d.elementos = d.elementos.filter(e => e.id !== el.id); d.sel = null; d.historial.pop(); }
  } else if (!a.cambio && a.modo !== 'trazo') d.historial.pop();
  guardarBorrador();
  repintar(); render();
}

// ── Escala ──
export function aplicarCalibracionDib() {
  const d = dib(); const c = d?.calibracion;
  if (!c) return showToast('Traza la línea de calibración sobre la imagen');
  const px = Math.hypot(c.x2 - c.x1, c.y2 - c.y1);
  if (px < 10) return showToast('Traza la línea de calibración sobre la imagen');
  const e = escalaDe(px, document.getElementById('dib-metros')?.value);
  if (!e) return showToast('Escribe cuántos metros mide la línea');
  d.escala = e; d.calibracion = null; d.herramienta = 'seleccionar';
  guardarBorrador(); render();
  showToast('Escala calibrada: ya se miden los tramos y las cotas');
}
export function cancelarCalibracionDib() { const d = dib(); if (!d) return; d.calibracion = null; d.herramienta = 'seleccionar'; render(); }
export function quitarEscalaDib() {
  const d = dib(); if (!d?.escala) return;
  if (!confirm('¿Quitar la escala? Los metros dejarán de mostrarse hasta que vuelvas a calibrar.')) return;
  d.escala = null; guardarBorrador(); render();
}

// ── Barra de herramientas ──
export function setHerramientaDib(h) {
  const d = dib(); if (!d) return;
  cerrarTramo(); d.calibracion = null; d.herramienta = h;
  if (h !== 'seleccionar') d.sel = null;
  render();
}
// Cierra el tramo en curso; con un solo punto no queda
function cerrarTramo() {
  const d = dib(); if (!d?.tramo) return;
  const t = d.elementos.find(e => e.id === d.tramo);
  if (t && t.puntos.length < 2) { d.elementos = d.elementos.filter(e => e.id !== t.id); d.sel = null; d.historial.pop(); }
  d.tramo = null; guardarBorrador();
}
export function terminarTramoDib() { cerrarTramo(); render(); }
export function setTipoTramoDib(t) {
  const d = dib(); if (!d) return; d.tramoTipo = t;
  const el = seleccionado(); if (el?.tipo === 'polilinea') { memorizar(); reemplazar({ ...el, tramo: t }); guardarBorrador(); }
  render();
}
export function setSimboloDib(s) { const d = dib(); if (!d) return; cerrarTramo(); d.simbolo = s; d.herramienta = 'simbolo'; d.sel = null; render(); }
export function setColorDib(c) {
  const d = dib(); if (!d) return; d.color = c;
  const el = seleccionado(); if (el && el.tipo !== 'polilinea' && el.tipo !== 'etiqueta') { memorizar(); reemplazar({ ...el, color: c }); guardarBorrador(); }
  render();
}
export function setGrosorDib(g) {
  const d = dib(); if (!d) return; d.grosor = g;
  const el = seleccionado();
  if (el && !['texto', 'etiqueta', 'cota', 'leyenda', 'tabla'].includes(el.tipo)) {
    memorizar();
    reemplazar({ ...el, grosor: el.tipo === 'polilinea' ? 6 * escalaBase() * (GROSORES[g] / GROSORES.medio) : GROSORES[g] * escalaBase() });
    guardarBorrador();
  }
  render();
}
export function setTamTextoDib(t) {
  const d = dib(); if (!d) return; d.tamTexto = t;
  const el = seleccionado(); if (el?.tipo === 'texto') { memorizar(); reemplazar({ ...el, tam: Math.round(TAM_TEXTO[t] * escalaBase()) }); guardarBorrador(); }
  render();
}
// Mientras se escribe solo se repinta el SVG (el campo no pierde el foco); un solo paso de deshacer por elemento
let textoMemorizado = null;
function editar(cambio) {
  const el = seleccionado(); if (!el) return;
  if (textoMemorizado !== el.id) { memorizar(); textoMemorizado = el.id; }
  reemplazar(cambio(el)); repintar(); guardarBorrador();
}
export function textoDib(v) { const el = seleccionado(); if (el?.tipo !== 'texto' && el?.tipo !== 'etiqueta') return; editar(e => ({ ...e, texto: v })); }
export function finTextoDib() { textoMemorizado = null; render(); }
export function finEdicionDib() { textoMemorizado = null; render(); }

// ── Etiquetas ──
export function setPrefijoDib(v) { const d = dib(); if (d) d.prefijo = String(v || '').trim().slice(0, 6); }
export function setEstiloEtiquetaDib(k) {
  const d = dib(); if (!d || !ESTILOS_ETIQUETA[k]) return;
  d.estiloEtiqueta = k;
  const el = seleccionado();
  if (el?.tipo === 'etiqueta') { memorizar(); reemplazar({ ...el, estilo: k }); guardarBorrador(); } else d.prefijo = ESTILOS_ETIQUETA[k].prefijo;
  render();
}

// Metros escritos a mano para un vano del tramo seleccionado (vacío = automático con la escala)
export function metrosVanoDib(i, valor) {
  const el = seleccionado(); if (el?.tipo !== 'polilinea') return;
  const v = String(valor ?? '').trim().replace(',', '.');
  if (v && (Number.isNaN(Number(v)) || Number(v) < 0)) return showToast('Escribe solo el número de metros');
  editar(e => { const metros = { ...(e.metros || {}) }; if (v) metros[i] = Number(v); else delete metros[i]; return { ...e, metros }; });
  // Sin render(): se pasa de un vano a otro sin redibujar la pantalla; solo se actualizan el dibujo y los totales
  const total = metrosTramo(seleccionado(), dib().escala);
  document.querySelectorAll('.dib-total-tramo').forEach(n => { n.textContent = total !== null ? `Total ${fmtMetros(total)}` : ''; });
}
export function finVanoDib() { textoMemorizado = null; }
// Texto rápido de la etiqueta: conserva el nombre del punto (P8) y pone la acción
export function accionEtiquetaDib(texto) {
  const el = seleccionado(); if (el?.tipo !== 'etiqueta') return;
  memorizar(); reemplazar({ ...el, texto: `${nombrePunto(el.texto) || 'P'}: ${texto}` }); guardarBorrador(); render();
}

// ── Leyenda y tabla manuales ──
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

// ── Cajetín de la lámina ──
export function setLaminaDib(campo, valor) {
  const d = dib(); if (!d) return;
  d.lamina = { ...d.lamina, [campo]: campo === 'filas' ? leerFilasTabla(valor) : valor };
  guardarBorrador(); repintar();
  // Lo que cambia el tamaño del cajetín o las opciones de la pantalla redibuja todo
  if (['activa', 'distancias', 'norte', 'distanciasEnTramos'].includes(campo)) render();
}

export function girarDib() { const el = seleccionado(); if (el?.tipo !== 'simbolo') return; memorizar(); reemplazar({ ...el, rot: ((el.rot || 0) + 90) % 360 }); guardarBorrador(); render(); }
export function duplicarDib() {
  const d = dib(); const el = seleccionado(); if (!el) return;
  memorizar();
  const off = 30 * escalaBase();
  const copia = { ...mover(el, off, off), id: nuevoId() };
  if (copia.tipo === 'etiqueta') Object.assign(copia, { tx: el.tx + off, ty: el.ty + off });
  d.elementos.push(copia); d.sel = copia.id; guardarBorrador(); render();
}
export function borrarDib() {
  const d = dib(); if (!d?.sel) return;
  memorizar(); d.elementos = d.elementos.filter(e => e.id !== d.sel); d.sel = null;
  if (d.tramo && !d.elementos.some(e => e.id === d.tramo)) d.tramo = null;
  guardarBorrador(); render();
}
export function alFrenteDib() {
  const d = dib(); const el = seleccionado(); if (!el) return;
  memorizar(); d.elementos = [...d.elementos.filter(e => e.id !== el.id), el]; guardarBorrador(); render();
}
export function deshacerDib() {
  const d = dib(); if (!d?.historial.length) return;
  d.rehacer.push(JSON.stringify(d.elementos)); d.elementos = JSON.parse(d.historial.pop());
  if (!d.elementos.some(e => e.id === d.sel)) d.sel = null;
  if (d.tramo && !d.elementos.some(e => e.id === d.tramo)) d.tramo = null;
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
      const cambiaTamano = !d.fondo || d.fondo.w !== w || d.fondo.h !== h;
      // Las fotos van en JPG (pesan mucho menos); las capturas con transparencia quedan en PNG
      d.fondo = { src: f.type === 'image/png' && f.size < 1.5e6 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9), w, h };
      if (cambiaTamano) d.escala = null; // otra imagen, otra escala
      guardarBorrador(); render();
      if (habia) showToast(cambiaTamano ? 'Imagen cambiada; vuelve a calibrar la escala' : 'Imagen cambiada; los dibujos se conservan');
    };
    img.onerror = () => showToast('No se pudo leer la imagen');
    img.src = lector.result;
  };
  lector.readAsDataURL(f);
}
export function quitarFondoDib() {
  const d = dib(); if (!d?.fondo) return;
  if (!confirm('¿Quitar la imagen de fondo? Los dibujos se conservan.')) return;
  d.fondo = null; d.escala = null; guardarBorrador(); render();
}

// ── Exportar ──
function pngDelDibujo() {
  return new Promise((resolve, reject) => {
    const d = dib(); const p = svgLamina(d); const svg = svgExportable(d);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = p.w; c.height = p.H;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, p.w, p.H); ctx.drawImage(img, 0, 0, p.w, p.H);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo generar la imagen')); };
    img.src = url;
  });
}
// Nombre del archivo sin tildes (el navegador cambia por "download" los nombres con caracteres especiales)
const nombreArchivo = d => `${String(d.lamina?.titulo || 'dibujo').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_') || 'dibujo'}-${new Date().toISOString().slice(0, 10)}.png`;
export async function descargarDib() {
  const d = dib(); if (!d) return;
  if (!d.fondo && !d.elementos.length) return showToast('Todavía no hay nada que descargar');
  try {
    const b = await pngDelDibujo();
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nombreArchivo(d);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (err) { showToast(err.message); }
}
export async function copiarDib() {
  const d = dib(); if (!d) return;
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return showToast('Este navegador no permite copiar imágenes; usa Descargar PNG');
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngDelDibujo() })]);
    showToast('Imagen copiada: pégala en Word con Ctrl+V');
  } catch { showToast('No se pudo copiar; usa Descargar PNG'); }
}

// Atajos: Supr/Retroceso borra, Ctrl+Z deshace, Ctrl+Y o Ctrl+Mayús+Z rehace, Enter/Esc cierran el tramo, Esc suelta
document.addEventListener('keydown', ev => {
  if (state.tab !== 'dibujar' || !dib()) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  const k = ev.key.toLowerCase();
  if (dib().tramo && (k === 'enter' || k === 'escape')) { ev.preventDefault(); terminarTramoDib(); return; }
  if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); ev.shiftKey ? rehacerDib() : deshacerDib(); } else if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); rehacerDib(); } else if ((k === 'delete' || k === 'backspace') && dib().sel) { ev.preventDefault(); borrarDib(); } else if (k === 'escape') { dib().sel = null; render(); }
});
