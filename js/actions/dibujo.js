// Herramienta Dibujar: subir una imagen y dibujar encima; se descarga como PNG. El borrador queda en este navegador
// (localStorage) y, para poder modificarlo después, se guarda como proyecto en la base para el equipo:
// dibujos/{id} = { nombre, referencia, creado, editado } (liviano, para la lista) y dibujosDatos/{id} = { fondo, datos }
// (la imagen en JPG y el dibujo en JSON, que se baja solo al abrirlo). Mientras se arrastra se repinta solo el SVG.
import { altoCajetin, caja, girar, transformar, COLORES, coloresTramos, GROSORES, leerFilasTabla, medidaEtiqueta, medidaReducida, mover, nuevoId, redimensionar, siguienteEtiqueta, SIMBOLOS, svgExportable, svgLamina, tamano, TAM_TEXTO } from '../domain/dibujo.js';
import { anclarTramo, anclas, COLORES_RED, escalaDe, ESTILOS_ETIQUETA, familiaTramo, redDe, seTocan, soltarTramo, TIPOS_TRAMO, fmtMetros, imanar, metrosTramo, nombrePunto, segmentosTramos } from '../domain/plano.js';
import { db, get, push, ref, remove, set } from '../firebase.js';
import { leerAltura } from '../domain/red.js';
import { hoyLocal } from '../domain/trabajo.js';
import { state } from '../state.js';
import { abrirDoc, showToast } from '../ui.js';
import { svgComparacion, svgPropuesta } from '../domain/propuesta.js';
import { alRedibujar, render } from '../views/render.js';

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
    colorRed: null, tamNuevos: 1, conductor: null, // color de la red para los tramos nuevos (null = el de su tipo) y tamaño de los postes nuevos
    proyecto: null, sinGuardar: false, // proyecto: { id, nombre, referencia } del proyecto abierto en la base
  };
}
// Carga una lámina armada en otra parte (p. ej. un levantamiento de campo) como dibujo actual
export function cargarEnDibujo(datos) {
  state.dibujo = { ...nuevoDibujo(), ...datos, lamina: { ...nuevaLamina(), ...(datos.lamina || {}) } };
  vista = null;
  guardarBorrador();
}
export function cargarBorrador() {
  const d = nuevoDibujo();
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (g && Array.isArray(g.elementos)) Object.assign(d, { fondo: g.fondo || null, fondoOpacidad: g.fondoOpacidad || 1, elementos: g.elementos, escala: g.escala || null, lamina: { ...d.lamina, ...(g.lamina || {}) }, proyecto: g.proyecto || null, sinGuardar: !!g.sinGuardar });
  } catch { /* sin borrador */ }
  return d;
}
let avisoEspacio = false;
// cambio = false: solo se guarda el borrador (al abrir o guardar un proyecto), sin marcarlo como "sin guardar"
function guardarBorrador(cambio = true) {
  const d = state.dibujo; if (!d) return;
  if (cambio && d.proyecto) d.sinGuardar = true;
  try { localStorage.setItem(CLAVE, JSON.stringify({ fondo: d.fondo, fondoOpacidad: d.fondoOpacidad, elementos: d.elementos, escala: d.escala, lamina: d.lamina, proyecto: d.proyecto, sinGuardar: d.sinGuardar })); avisoEspacio = false; } catch {
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
// Tamaño de tiradores y marcas: según la imagen y, en pantallas chicas (celular), para que se puedan tocar con el dedo
export const uiDe = d => {
  const { w, h } = tamano(d);
  // px de pantalla por px de imagen (con el zoom); antes de dibujar el lienzo, por su ancho
  const ctm = document.getElementById('dib-svg')?.getScreenCTM?.(); const ancho = document.querySelector('.dib-lienzo')?.clientWidth;
  const k = ctm?.a || (ancho ? ancho / w : 1);
  return Math.max(Math.max(w, h) / 1100, 1.2 / k);
};

// ── Imán ──
// Se pega a postes, vértices y puntas de etiqueta y, si no hay ninguno cerca, a la línea de los tramos. La distancia se
// mide en pantalla: 34 px con el dedo y 18 px con el mouse, sin importar el zoom ni el tamaño de la imagen.
let tolIman = 20;
function medirIman(ev) {
  const k = document.getElementById('dib-svg')?.getScreenCTM()?.a || 1;
  tolIman = (ev.pointerType === 'mouse' ? 18 : 34) / k;
}
function ajustarPunto(p, excluir = null, { lineas = true, ignorarEn = null } = {}) {
  const d = dib();
  let puntos = anclas(d.elementos, SIMBOLOS);
  if (ignorarEn) puntos = puntos.filter(a => Math.hypot(a.x - ignorarEn[0], a.y - ignorarEn[1]) > 0.5);
  const r = imanar(p, puntos, lineas ? segmentosTramos(d.elementos) : [], tolIman, excluir);
  d.iman = r.a ? r.p : null; // marca visible mientras se ajusta
  return r.p;
}
let quitarMarca = null;
function marcaBreve() { clearTimeout(quitarMarca); quitarMarca = setTimeout(() => { if (dib()) { dib().iman = null; repintar(); } }, 600); }
// Centro de un símbolo y lo que tiene pegado (vértices de tramos y puntas de etiquetas en ese punto)
const centroSimbolo = el => [el.x + 30 * el.escala, el.y + 30 * el.escala];
// El símbolo de red más cercano a (x, y), si el toque cae sobre él
function simboloCerca(x, y) {
  return dib().elementos.filter(e => e.tipo === 'simbolo' && SIMBOLOS[e.simbolo]?.grupo === 'red')
    .map(e => ({ e, dist: Math.hypot(centroSimbolo(e)[0] - x, centroSimbolo(e)[1] - y) })).filter(o => o.dist <= Math.max(tolIman * 0.7, 30 * o.e.escala)).sort((a, b) => a.dist - b.dist)[0]?.e || null;
}
function pegadosA([cx, cy], excluir) {
  const out = [];
  dib().elementos.forEach(e => {
    if (e.id === excluir) return;
    if (e.tipo === 'polilinea') e.puntos.forEach(([x, y], i) => { if (Math.hypot(x - cx, y - cy) < 1) out.push({ id: e.id, i }); });
    if (e.tipo === 'etiqueta' && Math.hypot(e.tx - cx, e.ty - cy) < 1) out.push({ id: e.id, destino: true });
  });
  return out;
}

// ── Repintado directo del SVG (durante el arrastre) ──
// En el editor el cajetín se ve solo si se pide ("Ver el cajetín" o al editar la lámina); al exportar va siempre (si está activo)
const conCajetinPantalla = d => d.lamina?.activa !== false && (!!state.dibCajetin || verLamina());
const verLamina = () => !!state.dibVerLamina;
export const partesSVG = d => svgLamina(conCajetinPantalla(d) ? d : { ...d, lamina: { ...(d.lamina || {}), activa: false } }, { pantalla: true, ui: uiDe(d) });
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

// ── Zoom y desplazamiento ──
// vista: ventana de la lámina en pantalla { x, y, w, h } (con la proporción del lienzo); null = toda la lámina.
// Botones +/−/Ajustar, Ctrl + rueda (o pellizco del trackpad), dos dedos en el celular; se desplaza arrastrando el fondo
// con "Seleccionar" (con zoom), con la rueda del mouse apretada o con la barra espaciadora.
let vista = null;
const svgEl = () => document.getElementById('dib-svg');
function laminaCompleta(d = dib()) { const { w, h } = tamano(d); return { w, h: h + (conCajetinPantalla(d) ? altoCajetin(d) : 0) }; }
// Toda la lámina con la proporción del lienzo en pantalla (centrada)
function cajaBase() {
  const f = laminaCompleta(); const r = svgEl()?.getBoundingClientRect();
  if (!r?.width || !r?.height) return { x: 0, y: 0, ...f };
  const k = Math.min(r.width / f.w, r.height / f.h); const w = r.width / k; const h = r.height / k;
  return { x: (f.w - w) / 2, y: (f.h - h) / 2, w, h };
}
const vistaActual = () => vista || cajaBase();
export const viewBoxDib = d => { if (vista) return `${vista.x} ${vista.y} ${vista.w} ${vista.h}`; const f = laminaCompleta(d); return `0 0 ${f.w} ${f.h}`; };
export const zoomPct = () => Math.round((cajaBase().w / vistaActual().w) * 100);
function aplicarVista() {
  const svg = svgEl(); if (!svg) return;
  svg.setAttribute('viewBox', viewBoxDib(dib()));
  const et = document.getElementById('dib-zoom-pct'); if (et) et.textContent = `${zoomPct()} %`;
  repintar(); // tiradores e imán del tamaño de la pantalla
}
// Lleva la ventana a ancho w manteniendo fijo el punto de la lámina que está en (clientX, clientY)
function ventanaEn(w, clientX, clientY, px, py) {
  const r = svgEl().getBoundingClientRect(); const base = cajaBase();
  if (w >= base.w * 0.999) { vista = null; return; }
  w = Math.max(w, base.w / 12); const h = (w * r.height) / r.width;
  vista = { x: px - ((clientX - r.left) * w) / r.width, y: py - ((clientY - r.top) * h) / r.height, w, h };
}
function puntoVista(clientX, clientY) {
  const p = new DOMPoint(clientX, clientY).matrixTransform(svgEl().getScreenCTM().inverse());
  return [p.x, p.y];
}
function zoomA(f, clientX, clientY) {
  const svg = svgEl(); if (!svg) return;
  const r = svg.getBoundingClientRect(); clientX ??= r.left + r.width / 2; clientY ??= r.top + r.height / 2;
  const [px, py] = puntoVista(clientX, clientY);
  ventanaEn(vistaActual().w / f, clientX, clientY, px, py);
  aplicarVista();
}
export function zoomDib(f) { zoomA(f); }
// El editor ocupa el espacio libre entre el encabezado, el menú lateral (compu) o la barra de abajo (celular)
export function instalarAltoDib() {
  alRedibujar(() => {
    if (!document.querySelector('.dib-pagina, .lev-app')) return;
    const raiz = document.documentElement.style; const hd = document.querySelector('header'); const nav = document.querySelector('.bottom-nav');
    raiz.setProperty('--dib-top', `${hd?.getBoundingClientRect().bottom || 0}px`);
    // En el celular la barra de menú va abajo; en la compu es el menú lateral
    const lateral = nav && nav.getBoundingClientRect().height > window.innerHeight * 0.5;
    raiz.setProperty('--dib-bottom', `${nav && !lateral ? nav.offsetHeight : 0}px`);
    raiz.setProperty('--dib-left', `${lateral ? nav.getBoundingClientRect().right : 0}px`);
  });
}
export function ajustarVistaDib() { vista = null; aplicarVista(); }
export function ampliarDib() { const d = dib(); if (!d) return; state.dibAmpliado = !state.dibAmpliado; vista = null; render(); }
export function dibRueda(ev) {
  if (!(ev.ctrlKey || ev.metaKey || state.dibAmpliado)) return; // sin Ctrl la rueda mueve la página
  ev.preventDefault();
  zoomA(Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY);
}
window.addEventListener('resize', () => { if (vista && state.tab === 'dibujar') { vista = null; aplicarVista(); } });
let espacio = false;
// Dedos sobre el lienzo (dos = pellizco) y foto del dibujo al primer toque, para deshacer lo que empezó un dedo
const toques = new Map();
let foto = null;
function iniciarPellizco() {
  const d = dib();
  if (foto) { d.elementos = JSON.parse(foto.el); d.historial.length = Math.min(d.historial.length, foto.hl); d.sel = foto.sel; d.tramo = foto.tramo; }
  d.iman = null; d.calibracion = d.herramienta === 'calibrar' ? null : d.calibracion;
  const [a, b] = [...toques.values()];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  arrastre = { modo: 'pellizco', dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, w: vistaActual().w, p: puntoVista(...mid) };
  repintar();
}
function moverPellizco() {
  const [a, b] = [...toques.values()]; const z = arrastre;
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ventanaEn(z.w / (Math.hypot(a[0] - b[0], a[1] - b[1]) / z.dist), mid[0], mid[1], z.p[0], z.p[1]);
  if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = null; aplicarVista(); });
}
function iniciarDesplazamiento(ev) {
  // Desde lo que se ve (con la proporción del lienzo) y la escala real de la pantalla
  const r = svgEl().getBoundingClientRect(); const [x, y] = puntoVista(r.left, r.top); const s = svgEl().getScreenCTM().a;
  arrastre = { modo: 'desplazar', inicio: [ev.clientX, ev.clientY], v: { x, y, w: r.width / s, h: r.height / s }, s, cambio: false };
}

let arrastre = null;
export function dibPointerDown(ev) {
  const d = dib(); if (!d) return;
  ev.preventDefault();
  toques.set(ev.pointerId, [ev.clientX, ev.clientY]);
  try { svgEl()?.setPointerCapture?.(ev.pointerId); } catch { /* puntero ya suelto */ }
  if (toques.size === 2 && ev.pointerType !== 'mouse') { iniciarPellizco(); return; }
  if (toques.size > 1 || arrastre?.modo === 'pellizco' || arrastre?.modo === 'esperar') return;
  foto = { el: JSON.stringify(d.elementos), hl: d.historial.length, sel: d.sel, tramo: d.tramo };
  if (ev.button === 1 || espacio) { iniciarDesplazamiento(ev); return; }
  medirIman(ev);
  let [x, y] = punto(ev);
  if (y > tamano(d).h) return; // el cajetín no se dibuja a mano
  if (d.trasladando) { toques.delete(ev.pointerId); ponerTraslado(d, x, y); return; }
  const base = { id: nuevoId(), color: d.color, grosor: GROSORES[d.grosor] * escalaBase() };
  const h = d.herramienta;
  if (h === 'seleccionar') {
    let tirador = ev.target.closest?.('[data-tirador]')?.dataset.tirador;
    // La punta de una etiqueta sobre un poste: se mueve el poste (con lo que tiene pegado), no se despega la etiqueta
    if (tirador === 'destino' && seleccionado() && d.elementos.some(e => e.tipo === 'simbolo' && SIMBOLOS[e.simbolo]?.grupo === 'red' && Math.hypot(centroSimbolo(e)[0] - seleccionado().tx, centroSimbolo(e)[1] - seleccionado().ty) < 1)) tirador = null;
    // Los metros de un vano o de una cota se arrastran para que no queden encimados
    const chip = ev.target.closest?.('[data-chip]'); const idChip = chip?.closest('[data-id]')?.dataset.id;
    if (!tirador && chip && idChip) {
      d.sel = idChip; memorizar();
      arrastre = { modo: 'chip', k: Number(chip.dataset.chip), ultimo: [x, y], cambio: false };
      repintar(); return;
    }
    if (tirador && seleccionado()) { memorizar(); arrastre = { modo: 'tirador', tirador, cambio: false, ajuste: tirador === 'destino' || /^v\d+$/.test(tirador) || seleccionado().tipo === 'cota' }; return; }
    // Tocando justo sobre un poste o transformador se agarra el símbolo (no la punta de una etiqueta o el vértice encima)
    const id = simboloCerca(x, y)?.id || ev.target.closest?.('[data-id]')?.dataset.id;
    d.sel = id || null;
    // Con zoom, arrastrar el fondo desplaza la vista (y suelta la selección)
    if (!id && vista) { iniciarDesplazamiento(ev); repintar(); return; }
    // Con algo seleccionado se puede arrastrar: se repinta solo el SVG (render() al soltar, para no perder el arrastre)
    if (id) {
      memorizar();
      arrastre = { modo: 'mover', ultimo: [x, y], cambio: false };
      // Un poste o transformador arrastra lo que tiene pegado y su centro se pega a otros puntos o a los tramos
      const el = seleccionado();
      if (el?.tipo === 'simbolo' && SIMBOLOS[el.simbolo]?.grupo === 'red') {
        const c = centroSimbolo(el);
        Object.assign(arrastre, { modo: 'simbolo', desfase: [c[0] - x, c[1] - y], pegados: pegadosA(c, el.id) });
      }
      repintar();
    } else render();
    return;
  }
  // Encajar: arrastrar mueve todo el dibujo sobre la imagen
  if (h === 'encajar') {
    memorizar();
    arrastre = { modo: 'todo', ultimo: [x, y], cambio: false };
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
    [x, y] = ajustarPunto([x, y], d.tramo); marcaBreve();
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
    const nuevo = { id: base.id, tipo: 'polilinea', tramo: d.tramoTipo, color: d.color, grosor: 6 * escalaBase() * (GROSORES[d.grosor] / GROSORES.medio), puntos: [[x, y]], ...(d.colorRed ? { colorRed: d.colorRed } : {}), ...(d.conductor ? { conductor: { ...d.conductor } } : {}) };
    d.elementos.push(nuevo); d.sel = nuevo.id; d.tramo = nuevo.id; d.ultimoToque = ahora;
    repintar(); render();
    return;
  }
  memorizar();
  let el;
  if (h === 'etiqueta') {
    // Se toca el poste (se ajusta a su centro) y se arrastra hasta donde va la etiqueta; con un toque queda arriba a la derecha
    [x, y] = ajustarPunto([x, y]); marcaBreve();
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
    // Tocar un poste (o símbolo de red) que ya está lo selecciona y se puede arrastrar; no se pone otro encima
    const existente = sim?.grupo === 'red' && simboloCerca(x, y);
    if (existente) {
      d.historial.pop(); d.sel = existente.id;
      memorizar();
      const c = centroSimbolo(existente);
      arrastre = { modo: 'simbolo', desfase: [c[0] - x, c[1] - y], pegados: pegadosA(c, existente.id), cambio: false };
      repintar(); render(); return;
    }
    if (sim?.grupo === 'red') { [x, y] = ajustarPunto([x, y]); marcaBreve(); } // el poste cae justo en el vértice o sobre la línea
    const escala = (sim?.grupo === 'red' ? 0.6 * (d.tamNuevos || 1) : 1.5) * escalaBase();
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
  if (toques.has(ev.pointerId)) toques.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (!arrastre || !dib()) return;
  ev.preventDefault();
  if (arrastre.modo === 'esperar') return;
  if (arrastre.modo === 'pellizco') { if (toques.size >= 2) moverPellizco(); return; }
  if (arrastre.modo === 'desplazar') {
    const a = arrastre; a.cambio = true;
    vista = { ...a.v, x: a.v.x - (ev.clientX - a.inicio[0]) / a.s, y: a.v.y - (ev.clientY - a.inicio[1]) / a.s };
    if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = null; aplicarVista(); });
    return;
  }
  let [x, y] = punto(ev);
  arrastre.cambio = true;
  if (arrastre.modo === 'todo') {
    const d = dib(); const dx = x - arrastre.ultimo[0]; const dy = y - arrastre.ultimo[1]; arrastre.ultimo = [x, y];
    d.elementos = d.elementos.map(e => transformar(e, 1, dx, dy));
  } else if (arrastre.modo === 'calibrar') {
    Object.assign(dib().calibracion, { x2: x, y2: y });
  } else {
    const el = seleccionado(); if (!el) return;
    if (arrastre.ajuste) [x, y] = ajustarPunto([x, y], el.id);
    if (arrastre.modo === 'simbolo') {
      const viejo = centroSimbolo(el);
      const [cx, cy] = ajustarPunto([x + arrastre.desfase[0], y + arrastre.desfase[1]], el.id, { ignorarEn: viejo });
      reemplazar(mover(el, cx - viejo[0], cy - viejo[1]));
      // Lo pegado se mueve con el poste
      arrastre.pegados.forEach(pg => {
        const e = dib().elementos.find(z => z.id === pg.id); if (!e) return;
        reemplazar(pg.destino ? { ...e, tx: cx, ty: cy } : { ...e, puntos: e.puntos.map((q, k) => (k === pg.i ? [cx, cy] : q)) });
      });
    } else if (arrastre.modo === 'chip') {
      const dx = x - arrastre.ultimo[0]; const dy = y - arrastre.ultimo[1]; arrastre.ultimo = [x, y];
      if (el.tipo === 'cota' || el.tipo === 'simbolo') { const [ox, oy] = el.desfase || [0, 0]; reemplazar({ ...el, desfase: [ox + dx, oy + dy] }); } else {
        const [ox, oy] = el.desfases?.[arrastre.k] || [0, 0];
        reemplazar({ ...el, desfases: { ...(el.desfases || {}), [arrastre.k]: [ox + dx, oy + dy] } });
      }
    } else if (arrastre.modo === 'mover') {
      reemplazar(mover(el, x - arrastre.ultimo[0], y - arrastre.ultimo[1]));
      arrastre.ultimo = [x, y];
    } else if (arrastre.modo === 'trazo') reemplazar({ ...el, puntos: [...el.puntos, [x, y]] });
    else if (arrastre.modo === 'etiqueta') { const m = medidaEtiqueta(el); reemplazar({ ...el, x: x - m.w / 2, y: y - m.h / 2 }); }
    else reemplazar(redimensionar(el, arrastre.tirador, x, y));
  }
  if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = null; repintar(); });
}

export function dibPointerUp(ev) {
  if (ev) toques.delete(ev.pointerId);
  const d = dib(); if (!arrastre || !d) return;
  // Al levantar un dedo del pellizco se espera a que se levanten todos (no se dibuja con el que queda)
  if (arrastre.modo === 'pellizco' || arrastre.modo === 'esperar') { arrastre = toques.size ? { modo: 'esperar' } : null; foto = null; if (!arrastre) aplicarVista(); return; }
  if (arrastre.modo === 'desplazar') { const a = arrastre; arrastre = null; if (a.cambio) aplicarVista(); else render(); return; }
  const a = arrastre; arrastre = null;
  d.iman = null;
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
  cerrarTramo(); d.calibracion = null; d.herramienta = h; state.dibVerLamina = false;
  if (h !== 'seleccionar') d.sel = null;
  render();
}
// Cierra el tramo en curso; con un solo punto no queda
// Tramo recién terminado: si toca una red, toma su color y nombre; si no toca ninguna del mismo tipo pero ya hay otra
// dibujada, pregunta si es otra red (de otro transformador) y le pone otro color y el nombre que se escriba
function redNueva(d, t) {
  const fam = familiaTramo(t.tramo); if (!fam || t.colorRed || t.nombreRed) return t;
  const otros = d.elementos.filter(e => e.id !== t.id && e.tipo === 'polilinea' && e.puntos?.length > 1 && familiaTramo(e.tramo) === fam);
  if (!otros.length) return t;
  const vecino = otros.find(o => seTocan(t, o, tolRed()));
  if (vecino) return vecino.colorRed || vecino.nombreRed ? { ...t, ...(vecino.colorRed ? { colorRed: vecino.colorRed } : {}), ...(vecino.nombreRed ? { nombreRed: vecino.nombreRed } : {}) } : t;
  const nivel = fam === 'mt' ? 'MT' : 'BT';
  if (!confirm(`Este tramo no toca la red ${nivel} que ya está dibujada.\n\n¿Es otra red (por ejemplo, el secundario de otro transformador)?\n\nAceptar: se le pone otro color y un nombre. Cancelar: queda igual que la otra.`)) return t;
  const redes = new Set(otros.map(o => o.nombreRed || o.colorRed || 'base'));
  const nombre = String(prompt('Nombre de esta red (sale en la simbología y en la leyenda)', `Red ${nivel} ${redes.size + 1}`) ?? '').trim();
  const usados = new Set(otros.map(o => o.colorRed || TIPOS_TRAMO[o.tramo]?.color));
  const color = COLORES_RED.find(c => !usados.has(c) && c !== TIPOS_TRAMO[t.tramo]?.color) || COLORES_RED[redes.size % COLORES_RED.length];
  return { ...t, colorRed: color, ...(nombre ? { nombreRed: nombre } : {}) };
}
function cerrarTramo() {
  const d = dib(); if (!d?.tramo) return;
  const t = d.elementos.find(e => e.id === d.tramo);
  if (t && t.puntos.length < 2) { d.elementos = d.elementos.filter(e => e.id !== t.id); d.sel = null; d.historial.pop(); }
  else if (t) {
    let nuevo = redNueva(d, t);
    // Con las medidas ancladas, el tramo nuevo también queda anclado con lo que mide
    if (d.lamina?.anclarMedidas) nuevo = anclarTramo(nuevo, d.escala);
    if (nuevo !== t) reemplazar(nuevo);
  }
  d.tramo = null; guardarBorrador();
}
export function terminarTramoDib() { cerrarTramo(); render(); }
export function setTipoTramoDib(t) {
  const d = dib(); if (!d) return; d.tramoTipo = t;
  const el = seleccionado(); if (el?.tipo === 'polilinea') { memorizar(); reemplazar({ ...el, tramo: t }); guardarBorrador(); }
  render();
}
export function setSimboloDib(s) { const d = dib(); if (!d) return; cerrarTramo(); d.simbolo = s; d.herramienta = 'simbolo'; d.sel = null; state.dibVerLamina = false; render(); }
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
  if (['activa', 'distancias', 'norte', 'distanciasEnTramos', 'verCalibre', 'verAltura', 'verEstructuras', 'verAcometidas'].includes(campo)) render();
}

// Color de la red: del tramo seleccionado o, sin selección, de los tramos nuevos (null = el de su tipo)
// Color y nombre de la red: se aplican a toda la red conectada al tramo seleccionado
const tolRed = () => 14 * Math.max(1, tamano(dib()).w / 1600);
const enLaRed = el => new Set(redDe(dib().elementos, el.id, tolRed()));
export function setColorRedDib(c) {
  const d = dib(); if (!d) return; c = c || null;
  const el = seleccionado();
  if (el?.tipo === 'polilinea') {
    memorizar(); const ids = enLaRed(el);
    d.elementos = d.elementos.map(e => { if (!ids.has(e.id)) return e; const { colorRed, ...resto } = e; return c ? { ...resto, colorRed: c } : resto; });
    guardarBorrador();
  }
  d.colorRed = c;
  render();
}
// Nombre de la red en la simbología y los totales (opcional)
// Nota de un símbolo de red (p. ej. el medidor del usuario): sale junto a él
export function setNotaDib(v) { const el = seleccionado(); if (el?.tipo !== 'simbolo') return; editar(e => { const t = String(v || ''); const { nota, ...resto } = e; return t.trim() ? { ...resto, nota: t } : resto; }); }
export function setNombreRedDib(v) {
  const d = dib(); const el = seleccionado(); if (el?.tipo !== 'polilinea') return;
  if (textoMemorizado !== el.id) { memorizar(); textoMemorizado = el.id; }
  const ids = enLaRed(el); const nombre = String(v || '');
  d.elementos = d.elementos.map(e => (ids.has(e.id) ? { ...e, nombreRed: nombre } : e));
  repintar(); guardarBorrador();
}
// Tamaño del elemento seleccionado (× f): símbolos (sin moverse del centro), textos, etiquetas, cotas y grosor de tramos.
// Un poste agrandado deja ese tamaño para los siguientes.
export function setTamanoDib(f) {
  const d = dib(); const el = seleccionado(); if (!d || !el) return;
  memorizar();
  let nuevo = el;
  if (el.tipo === 'simbolo') {
    const escala = Math.max(0.15, Math.min(8, el.escala * f)); const [cx, cy] = centroSimbolo(el);
    nuevo = { ...el, escala, x: cx - 30 * escala, y: cy - 30 * escala };
    if (SIMBOLOS[el.simbolo]?.grupo === 'red') d.tamNuevos = escala / (0.6 * escalaBase());
  } else if (['texto', 'etiqueta', 'cota', 'leyenda', 'tabla'].includes(el.tipo)) nuevo = { ...el, tam: Math.max(8, Math.min(200, Math.round(el.tam * f))) };
  else if (el.grosor) nuevo = { ...el, grosor: Math.max(0.5, Math.min(60, el.grosor * f)) };
  reemplazar(nuevo); guardarBorrador(); render();
}
// Tamaño de los postes nuevos (sin selección)
export function setTamNuevosDib(f) { const d = dib(); if (!d) return; d.tamNuevos = Math.max(0.3, Math.min(5, (d.tamNuevos || 1) * f)); render(); }
// Panel de propiedades: abierto o cerrado (en el celular es una hoja que se abre desde abajo)
// Barra de arriba: menús (Archivo, Imagen de fondo, Exportar) que se cierran al elegir o al tocar fuera
export function cerrarMenusDib(salvo = null) { document.querySelectorAll('.dib-menu[open]').forEach(m => { if (m !== salvo) m.open = false; }); }
document.addEventListener('click', ev => { const m = ev.target.closest?.('.dib-menu'); cerrarMenusDib(m); });
// La lista se ubica debajo de su botón sin salirse de la pantalla (la barra de arriba se desplaza y la cortaría)
document.addEventListener('toggle', ev => {
  const m = ev.target; if (!m.classList?.contains('dib-menu') || !m.open) return;
  const r = m.querySelector('summary').getBoundingClientRect(); const lista = m.querySelector('.dib-menu-lista');
  lista.style.top = `${r.bottom}px`; lista.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - lista.offsetWidth - 8))}px`;
}, true);
// "Lámina": datos de la lámina y cajetín en el panel (se ve el cajetín mientras tanto)
export function verLaminaDib() { const d = dib(); cerrarTramo(); d.sel = null; d.herramienta = 'seleccionar'; state.dibVerLamina = !state.dibVerLamina; if (state.dibVerLamina) { state.dibPanel = true; state.dibPanelMovil = true; } vista = null; render(); }
export function verCajetinDib(v) { state.dibCajetin = !!v; vista = null; render(); }
// La sección Apariencia del panel queda abierta o cerrada para los siguientes (sin redibujar)
export function aparienciaDib(v) { state.dibApariencia = !!v; }
export function estrAbiertaDib(clave, v) { if (v) state.dibEstrAbierta = clave; else if (state.dibEstrAbierta === clave) state.dibEstrAbierta = null; }
export function masSimbolosDib() { state.dibMasSimbolos = !state.dibMasSimbolos; render(); }
export function togglePanelDib() { state.dibPanel = state.dibPanel === false; render(); }
export function abrirPanelMovilDib(v) { state.dibPanelMovil = v; render(); }

// ── Datos técnicos: altura y estructuras del poste, conductor del tramo ──
function cambiarSel(cambio) { const el = seleccionado(); if (!el) return; memorizar(); reemplazar(cambio(el)); guardarBorrador(); render(); }
export function setAlturaDib(v) {
  const a = leerAltura(v);
  if (String(v ?? '').trim() && a === null) return showToast('Escribe la altura en pies (solo el número)');
  cambiarSel(el => { const { altura, ...resto } = el; return a ? { ...resto, altura: a } : resto; });
}
export function agregarEstructuraDib(codigo) {
  const c = String(codigo || '').trim().toUpperCase(); if (!c) return;
  cambiarSel(el => ((el.estructuras || []).includes(c) ? el : { ...el, estructuras: [...(el.estructuras || []), c] }));
}
export function agregarEstructuraEscritaDib() { const inp = document.getElementById('dib-poste-estr-otra'); if (inp?.value.trim()) { agregarEstructuraDib(inp.value); inp.value = ''; } }
export function quitarEstructuraDib(i) { cambiarSel(el => { const estructuras = (el.estructuras || []).filter((_, k) => k !== i); const { estructuras: _e, ...resto } = el; return estructuras.length ? { ...resto, estructuras } : resto; }); }
// Conductor del tramo (calibre y tipo); queda para los tramos siguientes
export function setConductorDib(campo, v) {
  const d = dib(); const val = String(v || '').trim();
  cambiarSel(el => {
    const conductor = { ...(el.conductor || {}), [campo]: val }; if (!val) delete conductor[campo];
    d.conductor = Object.keys(conductor).length ? conductor : null;
    const { conductor: _c, ...resto } = el; return d.conductor ? { ...resto, conductor } : resto;
  });
}
// Calibre de un vano distinto al del tramo (vacío = el del tramo)
export function setCalibreVanoDib(i, v) {
  const val = String(v || '').trim();
  cambiarSel(el => { const calibres = { ...(el.calibres || {}) }; if (val) calibres[i] = val; else delete calibres[i]; const { calibres: _c, ...resto } = el; return Object.keys(calibres).length ? { ...resto, calibres } : resto; });
}

// Anclar medidas (pedido del equipo): los metros de cada vano se quedan como están y los postes se pueden mover a
// conveniencia sin que cambien (para acomodar la red, no solo moverla toda). Al soltarlas vuelven a salir de la escala.
export function anclarTodo(d) {
  d.lamina = { ...(d.lamina || {}), anclarMedidas: true };
  d.elementos = d.elementos.map(e => anclarTramo(e, d.escala));
}
export function anclarMedidasDib(on) {
  const d = dib(); if (!d) return;
  if (on && !d.escala && !d.elementos.some(e => e.tipo === 'polilinea' && e.metros && Object.keys(e.metros).length)) return showToast('Primero calibra la escala (o escribe los metros de los vanos) para tener qué anclar');
  memorizar();
  if (on) anclarTodo(d);
  else { d.lamina = { ...(d.lamina || {}), anclarMedidas: false }; d.elementos = d.elementos.map(soltarTramo); }
  guardarBorrador(); render();
  showToast(on ? 'Medidas ancladas: mueve los postes sin que cambien los metros' : 'Medidas sueltas: los metros vuelven a salir de la escala');
}

// Centro de todo el dibujo (para agrandarlo o girarlo desde ahí)
function centroDibujo(d) {
  const cajas = d.elementos.map(caja).filter(b => b.w || b.h);
  if (!cajas.length) return [0, 0];
  const x0 = Math.min(...cajas.map(b => b.x)); const y0 = Math.min(...cajas.map(b => b.y));
  const x1 = Math.max(...cajas.map(b => b.x + b.w)); const y1 = Math.max(...cajas.map(b => b.y + b.h));
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}
// Encajar: girar todo el dibujo desde su centro (las distancias y los metros no cambian)
// Gira alrededor del promedio de los puntos del dibujo (vértices, centros de los postes, puntas de las etiquetas):
// ese punto gira con el dibujo, así girar a un lado y luego al otro deja todo donde estaba
function centroGiro(d) {
  const pts = d.elementos.flatMap(e => {
    if (e.tipo === 'polilinea' || e.tipo === 'trazo') return e.puntos;
    if (e.tipo === 'linea' || e.tipo === 'flecha' || e.tipo === 'cota') return [[e.x1, e.y1], [e.x2, e.y2]];
    if (e.tipo === 'simbolo') return [[e.x + 30 * e.escala, e.y + 30 * e.escala]];
    if (e.tipo === 'etiqueta') return [[e.tx, e.ty]];
    const b = caja(e); return [[b.x + b.w / 2, b.y + b.h / 2]];
  });
  return pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : [0, 0];
}
export function girarTodoDib(grados) {
  const d = dib(); const g = Number(String(grados ?? '').replace(',', '.')); if (!d?.elementos.length || !g) return;
  const [cx, cy] = centroGiro(d);
  memorizar();
  d.elementos = d.elementos.map(e => girar(e, g, cx, cy));
  guardarBorrador(); render();
}
// Encajar: agrandar o achicar todo el dibujo desde su centro; la escala se ajusta para que los metros no cambien
export function escalarTodoDib(f) {
  const d = dib(); if (!d?.elementos.length) return;
  const [cx, cy] = centroDibujo(d);
  memorizar();
  d.elementos = d.elementos.map(e => transformar(e, f, cx * (1 - f), cy * (1 - f)));
  if (d.escala) d.escala /= f;
  guardarBorrador(); render();
}
export function setOpacidadFondoDib(v) {
  const d = dib(); if (!d) return;
  d.fondoOpacidad = Math.max(0.2, Math.min(1, Number(v) || 1));
  guardarBorrador(); repintarFondo();
}
function repintarFondo() { const img = document.querySelector('#dib-svg > image'); if (img) { if (dib().fondoOpacidad < 1) img.setAttribute('opacity', dib().fondoOpacidad); else img.removeAttribute('opacity'); } }

// Devuelve los metros movidos del tramo o la cota seleccionada a su lugar (el centro del vano)
export function metrosASuLugarDib() {
  const el = seleccionado(); if (!el) return;
  memorizar(); const { desfases, desfase, ...resto } = el; reemplazar(resto); guardarBorrador(); render();
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
  if (d.proyecto && !d.sinGuardar ? false : (d.elementos.length || d.fondo) && !confirm(d.proyecto ? `¿Empezar un dibujo nuevo? Los cambios sin guardar de "${d.proyecto.nombre}" se pierden.` : '¿Empezar un dibujo nuevo? Se borra el actual (guárdalo como proyecto o descárgalo antes si lo necesitas).')) return;
  state.dibujo = nuevoDibujo(); vista = null; guardarBorrador(); render();
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
      const antes = tamano(d);
      const cambiaTamano = antes.w !== w || antes.h !== h;
      // Las fotos van en JPG (pesan mucho menos); las capturas con transparencia quedan en PNG
      d.fondo = { src: f.type === 'image/png' && f.size < 1.5e6 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9), w, h };
      // Con otro tamaño, el dibujo se lleva a la nueva hoja con la misma proporción (y la escala se ajusta: los metros no cambian)
      if (cambiaTamano && habia) {
        memorizar();
        const k = Math.min(w / antes.w, h / antes.h);
        d.elementos = d.elementos.map(e => transformar(e, k, (w - antes.w * k) / 2, (h - antes.h * k) / 2));
        if (d.escala) d.escala /= k;
      }
      if (cambiaTamano) vista = null;
      guardarBorrador();
      if (habia) { d.herramienta = 'encajar'; d.sel = null; }
      render();
      if (habia) showToast('Imagen puesta. Arrastra y agranda el dibujo hasta que calce con las calles; luego "Listo"');
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
    const d = dib(); const p = svgLamina(d);
    // Al triple de resolución (el dibujo es vectorial): nítido al pegarlo en Word o al acercarse; tope de 8000 px por lado
    const k = Math.max(1, Math.min(3, 8000 / Math.max(p.w, p.H)));
    const svg = svgExportable(d, k);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = Math.round(p.w * k); c.height = Math.round(p.H * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
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

// ── Proyectos guardados en la base ──
// La imagen de fondo se guarda en JPG (pesa mucho menos; con fondo blanco donde la captura era transparente)
function fondoJpg(fondo) {
  if (!fondo?.src || fondo.src.startsWith('data:image/jpeg')) return Promise.resolve(fondo || null);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = fondo.w; c.height = fondo.h;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve({ ...fondo, src: c.toDataURL('image/jpeg', 0.85) });
    };
    img.onerror = () => resolve(fondo);
    img.src = fondo.src;
  });
}
const por = () => state.sesionUsuario?.nombre || '';
export function setVistaProyectosDib(v) { state.dibProyectos = v; render(); }
async function escribirProyecto(id, meta) {
  const d = dib();
  const fondo = await fondoJpg(d.fondo);
  if (fondo) d.fondo = fondo;
  await set(ref(db, `dibujosDatos/${id}`), { fondo: fondo || null, datos: JSON.stringify({ elementos: d.elementos, escala: d.escala, lamina: d.lamina, fondoOpacidad: d.fondoOpacidad || 1 }) });
  await set(ref(db, `dibujos/${id}`), meta);
  d.proyecto = { id, nombre: meta.nombre, referencia: meta.referencia || '' }; d.sinGuardar = false;
  guardarBorrador(false);
}
// Guardar: el proyecto abierto se actualiza; si no hay, se pide nombre (formulario en la pantalla)
export async function guardarProyectoDib() {
  const d = dib(); if (!d) return;
  if (!d.proyecto) { state.dibProyectos = 'guardar'; render(); return; }
  const previo = state.dibujos?.[d.proyecto.id] || {};
  try {
    await escribirProyecto(d.proyecto.id, { ...previo, nombre: d.proyecto.nombre, referencia: d.proyecto.referencia || '', editado: { fecha: hoyLocal(), por: por() } });
    showToast(`"${d.proyecto.nombre}" guardado`);
  } catch { showToast('No se pudo guardar; revisa la conexión'); }
  render();
}
export async function guardarComoProyectoDib() {
  const d = dib(); if (!d) return;
  const nombre = document.getElementById('dib-proy-nombre')?.value.trim();
  if (!nombre) return showToast('Ponle un nombre al proyecto');
  if (!d.fondo && !d.elementos.length) return showToast('Todavía no hay nada que guardar');
  const referencia = document.getElementById('dib-proy-ref')?.value.trim() || '';
  const id = push(ref(db, 'dibujos')).key;
  const hoy = { fecha: hoyLocal(), por: por() };
  try {
    await escribirProyecto(id, { nombre, referencia, creado: hoy, editado: hoy });
    state.dibProyectos = null; showToast(`Proyecto "${nombre}" guardado`);
  } catch { showToast('No se pudo guardar; revisa la conexión'); }
  render();
}
export async function abrirProyectoDib(id) {
  const d = dib(); const meta = state.dibujos?.[id]; if (!meta) return;
  if (d && (d.proyecto ? d.sinGuardar : d.elementos.length || d.fondo) && !confirm(d.proyecto ? `Los cambios sin guardar de "${d.proyecto.nombre}" se pierden. ¿Abrir "${meta.nombre}"?` : `¿Abrir "${meta.nombre}"? El dibujo actual (sin guardar como proyecto) se reemplaza.`)) return;
  showToast('Abriendo…');
  try {
    const snap = await get(ref(db, `dibujosDatos/${id}`));
    const g = snap.exists() ? snap.val() : null;
    const datos = g?.datos ? JSON.parse(g.datos) : {};
    state.dibujo = { ...nuevoDibujo(), fondo: g?.fondo || null, elementos: datos.elementos || [], escala: datos.escala || null, fondoOpacidad: datos.fondoOpacidad || 1, lamina: { ...nuevaLamina(), ...(datos.lamina || {}) }, proyecto: { id, nombre: meta.nombre, referencia: meta.referencia || '' } };
    state.dibProyectos = null; vista = null;
    guardarBorrador(false);
  } catch { showToast('No se pudo abrir el proyecto'); }
  render();
}
export function eliminarProyectoDib(id) {
  const meta = state.dibujos?.[id]; if (!meta) return;
  if (!confirm(`¿Eliminar el proyecto "${meta.nombre}"? Se borra para todo el equipo.`)) return;
  remove(ref(db, `dibujos/${id}`)); remove(ref(db, `dibujosDatos/${id}`));
  const d = dib(); if (d?.proyecto?.id === id) { d.proyecto = null; d.sinGuardar = false; guardarBorrador(false); }
  render();
}
// El dibujo sigue en pantalla pero deja de estar ligado al proyecto (para no pisarlo al guardar)
export function soltarProyectoDib() {
  const d = dib(); if (!d?.proyecto) return;
  if (d.sinGuardar && !confirm(`Hay cambios sin guardar en "${d.proyecto.nombre}". ¿Cerrarlo sin guardarlos? El dibujo queda en pantalla como borrador.`)) return;
  d.proyecto = null; d.sinGuardar = false; guardarBorrador(false); render();
}

// Atajos: Supr/Retroceso borra, Ctrl+Z deshace, Ctrl+Y o Ctrl+Mayús+Z rehace, Enter/Esc cierran el tramo, Esc suelta
document.addEventListener('keydown', ev => {
  if (state.tab !== 'dibujar' || !dib()) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  const k = ev.key.toLowerCase();
  if (k === ' ') { espacio = true; ev.preventDefault(); return; }
  if (k === 'escape' && state.dibAmpliado && !dib().sel && !dib().tramo) { ampliarDib(); return; }
  if (!ev.ctrlKey && !ev.metaKey && (k === '+' || k === '=')) { zoomA(1.25); return; }
  if (!ev.ctrlKey && !ev.metaKey && (k === '-' || k === '_')) { zoomA(0.8); return; }
  if (!ev.ctrlKey && !ev.metaKey && k === '0') { ajustarVistaDib(); return; }
  if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && k === 'v') { setHerramientaDib('seleccionar'); return; }
  // Teclas de las herramientas (se ven en la columna de la izquierda)
  const herr = { t: 'tramo', e: 'etiqueta', c: 'cota', x: 'texto' }; const simb = { p: 'poste', r: 'trafo', u: 'usuario' };
  if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && !dib().tramo && (herr[k] || simb[k])) { herr[k] ? setHerramientaDib(herr[k]) : setSimboloDib(simb[k]); return; }
  if (dib().tramo && (k === 'enter' || k === 'escape')) { ev.preventDefault(); terminarTramoDib(); return; }
  if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); ev.shiftKey ? rehacerDib() : deshacerDib(); } else if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); rehacerDib(); } else if ((k === 'delete' || k === 'backspace') && dib().sel) { ev.preventDefault(); borrarDib(); } else if (k === 'escape') { dib().sel = null; render(); }
});

document.addEventListener('keyup', ev => { if (ev.key === ' ') espacio = false; });

// Estructuras: grupo elegido (por punto) y buscador que filtra la lista sin redibujar (no se pierde el teclado)
export function grupoEstructurasUI(clave, g) { state.estrGrupo = { clave, g }; render(); }
export function buscarEstructuras(id, q) {
  const caja = document.getElementById(`${id}-lista`); if (!caja) return;
  const t = String(q || '').trim().toLowerCase(); const g = caja.dataset.g; let n = 0;
  // Al buscar se ve todo lo que coincide, primero lo del grupo elegido
  caja.querySelectorAll('.dib-estr-op').forEach(b => { const ver = t ? b.dataset.q.includes(t) : b.dataset.g === g; b.hidden = !ver; b.style.order = b.dataset.g === g ? 0 : 1; if (ver) n++; });
  caja.querySelector('.dib-estr-nada').hidden = n > 0;
}

// ── Lámina de propuesta (domain/propuesta.js) ──
// Qué se hace con el elemento seleccionado en la propuesta: '' (el de su tipo), existente, instalar, reemplazar, retirar, trasladar
export function setAccionDib(v) {
  cambiarSel(el => { const { accion, ...resto } = el; return v ? { ...resto, accion: v } : resto; });
}
export function setDetalleAccionDib(v) { editar(el => { const t = String(v || ''); const { detalleAccion, ...resto } = el; return t.trim() ? { ...resto, detalleAccion: t } : resto; }); }
// kVA de los transformadores del símbolo (uno por unidad: "37.5" o "25, 25, 25")
export function setKvaDib(v) {
  const lista = String(v || '').split(/[,;+]|\s+y\s+/).map(x => x.trim().replace(/\s*kva$/i, '').replace(',', '.')).filter(Boolean);
  if (lista.some(x => Number.isNaN(Number(x)) || Number(x) <= 0)) return showToast('Escribe los kVA (solo números, separados por coma si son varios)');
  cambiarSel(el => { const { trafos, ...resto } = el; return lista.length ? { ...resto, trafos: lista.map(x => String(Number(x))) } : resto; });
}
// "Se cambia por" (Reemplazar): lo nuevo que va en lugar de lo de hoy (conductor, altura y estructuras, kVA)
function cambiarReemplazo(fn) {
  cambiarSel(el => {
    const r = fn({ ...(el.reemplazo || {}) });
    Object.keys(r).forEach(k => { const v = r[k]; if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) delete r[k]; });
    const { reemplazo, ...resto } = el; return Object.keys(r).length ? { ...resto, reemplazo: r } : resto;
  });
}
export function setReemplazoConductorDib(campo, v) { const val = String(v || '').trim(); cambiarReemplazo(r => { const c = { ...(r.conductor || {}) }; if (val) c[campo] = val; else delete c[campo]; return { ...r, conductor: c }; }); }
export function setReemplazoAlturaDib(v) {
  const a = leerAltura(v);
  if (String(v ?? '').trim() && a === null) return showToast('Escribe la altura en pies (solo el número)');
  cambiarReemplazo(r => ({ ...r, altura: a || undefined }));
}
export function agregarReemplazoEstructuraDib(codigo) {
  const c = String(codigo || '').trim().toUpperCase(); if (!c) return;
  cambiarReemplazo(r => ({ ...r, estructuras: (r.estructuras || []).includes(c) ? r.estructuras : [...(r.estructuras || []), c] }));
}
export function agregarReemplazoEstructuraEscritaDib() { const inp = document.getElementById('dib-remp-estr-otra'); if (inp?.value.trim()) agregarReemplazoEstructuraDib(inp.value); }
export function quitarReemplazoEstructuraDib(i) { cambiarReemplazo(r => ({ ...r, estructuras: (r.estructuras || []).filter((_, k) => k !== i) })); }
export function setReemplazoKvaDib(v) {
  const lista = String(v || '').split(/[,;+]|\s+y\s+/).map(x => x.trim().replace(/\s*kva$/i, '').replace(',', '.')).filter(Boolean);
  if (lista.some(x => Number.isNaN(Number(x)) || Number(x) <= 0)) return showToast('Escribe los kVA (solo números, separados por coma si son varios)');
  cambiarReemplazo(r => ({ ...r, trafos: lista.map(x => String(Number(x))) }));
}
// Trasladar: el siguiente toque en el plano marca dónde queda el poste o símbolo seleccionado
export function marcarTrasladoDib() { const d = dib(); const el = seleccionado(); if (!el) return; d.trasladando = el.id; render(); showToast('Toca en el plano dónde queda'); }
export function cancelarTrasladoDib() { const d = dib(); if (d) d.trasladando = null; render(); }
export function quitarTrasladoDib() { cambiarSel(el => { const { traslado, ...resto } = el; return resto; }); }
function ponerTraslado(d, x, y) {
  const el = d.elementos.find(e => e.id === d.trasladando); d.trasladando = null;
  if (!el) return render();
  d.sel = el.id; memorizar(); reemplazar({ ...el, traslado: [Math.round(x * 10) / 10, Math.round(y * 10) / 10] }); guardarBorrador(); render();
}

// Corregir el texto o la cantidad de un trabajo armado solo (vacío = el automático) u ocultarlo
function cambiarTrabajos(fn) { const d = dib(); if (!d) return; d.lamina = { ...d.lamina, trabajos: fn({ ...(d.lamina?.trabajos || {}) }) }; guardarBorrador(); }
export function setTrabajoDib(id, campo, valor) {
  cambiarTrabajos(t => { const x = { ...(t[id] || {}) }; const v = String(valor ?? '').trim(); if (v) x[campo] = v; else delete x[campo]; if (Object.keys(x).length) t[id] = x; else delete t[id]; return t; });
}
export function ocultarTrabajoDib(id, oculto) { cambiarTrabajos(t => { const x = { ...(t[id] || {}) }; if (oculto) x.oculto = true; else delete x.oculto; if (Object.keys(x).length) t[id] = x; else delete t[id]; return t; }); render(); }
// Trabajos escritos a mano (van después de los del dibujo)
function cambiarExtra(fn) { const d = dib(); if (!d) return; d.lamina = { ...d.lamina, trabajosExtra: fn([...(d.lamina?.trabajosExtra || [])]) }; guardarBorrador(); }
export function agregarTrabajoDib() { cambiarExtra(l => [...l, { accion: 'instalar', texto: '', cantidad: '' }]); render(); }
export function setTrabajoExtraDib(i, campo, valor, redibujar = false) { cambiarExtra(l => l.map((t, k) => (k === i ? { ...t, [campo]: String(valor ?? '') } : t))); if (campo === 'accion' || redibujar) render(); }
export function quitarTrabajoExtraDib(i) { cambiarExtra(l => l.filter((_, k) => k !== i)); render(); }

// Descarga las dos láminas de la propuesta: PDF (carta horizontal, para imprimir) o PNG (una imagen por lámina)
function pngDeSvg(svg, w, h, k = 2) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); c.toBlob(b => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo generar la imagen')); };
    img.src = url;
  });
}
export async function descargarPropuestaDib(formato) {
  const d = dib(); if (!d) return;
  if (!d.elementos.length) return showToast('Todavía no hay nada dibujado');
  const laminas = [svgComparacion(d), svgPropuesta(d)];
  const base = nombreArchivo(d).replace(/\.png$/, '');
  if (formato === 'pdf') {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${base}</title><style>
      @page { size: letter landscape; margin: 0; } * { margin: 0; padding: 0; } html, body { background: #e6edf0; }
      .barra { position: sticky; top: 0; text-align: center; padding: 10px; background: #0b2e3b; } .barra button { font: 700 14px Arial; padding: 9px 20px; border: 0; border-radius: 8px; cursor: pointer; }
      .hoja { width: 11in; height: 8.5in; margin: 16px auto; background: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.15); page-break-after: always; break-after: page; }
      .hoja:last-child { page-break-after: auto; break-after: auto; } .hoja svg { width: 100%; height: 100%; display: block; }
      @media print { html, body { background: #fff; } .barra { display: none; } .hoja { margin: 0; box-shadow: none; } }
    </style></head><body><div class="barra"><button onclick="window.print()">Imprimir o guardar como PDF</button></div>${laminas.map(s => `<div class="hoja">${s.replace(/ width="1650" height="1275"/, '')}</div>`).join('')}</body></html>`;
    abrirDoc(html, `${base}.html`);
    return;
  }
  try {
    for (const [i, svg] of laminas.entries()) {
      const b = await pngDeSvg(svg, 1650, 1275);
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${base}-lamina${i + 1}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  } catch (err) { showToast(err.message); }
}
