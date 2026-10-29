// Herramienta Dibujar: una imagen de fondo (captura del mapa, foto o plano) y elementos encima: tramos de red,
// simbología, etiquetas de punto, cotas, líneas, figuras, textos y trazo libre. Debajo va el cajetín de la lámina
// (título, simbología, distancias, escala y norte). Funciones puras: el estado es
// { fondo: { src, w, h } | null, elementos: [...], escala (m por px) | null, lamina: {...} } y de aquí sale el SVG
// que se ve en pantalla y el que se exporta a PNG. Coordenadas en píxeles de la imagen.
import { balanceAcometidas, conductorVano, hayAcometidas, sumaAcometidas, textoAcometidas, textoConductor, textoPoste } from './red.js';
import { nombreRed, ESTILOS_ETIQUETA, fmtMetros, largoEscala, longitud, metrosVano, nombrePunto, tablaDistancias, TIPOS_TRAMO, totalesPorTipo } from './plano.js';

export const LIENZO = { w: 1600, h: 1000 }; // sin imagen de fondo
export const COLORES = ['#dc2626', '#a21caf', '#2563eb', '#15803d', '#f59e0b', '#0f172a', '#ffffff'];
export const GROSORES = { fino: 2, medio: 4, grueso: 8 };
export const TAM_TEXTO = { chico: 22, mediano: 34, grande: 52 };
const NEGRO = '#111827';
const FUENTE = 'Arial, Helvetica, sans-serif';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = v => Math.round(v * 10) / 10;

// Símbolos en una caja de 60×60 (el color del elemento es currentColor). grupo 'red': simbología del plano (van al
// cajetín y a ellos se ajustan tramos y etiquetas); 'diagrama': símbolos eléctricos de unifilar.
export const SIMBOLOS = {
  poste: { grupo: 'red', nombre: 'Poste existente', color: '#111827', svg: '<circle cx="30" cy="30" r="12" fill="#111827" stroke="#ffffff" stroke-width="4"/>' },
  poste_nuevo: { grupo: 'red', nombre: 'Poste proyectado', color: '#2563eb', svg: '<circle cx="30" cy="30" r="12" fill="#ffffff" stroke="currentColor" stroke-width="6"/><circle cx="30" cy="30" r="4" fill="currentColor" stroke="none"/>' },
  trafo: { grupo: 'red', nombre: 'Transformador existente', color: '#15803d', svg: '<path d="M30 7 L55 51 L5 51 Z" fill="currentColor" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>' },
  trafo_nuevo: { grupo: 'red', nombre: 'Transformador proyectado', color: '#2563eb', svg: '<path d="M30 7 L55 51 L5 51 Z" fill="#ffffff" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><text x="30" y="45" text-anchor="middle" font-size="19" font-weight="800" fill="currentColor" stroke="none" font-family="Arial">N</text>' },
  usuario: { grupo: 'red', nombre: 'Usuario', color: '#dc2626', svg: '<path d="M30 58 C30 58 9 34 9 22 A21 21 0 0 1 51 22 C51 34 30 58 30 58 Z" fill="currentColor" stroke="#ffffff" stroke-width="3"/><path d="M21 25 L30 17 L39 25 L39 33 L21 33 Z" fill="#ffffff" stroke="none"/>' },
  medidor_red: { grupo: 'red', nombre: 'Medidor', color: '#0f172a', svg: '<rect x="12" y="12" width="36" height="36" rx="7" fill="#ffffff" stroke="currentColor" stroke-width="5"/><text x="30" y="37" text-anchor="middle" font-size="18" font-weight="800" fill="currentColor" stroke="none" font-family="Arial">M</text>' },
  seccionador: { grupo: 'red', nombre: 'Seccionador / cuchilla', color: '#ea580c', svg: '<circle cx="30" cy="30" r="15" fill="#ffffff" stroke="currentColor" stroke-width="5"/><line x1="20" y1="40" x2="40" y2="20" stroke="currentColor" stroke-width="5"/>' },
  puente: { grupo: 'red', nombre: 'Puente al vuelo', color: '#0f766e', svg: '<path d="M10 31 A20 20 0 0 1 50 31" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="30" r="7" fill="currentColor" stroke="#ffffff" stroke-width="3"/>' },
  banco: { grupo: 'red', nombre: 'Banco de transformadores', color: '#15803d', svg: '<path d="M2 50 L12 28 L22 50 Z M19 50 L30 24 L41 50 Z M38 50 L48 28 L58 50 Z" fill="currentColor" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><line x1="2" y1="52" x2="58" y2="52" stroke="currentColor" stroke-width="3"/>' },
  // Seccionamiento de la red BT (circuito abierto: dos barras; domain/seccionar.js). Las barras van de través a la línea
  seccionamiento: { grupo: 'red', nombre: 'Seccionamiento de red', color: '#dc2626', svg: '<rect x="16" y="6" width="28" height="48" fill="#ffffff" stroke="none"/><line x1="22" y1="9" x2="22" y2="51" stroke-width="7"/><line x1="38" y1="9" x2="38" y2="51" stroke-width="7"/>' },
  medicion: { grupo: 'red', nombre: 'Punto de medición', color: '#f59e0b', svg: '<rect x="9" y="11" width="42" height="38" rx="7" fill="currentColor" stroke="#ffffff" stroke-width="3.5"/><path d="M15 33 L21 25 L27 36 L33 21 L39 33 L45 27" stroke="#ffffff" stroke-width="3.5" fill="none"/>' },
  transformador: { grupo: 'diagrama', nombre: 'Transformador', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="23" r="11"/><circle cx="30" cy="37" r="11"/><line x1="30" y1="48" x2="30" y2="60"/>' },
  interruptor: { grupo: 'diagrama', nombre: 'Interruptor', svg: '<line x1="30" y1="0" x2="30" y2="18"/><line x1="30" y1="42" x2="30" y2="60"/><line x1="30" y1="42" x2="44" y2="20"/><circle cx="30" cy="18" r="2.5"/><circle cx="30" cy="42" r="2.5"/>' },
  fusible: { grupo: 'diagrama', nombre: 'Fusible', svg: '<line x1="30" y1="0" x2="30" y2="14"/><rect x="21" y="14" width="18" height="32" rx="2"/><line x1="30" y1="14" x2="30" y2="46"/><line x1="30" y1="46" x2="30" y2="60"/>' },
  medidor: { grupo: 'diagrama', nombre: 'Medidor', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="30" r="18"/><text x="30" y="36" text-anchor="middle" font-size="15" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">kWh</text><line x1="30" y1="48" x2="30" y2="60"/>' },
  analizador: { grupo: 'diagrama', nombre: 'Analizador', svg: '<rect x="8" y="10" width="44" height="40" rx="4"/><path d="M14 34 L20 26 L26 38 L32 22 L38 36 L46 28"/><line x1="30" y1="0" x2="30" y2="10"/>' },
  tablero: { grupo: 'diagrama', nombre: 'Tablero', svg: '<rect x="10" y="6" width="40" height="48" rx="2"/><line x1="18" y1="18" x2="42" y2="18"/><line x1="18" y1="28" x2="42" y2="28"/><line x1="18" y1="38" x2="42" y2="38"/>' },
  tierra: { grupo: 'diagrama', nombre: 'Tierra', svg: '<line x1="30" y1="0" x2="30" y2="30"/><line x1="14" y1="30" x2="46" y2="30"/><line x1="20" y1="38" x2="40" y2="38"/><line x1="26" y1="46" x2="34" y2="46"/>' },
  motor: { grupo: 'diagrama', nombre: 'Motor', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="30" r="18"/><text x="30" y="37" text-anchor="middle" font-size="20" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">M</text>' },
  variador: { grupo: 'diagrama', nombre: 'Variador (VFD)', svg: '<line x1="30" y1="0" x2="30" y2="12"/><rect x="8" y="12" width="44" height="36" rx="3"/><line x1="8" y1="48" x2="52" y2="12"/><text x="20" y="27" text-anchor="middle" font-size="11" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">~</text><text x="41" y="43" text-anchor="middle" font-size="11" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">=</text><line x1="30" y1="48" x2="30" y2="60"/>' },
  capacitor: { grupo: 'diagrama', nombre: 'Capacitor', svg: '<line x1="30" y1="0" x2="30" y2="25"/><line x1="14" y1="25" x2="46" y2="25"/><line x1="14" y1="35" x2="46" y2="35"/><line x1="30" y1="35" x2="30" y2="60"/>' },
  dps: { grupo: 'diagrama', nombre: 'DPS', svg: '<line x1="30" y1="0" x2="30" y2="14"/><rect x="20" y="14" width="20" height="28"/><path d="M33 18 L26 29 L34 29 L27 39"/><line x1="30" y1="42" x2="30" y2="50"/><line x1="20" y1="50" x2="40" y2="50"/><line x1="24" y1="55" x2="36" y2="55"/>' },
  carga: { grupo: 'diagrama', nombre: 'Carga', svg: '<line x1="30" y1="0" x2="30" y2="24"/><path d="M16 24 L44 24 L30 50 Z"/>' },
  generador: { grupo: 'diagrama', nombre: 'Planta / generador', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="30" r="18"/><text x="30" y="37" text-anchor="middle" font-size="20" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">G</text>' },
};

let contador = 0;
export const nuevoId = () => `e${Date.now().toString(36)}${(contador++).toString(36)}`;

// ── Medidas de etiquetas, leyendas y tablas (texto en negrita Arial, ancho aproximado por carácter) ──
const ANCHO_LETRA = 0.68; // mayúsculas en negrita (P1, USUARIO) caben con holgura
// sub: datos del poste al que apunta (altura y estructuras), en una franja blanca debajo del nombre
// sub: datos del punto debajo del nombre, una línea por renglón (el que empieza con "!!" es un aviso, en rojo)
export function medidaEtiqueta(el, sub = '') {
  const lineas = String(el.texto || '').split('\n'); const pad = el.tam * 0.45;
  const ts = el.tam * 0.84; const subs = sub ? String(sub).split('\n').filter(Boolean) : []; const altoSub = subs.length ? ts * (0.25 + subs.length * 1.2) : 0;
  const w = Math.max(Math.max(1, ...lineas.map(l => l.length)) * el.tam * ANCHO_LETRA, ...subs.map(t => t.replace(/^!!/, '').length * ts * ANCHO_LETRA)) + pad * 2;
  return { w, h: lineas.length * el.tam * 1.2 + pad * 0.8 + altoSub, hNombre: lineas.length * el.tam * 1.2 + pad * 0.8, pad, lineas, sub: subs.join('\n'), subs, ts };
}
export function medidaLeyenda(el) {
  const pad = el.tam * 0.5; const muestra = el.tam * 1.8; const alto = el.tam * 1.5;
  const entradas = el.entradas || [];
  return { w: pad * 3 + muestra + Math.max(8, ...entradas.map(e => String(e.texto || '').length)) * el.tam * ANCHO_LETRA, h: pad * 2 + Math.max(1, entradas.length) * alto, pad, muestra, alto };
}
export function medidaTabla(el) {
  const filas = [el.encabezado || [], ...(el.filas || [])];
  const cols = Math.max(1, ...filas.map(f => f.length));
  const pad = el.tam * 0.5; const alto = el.tam * 1.5;
  const anchos = Array.from({ length: cols }, (_, c) => Math.max(3, ...filas.map(f => String(f[c] ?? '').length)) * el.tam * ANCHO_LETRA + pad * 2);
  return { w: anchos.reduce((a, b) => a + b, 0), h: filas.length * alto, anchos, alto, pad };
}

// Caja que ocupa un elemento: { x, y, w, h }
const cajaPuntos = puntos => {
  const xs = puntos.map(p => p[0]); const ys = puntos.map(p => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};
export function caja(el) {
  switch (el.tipo) {
    case 'linea': case 'flecha': case 'cota': return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    case 'rect': case 'elipse': return { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) };
    case 'trazo': case 'polilinea': return cajaPuntos(el.puntos);
    case 'simbolo': return { x: el.x, y: el.y, w: 60 * el.escala, h: 60 * el.escala };
    case 'texto': { const lineas = String(el.texto || '').split('\n'); return { x: el.x, y: el.y - el.tam, w: Math.max(...lineas.map(l => l.length)) * el.tam * 0.58, h: lineas.length * el.tam * 1.2 }; }
    case 'etiqueta': { const m = medidaEtiqueta(el); return { x: el.x, y: el.y, w: m.w, h: m.h }; }
    case 'leyenda': { const m = medidaLeyenda(el); return { x: el.x, y: el.y, w: m.w, h: m.h }; }
    case 'tabla': { const m = medidaTabla(el); return { x: el.x, y: el.y, w: m.w, h: m.h }; }
    default: return { x: 0, y: 0, w: 0, h: 0 };
  }
}

// Escala (× f, desde el origen) y corre (dx, dy) un elemento con sus tamaños: para encajar todo el dibujo sobre una imagen
export function transformar(el, f, dx = 0, dy = 0) {
  const X = x => x * f + dx; const Y = y => y * f + dy; const P = ([x, y]) => [X(x), Y(y)];
  const off = o => (o ? [o[0] * f, o[1] * f] : o);
  const offs = o => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, off(v)])) : o);
  const r = { ...el };
  if (el.grosor) r.grosor = el.grosor * f;
  if (el.tam) r.tam = el.tam * f;
  if (el.desfase) r.desfase = off(el.desfase);
  if (el.desfases) r.desfases = offs(el.desfases);
  switch (el.tipo) {
    case 'linea': case 'flecha': case 'cota': return { ...r, x1: X(el.x1), y1: Y(el.y1), x2: X(el.x2), y2: Y(el.y2) };
    case 'trazo': case 'polilinea': return { ...r, puntos: el.puntos.map(P) };
    case 'rect': case 'elipse': return { ...r, x: X(el.x), y: Y(el.y), w: el.w * f, h: el.h * f };
    case 'simbolo': return { ...r, x: X(el.x), y: Y(el.y), escala: el.escala * f };
    case 'etiqueta': return { ...r, x: X(el.x), y: Y(el.y), tx: X(el.tx), ty: Y(el.ty) };
    default: return { ...r, x: X(el.x), y: Y(el.y) };
  }
}

// Gira un elemento `grados` alrededor de (cx, cy) para encajar todo el dibujo sobre una imagen. Las distancias no
// cambian. Los símbolos, textos y cuadros giran su lugar pero se quedan derechos (se siguen leyendo); la etiqueta se
// mueve junto con su punto, sin cambiar de lado.
export function girar(el, grados, cx, cy) {
  const a = (grados * Math.PI) / 180; const cos = Math.cos(a); const sin = Math.sin(a);
  const R = ([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
  const correr = (x, y) => { const [nx, ny] = R([x, y]); return [nx - x, ny - y]; };
  switch (el.tipo) {
    case 'linea': case 'flecha': case 'cota': { const [x1, y1] = R([el.x1, el.y1]); const [x2, y2] = R([el.x2, el.y2]); return { ...el, x1, y1, x2, y2 }; }
    case 'trazo': case 'polilinea': return { ...el, puntos: el.puntos.map(R) };
    case 'simbolo': { const s = 30 * el.escala; const [dx, dy] = correr(el.x + s, el.y + s); return { ...el, x: el.x + dx, y: el.y + dy }; }
    case 'etiqueta': { const [dx, dy] = correr(el.tx, el.ty); return { ...el, x: el.x + dx, y: el.y + dy, tx: el.tx + dx, ty: el.ty + dy }; }
    default: { const b = caja(el); const [dx, dy] = correr(b.x + b.w / 2, b.y + b.h / 2); return mover(el, dx, dy); }
  }
}

// Mueve un elemento dx, dy (la etiqueta mueve su cuadro; la punta de la línea guía se queda en el punto)
export function mover(el, dx, dy) {
  switch (el.tipo) {
    case 'linea': case 'flecha': case 'cota': return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case 'trazo': case 'polilinea': return { ...el, puntos: el.puntos.map(([x, y]) => [x + dx, y + dy]) };
    default: return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

// Punto del borde del cuadro desde donde sale la línea guía de la etiqueta hacia su punto
function salidaEtiqueta(el, m) {
  const cx = el.x + m.w / 2; const cy = el.y + m.h / 2;
  const dx = el.tx - cx; const dy = el.ty - cy;
  if (!dx && !dy) return [cx, cy];
  const k = Math.min(Math.abs((m.w / 2) / (dx || 1e-9)), Math.abs((m.h / 2) / (dy || 1e-9)));
  return [cx + dx * k, cy + dy * k];
}
// Siguiente número con el prefijo (P1, P2… o W1, W2…)
export function siguienteEtiqueta(elementos, prefijo = 'P') {
  const p = String(prefijo || '').trim();
  if (!p) return 'Texto';
  const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)', 'i');
  const n = Math.max(0, ...elementos.filter(e => e.tipo === 'etiqueta').map(e => Number(String(e.texto || '').match(re)?.[1] || 0)));
  return `${p}${n + 1}`;
}
export const colorTramo = e => TIPOS_TRAMO[e.tramo]?.color || e.color;
// Colores de los tramos dibujados (leyenda manual de dibujos anteriores)
export const coloresTramos = elementos => [...new Set(elementos.filter(e => e.tipo === 'polilinea').map(colorTramo))];

// Recuadro blanco redondeado con un texto centrado en (cx, cy): metros de tramos y cotas
// Chip que se puede arrastrar (metros de un vano o de una cota): `off` lo corre de su lugar; si se aleja, una guía lo une
// texto: una línea o [principal, secundaria] (la secundaria más chica). base: dónde va sin moverlo (por defecto cx, cy)
function chipMovible(k, cx, cy, off, texto, tam, color, base = null) {
  const [dx, dy] = off || [0, 0]; const [bx, by] = base || [cx, cy];
  const px = bx + dx; const py = by + dy;
  const guia = Math.hypot(px - cx, py - cy) > tam * 2.4 ? `<line x1="${r1(cx)}" y1="${r1(cy)}" x2="${r1(px)}" y2="${r1(py)}" stroke="${color}" stroke-width="${r1(Math.max(1, tam * 0.09))}" stroke-dasharray="${r1(tam * 0.3)} ${r1(tam * 0.2)}"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(tam * 0.18)}" fill="${color}"/>` : '';
  const [l1, l2] = Array.isArray(texto) ? texto : [texto, ''];
  return `${guia}<g data-chip="${k}">${l2 ? chipDoble(px, py, l1, l2, tam, color) : chipTexto(px, py, l1, tam, color)}</g>`;
}
export const medidaChip = (l1, l2, tam) => ({ w: Math.max(String(l1).length * tam * 0.6, String(l2 || '').length * tam * 0.84 * 0.6) + tam, h: l2 ? tam * 1.3 + tam * 0.84 * 1.2 : tam * 1.5 });
function chipDoble(cx, cy, l1, l2, tam, color) {
  const { w, h } = medidaChip(l1, l2, tam); const t2 = tam * 0.84;
  return `<rect x="${r1(cx - w / 2)}" y="${r1(cy - h / 2)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(tam * 0.55)}" fill="#ffffff" stroke="${color}" stroke-width="${r1(Math.max(1, tam * 0.12))}"/>`
    + `<text x="${r1(cx)}" y="${r1(cy - h / 2 + tam * 1.05)}" text-anchor="middle" font-size="${r1(tam)}" font-weight="800" font-family="${FUENTE}" fill="${NEGRO}">${esc(l1)}</text>`
    + `<text x="${r1(cx)}" y="${r1(cy - h / 2 + tam * 1.3 + t2 * 0.95)}" text-anchor="middle" font-size="${r1(t2)}" font-weight="600" font-family="${FUENTE}" fill="#334155">${esc(l2)}</text>`;
}
function chipTexto(cx, cy, texto, tam, color) {
  const w = String(texto).length * tam * 0.6 + tam * 1; const h = tam * 1.5;
  return `<rect x="${r1(cx - w / 2)}" y="${r1(cy - h / 2)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(h / 2)}" fill="#ffffff" stroke="${color}" stroke-width="${r1(Math.max(1, tam * 0.12))}"/><text x="${r1(cx)}" y="${r1(cy + tam * 0.36)}" text-anchor="middle" font-size="${r1(tam)}" font-weight="700" font-family="${FUENTE}" fill="${NEGRO}">${esc(texto)}</text>`;
}

// Trazos de un tramo (para el plano y para la simbología)
function trazosTramo(d, color, ancho, dash) {
  const guiones = dash ? ` stroke-dasharray="${dash.split(' ').map(v => r1(Number(v) * ancho * 2.2)).join(' ')}"` : '';
  return `<path d="${d}" stroke="#ffffff" stroke-opacity="0.92" stroke-width="${r1(ancho + Math.max(3, ancho * 0.75))}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${color}" stroke-width="${r1(ancho)}" fill="none" stroke-linecap="round" stroke-linejoin="round"${guiones}/>`;
}

// SVG de un elemento. sel: tiradores de edición; ui: tamaño de tiradores; escala y distancias: metros por vano
// ver: qué datos técnicos salen en el plano (calibre de los vanos, altura y estructuras de los postes)
// datoEn(x, y): datos del poste en ese punto (para la etiqueta que apunta a él); conEtiqueta(x, y): hay una etiqueta ahí
export function svgElemento(el, { sel = false, ui = 1, escala = null, distancias = false, ver = {}, datoEn = null, refEn = null, conEtiqueta = null, radioEn = null, pantalla = false } = {}) {
  const st = `stroke="${el.color}" stroke-width="${el.grosor || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const id = `data-id="${el.id}"`;
  let s = '';
  switch (el.tipo) {
    case 'linea': case 'flecha': {
      const marca = el.tipo === 'flecha' ? ` marker-end="url(#punta-${el.color.slice(1)})"` : '';
      s = `<g ${id}><line x1="${r1(el.x1)}" y1="${r1(el.y1)}" x2="${r1(el.x2)}" y2="${r1(el.y2)}" stroke="transparent" stroke-width="${Math.max(18, el.grosor * 3)}"/><line x1="${r1(el.x1)}" y1="${r1(el.y1)}" x2="${r1(el.x2)}" y2="${r1(el.y2)}" ${st}${marca}/></g>`;
      break;
    }
    case 'rect': { const b = caja(el); s = `<rect ${id} x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" ${st} pointer-events="all" fill-opacity="0"/>`; break; }
    case 'elipse': { const b = caja(el); s = `<ellipse ${id} cx="${r1(b.x + b.w / 2)}" cy="${r1(b.y + b.h / 2)}" rx="${r1(b.w / 2)}" ry="${r1(b.h / 2)}" ${st} pointer-events="all" fill-opacity="0"/>`; break; }
    case 'trazo': {
      const d = el.puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ');
      s = `<g ${id}><path d="${d}" stroke="transparent" stroke-width="${Math.max(18, el.grosor * 3)}" fill="none"/><path d="${d}" ${st}/></g>`;
      break;
    }
    case 'polilinea': {
      // Tramo de red: estilo según su tipo, con borde blanco para leerse sobre el mapa; metros por vano con escala
      const tp = TIPOS_TRAMO[el.tramo] || null;
      const color = el.colorRed || (tp ? tp.color : el.color); const ancho = el.grosor * (tp ? tp.ancho : 1); // colorRed: otra red del mismo tipo
      const d = el.puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ');
      let chips = '';
      if (distancias || (ver.calibre !== false && (el.conductor || el.calibres)) || (ver.acometidas !== false && el.acometidas)) {
        // Metros de cada vano: los escritos a mano o, con escala, los medidos
        for (let i = 1; i < el.puntos.length; i++) {
          const [x0, y0] = el.puntos[i - 1]; const [x1, y1] = el.puntos[i];
          const m = distancias ? metrosVano(el, i, escala) : null;
          // Conductor que se cambia en la propuesta: "#4 ACSR → #2 Tpx"
          const cambio = el.accion === 'reemplazar' && el.reemplazo?.conductor ? textoConductor(el.reemplazo.conductor) : '';
          const cond = ver.calibre !== false ? [textoConductor(conductorVano(el, i)), cambio].filter(Boolean).join(' → ') : '';
          const acom = ver.acometidas !== false ? textoAcometidas(el.acometidas?.[i]) : '';
          // Metros arriba (grande); conductor y acometidas debajo (más chico)
          const detalle = [cond, acom].filter(Boolean).join(' · ');
          const texto = m !== null ? [fmtMetros(m), detalle] : [detalle, ''];
          const largo = Math.hypot(x1 - x0, y1 - y0);
          if (!texto[0] || largo < ancho * 10) continue;
          // Al lado de la línea (no encima): abajo en los vanos acostados, a la izquierda en los parados
          const tam = Math.max(14, ancho * 2.5); const mc = medidaChip(texto[0], texto[1], tam);
          let nx = -(y1 - y0) / largo; let ny = (x1 - x0) / largo;
          if (Math.abs(ny) >= 0.45 ? ny < 0 : nx > 0) { nx = -nx; ny = -ny; }
          const sep = Math.abs(ny) * mc.h / 2 + Math.abs(nx) * mc.w / 2 + ancho * 0.8 + tam * 0.25;
          const mx = (x0 + x1) / 2; const my = (y0 + y1) / 2;
          chips += chipMovible(i, mx, my, el.desfases?.[i], texto, tam, color, [mx + nx * sep, my + ny * sep]);
        }
      }
      s = `<g ${id}><path d="${d}" stroke="transparent" stroke-width="${Math.max(18, ancho * 3)}" fill="none"/>${trazosTramo(d, color, ancho, tp?.dash)}${el.puntos.length === 1 ? `<circle cx="${r1(el.puntos[0][0])}" cy="${r1(el.puntos[0][1])}" r="${r1(ancho)}" fill="${color}"/>` : ''}${chips}</g>`;
      break;
    }
    case 'cota': {
      // Cota: línea con remates y la distancia al centro
      const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1); const lw = r1(Math.max(1.5, el.tam * 0.12)); const t = el.tam * 0.5;
      const nx = -Math.sin(ang) * t; const ny = Math.cos(ang) * t;
      const px = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
      const l = (x1, y1, x2, y2, w, c) => `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
      s = `<g ${id}>${l(el.x1, el.y1, el.x2, el.y2, 18, 'transparent')}${l(el.x1, el.y1, el.x2, el.y2, r1(lw * 3), '#ffffff')}${l(el.x1, el.y1, el.x2, el.y2, lw, NEGRO)}${l(el.x1 - nx, el.y1 - ny, el.x1 + nx, el.y1 + ny, lw, NEGRO)}${l(el.x2 - nx, el.y2 - ny, el.x2 + nx, el.y2 + ny, lw, NEGRO)}${chipMovible(0, (el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, el.desfase, escala ? fmtMetros(px * escala) : 'Sin escala', el.tam, NEGRO)}</g>`;
      break;
    }
    case 'simbolo': {
      const sim = SIMBOLOS[el.simbolo]; if (!sim) return '';
      const sw = 3 / el.escala;
      const dibujo = `<g transform="translate(${r1(el.x)} ${r1(el.y)}) scale(${el.escala}) rotate(${el.rot || 0} 30 30)" color="${el.color}" stroke="${el.color}" stroke-width="${r1(sw * (el.grosor || 3) / 3)}" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="60" height="60" fill="transparent" stroke="none"/>${sim.svg}</g>`;
      // Altura y estructuras del poste debajo de él (se arrastran como los metros)
      const centro = [el.x + 30 * el.escala, el.y + 30 * el.escala];
      const datos = conEtiqueta?.(...centro) ? '' : textoConCambio(el, { altura: ver.altura !== false, estructuras: ver.estructuras !== false }, pantalla, true).replace(/\n/g, ' · ').replace(/!!/g, '');
      // Por defecto arriba a la derecha del símbolo (lejos de los tramos que entran por los lados)
      const tam = Math.max(15, 27 * el.escala); const ancho = String(datos).length * tam * 0.6 + tam;
      const cx = el.x + 60 * el.escala + ancho / 2; const cy = el.y - tam * 0.4;
      s = datos ? `<g ${id}>${dibujo}${chipMovible(0, cx, cy, el.desfase, datos, tam, NEGRO)}</g>` : dibujo.replace('<g ', `<g ${id} `);
      break;
    }
    case 'etiqueta': {
      // La referencia del transformador del punto va junto al nombre: "P2: DS102277" (si la etiqueta no la dice ya)
      const ref = refEn?.(el.tx, el.ty) || '';
      if (ref && !String(el.texto || '').includes(ref)) { const ls = String(el.texto || '').split('\n'); ls[0] = `${ls[0]}: ${ref}`; el = { ...el, texto: ls.join('\n') }; }
      // Chip redondeado con línea guía hasta el punto
      const est = ESTILOS_ETIQUETA[el.estilo] || null;
      const fondo = est ? est.fondo : el.fondo || '#ffffff'; const tinta = est ? est.texto : NEGRO;
      const linea = est && fondo.toLowerCase() !== '#ffffff' && fondo.toLowerCase() !== '#facc15' ? fondo : NEGRO;
      // Si la etiqueta ya dice los kVA (p. ej. venida de un levantamiento antiguo), los datos no los repiten
      let datosPunto = datoEn?.(el.tx, el.ty) || '';
      if (/kva/i.test(el.texto || '')) datosPunto = datosPunto.split('\n').map(t => t.replace(/(^| · )(Trafo|Banco)[^·]*kVA/, '').replace(/^ · /, '')).filter(t => t && t !== '!!Falta referencia · ').join('\n');
      const m = medidaEtiqueta(el, datosPunto); const [sx, sy] = salidaEtiqueta(el, m);
      const lw = r1(Math.max(1.5, el.tam * 0.09));
      // Si apunta a un símbolo, la línea llega hasta su borde (sin el punto en la punta) para no taparlo
      const rs = radioEn?.(el.tx, el.ty) || 0; const L = Math.hypot(el.tx - sx, el.ty - sy);
      const ex = rs && L > rs ? el.tx - ((el.tx - sx) / L) * rs * 0.85 : el.tx; const ey = rs && L > rs ? el.ty - ((el.ty - sy) / L) * rs * 0.85 : el.ty;
      const guia = L > el.tam * 0.5 && L > rs
        ? `<line x1="${r1(sx)}" y1="${r1(sy)}" x2="${r1(ex)}" y2="${r1(ey)}" stroke="#ffffff" stroke-width="${r1(lw * 3.4)}" stroke-linecap="round"/><line x1="${r1(sx)}" y1="${r1(sy)}" x2="${r1(ex)}" y2="${r1(ey)}" stroke="${linea}" stroke-width="${r1(lw * 1.4)}" stroke-linecap="round"/>${rs ? '' : `<circle cx="${r1(el.tx)}" cy="${r1(el.ty)}" r="${r1(el.tam * 0.2)}" fill="${linea}" stroke="#ffffff" stroke-width="${lw}"/>`}` : '';
      const borde = fondo.toLowerCase() === '#ffffff' ? NEGRO : '#ffffff';
      const franja = m.sub ? `<rect x="${r1(el.x + lw)}" y="${r1(el.y + m.hNombre)}" width="${r1(m.w - lw * 2)}" height="${r1(m.h - m.hNombre - lw)}" rx="${r1(el.tam * 0.22)}" fill="#ffffff"/>${m.subs.map((t, i) => `<text x="${r1(el.x + m.w / 2)}" y="${r1(el.y + m.hNombre + m.ts * (1.02 + i * 1.2))}" text-anchor="middle" font-size="${r1(m.ts)}" font-weight="700" font-family="${FUENTE}" fill="${/^!!/.test(t) ? '#dc2626' : NEGRO}">${esc(t.replace(/^!!/, ''))}</text>`).join('')}` : '';
      s = `<g ${id}>${guia}<rect x="${r1(el.x)}" y="${r1(el.y)}" width="${r1(m.w)}" height="${r1(m.h)}" rx="${r1(el.tam * 0.32)}" fill="${fondo}" stroke="${m.sub && fondo.toLowerCase() !== '#ffffff' ? fondo : borde}" stroke-width="${r1(lw * 1.3)}" filter="url(#dib-sombra)"/>${m.lineas.map((l, i) => `<text x="${r1(el.x + m.w / 2)}" y="${r1(el.y + m.pad * 0.4 + el.tam * (i + 1) * 1.2 - el.tam * 0.25)}" text-anchor="middle" font-size="${el.tam}" font-weight="700" font-family="${FUENTE}" fill="${tinta}">${esc(l) || ' '}</text>`).join('')}${franja}</g>`;
      break;
    }
    case 'leyenda': {
      const m = medidaLeyenda(el); const lw = r1(Math.max(1.5, el.tam * 0.08));
      s = `<g ${id}><rect x="${r1(el.x)}" y="${r1(el.y)}" width="${r1(m.w)}" height="${r1(m.h)}" fill="${el.fondo || '#ffffff'}" stroke="${NEGRO}" stroke-width="${lw}"/>${(el.entradas || []).map((e, i) => {
        const cy = el.y + m.pad + m.alto * (i + 0.5);
        return `<line x1="${r1(el.x + m.pad)}" y1="${r1(cy)}" x2="${r1(el.x + m.pad + m.muestra)}" y2="${r1(cy)}" stroke="${e.color}" stroke-width="${r1(el.tam * 0.35)}" stroke-linecap="round"/><text x="${r1(el.x + m.pad * 2 + m.muestra)}" y="${r1(cy + el.tam * 0.36)}" font-size="${el.tam}" font-weight="700" font-family="${FUENTE}" fill="${NEGRO}">${esc(e.texto) || ' '}</text>`;
      }).join('')}</g>`;
      break;
    }
    case 'tabla': s = `<g ${id}>${svgTabla(el.x, el.y, el.tam, el.encabezado || [], el.filas || [])}</g>`; break;
    case 'texto': {
      const lineas = String(el.texto || '').split('\n');
      const borde = el.color.toLowerCase() === '#ffffff' ? '#0f172a' : '#ffffff';
      s = `<text ${id} x="${r1(el.x)}" y="${r1(el.y)}" fill="${el.color}" font-size="${el.tam}" font-weight="700" font-family="${FUENTE}" stroke="${borde}" stroke-width="${r1(el.tam / 9)}" paint-order="stroke" stroke-linejoin="round">${lineas.map((l, i) => `<tspan x="${r1(el.x)}" dy="${i ? r1(el.tam * 1.2) : 0}">${esc(l) || ' '}</tspan>`).join('')}</text>`;
      break;
    }
    default: return '';
  }
  if (!sel) return s;
  // Marca de selección y tiradores (ui: tamaño según la escala del lienzo en pantalla)
  // Se ve un punto chico, pero se toca en un círculo invisible del tamaño del dedo
  const b = caja(el); const m = 8 * ui; const rt = r1(14 * ui); const rv = r1(5 * ui);
  const tirador = (k, x, y, extra = '') => `<g data-tirador="${k}"><circle class="dib-toque" cx="${r1(x)}" cy="${r1(y)}" r="${rt}"/><circle class="dib-tirador${extra}" cx="${r1(x)}" cy="${r1(y)}" r="${rv}"/></g>`;
  let t = `<rect class="dib-sel" x="${r1(b.x - m)}" y="${r1(b.y - m)}" width="${r1(b.w + m * 2)}" height="${r1(b.h + m * 2)}"/>`;
  if (el.tipo === 'linea' || el.tipo === 'flecha' || el.tipo === 'cota') t = tirador('p1', el.x1, el.y1) + tirador('p2', el.x2, el.y2);
  else if (el.tipo === 'polilinea') t = el.puntos.map(([x, y], i) => tirador('v' + i, x, y)).join('');
  else if (el.tipo !== 'trazo') t += tirador('esquina', b.x + b.w + m, b.y + b.h + m);
  if (el.tipo === 'etiqueta') t += tirador('destino', el.tx, el.ty, ' dib-destino');
  return s + t;
}

// Tabla (manual o del cajetín): encabezado oscuro y filas alternadas
function svgTabla(x0, y0, tam, encabezado, filas) {
  const m = medidaTabla({ tam, encabezado, filas }); const lw = r1(Math.max(1, tam * 0.06));
  let out = '';
  [encabezado, ...filas].forEach((f, i) => {
    const y = y0 + i * m.alto; let x = x0;
    out += `<rect x="${r1(x0)}" y="${r1(y)}" width="${r1(m.w)}" height="${r1(m.alto)}" fill="${i === 0 ? '#0f2a43' : i % 2 ? '#ffffff' : '#eef4fb'}" stroke="#94a3b8" stroke-width="${lw}"/>`;
    m.anchos.forEach((a, c) => {
      out += `<text x="${r1(x + a / 2)}" y="${r1(y + m.alto / 2 + tam * 0.36)}" text-anchor="middle" font-size="${r1(tam)}" font-weight="${i === 0 ? 700 : 600}" font-family="${FUENTE}" fill="${i === 0 ? '#ffffff' : NEGRO}">${esc(f[c] ?? '')}</text>`;
      if (c) out += `<line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(y + m.alto)}" stroke="#94a3b8" stroke-width="${lw}"/>`;
      x += a;
    });
  });
  return out;
}

// Puntas de flecha (una por color usado) y sombra de las etiquetas
export function definiciones(elementos) {
  const colores = [...new Set(elementos.filter(e => e.tipo === 'flecha').map(e => e.color))];
  return `<defs><filter id="dib-sombra" x="-20%" y="-20%" width="140%" height="170%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#0f172a" flood-opacity="0.35"/></filter>${colores.map(c => `<marker id="punta-${c.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker>`).join('')}</defs>`;
}

export const tamano = d => (d.fondo ? { w: d.fondo.w, h: d.fondo.h } : LIENZO);

// ── Cajetín de la lámina (debajo del plano) ──
// Contenido: título y datos, simbología (solo lo usado), distancias (automáticas con escala o manuales), escala y norte
export function simbologiaUsada(elementos) {
  const out = [];
  // Una entrada por red: tipo, color propio y nombre (dos redes BT de distinto color salen por separado)
  const redes = [];
  elementos.filter(e => e.tipo === 'polilinea' && TIPOS_TRAMO[e.tramo]).forEach(e => {
    const it = { clase: 'tramo', clave: e.tramo, color: e.colorRed || TIPOS_TRAMO[e.tramo].color, nombre: nombreRed(e) };
    if (!redes.some(x => x.clave === it.clave && x.color === it.color && x.nombre === it.nombre)) redes.push(it);
  });
  out.push(...redes);
  const sims = [];
  elementos.filter(e => e.tipo === 'simbolo' && SIMBOLOS[e.simbolo]?.grupo === 'red').forEach(e => { if (!sims.some(x => x.simbolo === e.simbolo && x.color === e.color)) sims.push(e); });
  sims.forEach(e => out.push({ clase: 'simbolo', simbolo: e.simbolo, color: e.color, nombre: SIMBOLOS[e.simbolo].nombre }));
  // Solo los puntos (existente / proyectado); las notas y destacados no son simbología
  const estilos = [...new Set(elementos.filter(e => e.tipo === 'etiqueta' && ESTILOS_ETIQUETA[e.estilo]?.prefijo).map(e => e.estilo))];
  estilos.forEach(k => {
    const ej = elementos.find(e => e.tipo === 'etiqueta' && e.estilo === k);
    out.push({ clase: 'etiqueta', estilo: k, ejemplo: nombrePunto(ej?.texto).split(/[,;\s]/)[0] || ESTILOS_ETIQUETA[k].prefijo, nombre: ESTILOS_ETIQUETA[k].nombre }); // solo el nombre corto ("P3"), para que quepa
  });
  return out;
}
export function filasDistancias(d) {
  const l = d.lamina || {};
  if (l.distancias === 'manual') return (l.filas || []).map(f => [f[0] ?? '', f[1] ?? '']);
  return tablaDistancias(d.elementos, d.escala, 14 * Math.max(1, tamano(d).w / 1600)).map(f => [`${f.desde} – ${f.hasta}`, (Math.round(f.metros * 10) / 10).toFixed(1)]);
}
const totalesCajetin = d => (d.lamina?.distancias !== 'manual' ? totalesPorTipo(d.elementos, d.escala).map(t => [`Total ${t.nombre.charAt(0).toLowerCase()}${t.nombre.slice(1)}`, (Math.round(t.metros * 10) / 10).toFixed(1)]) : []);
// Acometidas de toda la lámina (por fase y diferencia) para el cajetín
export function filasAcometidas(d) {
  if (d.lamina?.verAcometidas === false) return [];
  const t = sumaAcometidas(d.elementos.filter(e => e.tipo === 'polilinea' && e.acometidas).flatMap(e => Object.values(e.acometidas)));
  if (!hayAcometidas(t)) return [];
  const b = balanceAcometidas(t);
  return [['120 fase A', String(t.a)], ['120 fase B', String(t.b)], ['240', String(t.d)], ['Diferencia A–B', b.mayor ? `${b.dif} (más en ${b.mayor})` : '0']];
}
export function altoCajetin(d) {
  const { w } = tamano(d); const k = w / 1600;
  const filasSimb = Math.ceil(simbologiaUsada(d.elementos).length / 2);
  const acom = filasAcometidas(d).length;
  const filasDist = filasDistancias(d).length + totalesCajetin(d).length + (acom ? acom + 2 : 0);
  return Math.round(k * Math.max(270, 100 + Math.max(filasSimb * 42, (filasDist + 1) * 28)));
}

function svgCajetin(d, y0) {
  const { w } = tamano(d); const k = w / 1600; const H = altoCajetin(d);
  const l = d.lamina || {};
  const pad = 24 * k; const f = 18.5 * k; // letras del cajetín a buen tamaño para leerse impresas o en Word
  const col = [0, 0.3, 0.64, 0.86, 1].map(p => p * w);
  let s = `<rect x="0" y="${r1(y0)}" width="${r1(w)}" height="${r1(H)}" fill="#ffffff"/><rect x="0" y="${r1(y0)}" width="${r1(w)}" height="${r1(5 * k)}" fill="#0f2a43"/>`;
  col.slice(1, -1).forEach(x => { s += `<line x1="${r1(x)}" y1="${r1(y0 + 18 * k)}" x2="${r1(x)}" y2="${r1(y0 + H - 18 * k)}" stroke="#cbd5e1" stroke-width="${r1(1.5 * k)}"/>`; });
  const tit = (x, texto) => `<text x="${r1(x + pad)}" y="${r1(y0 + 38 * k)}" font-size="${r1(f * 0.78)}" font-weight="700" letter-spacing="${r1(1.5 * k)}" font-family="${FUENTE}" fill="#64748b">${esc(texto)}</text>`;
  // 1. Título y datos
  s += `<text x="${r1(pad)}" y="${r1(y0 + 58 * k)}" font-size="${r1(f * 1.75)}" font-weight="800" font-family="${FUENTE}" fill="#0f2a43">${esc((l.titulo || 'Plano de red').toUpperCase())}</text>`;
  if (l.subtitulo) s += `<text x="${r1(pad)}" y="${r1(y0 + 88 * k)}" font-size="${r1(f * 1.05)}" font-weight="600" font-family="${FUENTE}" fill="#334155">${esc(l.subtitulo)}</text>`;
  [['Proyecto / WO', l.proyecto], ['Fecha', l.fecha], ['Elaboró', l.elaboro]].forEach(([e, v], i) => {
    const y = y0 + (124 + i * 42) * k;
    s += `<text x="${r1(pad)}" y="${r1(y)}" font-size="${r1(f * 0.75)}" font-weight="700" letter-spacing="${r1(1 * k)}" font-family="${FUENTE}" fill="#64748b">${esc(e.toUpperCase())}</text><text x="${r1(pad)}" y="${r1(y + 21 * k)}" font-size="${r1(f)}" font-weight="700" font-family="${FUENTE}" fill="${NEGRO}">${esc(v || '—')}</text>`;
  });
  // 2. Simbología a dos columnas
  s += tit(col[1], 'SIMBOLOGÍA');
  const simb = simbologiaUsada(d.elementos); const anchoCol = (col[2] - col[1] - pad * 2) / 2;
  simb.forEach((it, i) => {
    const x = col[1] + pad + (i % 2) * anchoCol; const cy = y0 + (70 + Math.floor(i / 2) * 42) * k;
    if (it.clase === 'tramo') {
      const tp = TIPOS_TRAMO[it.clave];
      s += trazosTramo(`M${r1(x)} ${r1(cy)} L${r1(x + 44 * k)} ${r1(cy)}`, it.color || tp.color, 6 * k * tp.ancho, tp.dash);
    } else if (it.clase === 'simbolo') {
      const e = 0.5 * k;
      s += `<g transform="translate(${r1(x + 7 * k)} ${r1(cy - 15 * k)}) scale(${r1(e * 1000) / 1000})" color="${it.color}" stroke="${it.color}" stroke-width="3" fill="none">${SIMBOLOS[it.simbolo].svg}</g>`;
    } else {
      const est = ESTILOS_ETIQUETA[it.estilo]; const tw = Math.max(2, String(it.ejemplo).length) * f * 0.62 + 12 * k;
      s += `<rect x="${r1(x + 22 * k - tw / 2)}" y="${r1(cy - 11 * k)}" width="${r1(tw)}" height="${r1(22 * k)}" rx="${r1(6 * k)}" fill="${est.fondo}" stroke="${est.fondo === '#ffffff' ? NEGRO : '#ffffff'}" stroke-width="${r1(1.2 * k)}"/><text x="${r1(x + 22 * k)}" y="${r1(cy + 5 * k)}" text-anchor="middle" font-size="${r1(f * 0.85)}" font-weight="700" font-family="${FUENTE}" fill="${est.texto}">${esc(it.ejemplo)}</text>`;
    }
    s += `<text x="${r1(x + 56 * k)}" y="${r1(cy + 5 * k)}" font-size="${r1(f * 0.9)}" font-weight="600" font-family="${FUENTE}" fill="${NEGRO}">${esc(it.nombre)}</text>`;
  });
  if (!simb.length) s += `<text x="${r1(col[1] + pad)}" y="${r1(y0 + 66 * k)}" font-size="${r1(f * 0.9)}" font-family="${FUENTE}" fill="#94a3b8">Se llena sola con los tramos y símbolos de red</text>`;
  // 3. Distancias
  s += tit(col[2], 'DISTANCIAS');
  const tabla = [...filasDistancias(d), ...totalesCajetin(d)];
  if (tabla.length) {
    const tam = 16 * k;
    const mt = medidaTabla({ tam, encabezado: ['Tramo', 'Metros'], filas: tabla });
    const esc2 = Math.min(1, (col[3] - col[2] - pad * 2) / mt.w);
    s += `<g transform="translate(${r1(col[2] + pad)} ${r1(y0 + 54 * k)}) scale(${r1(esc2 * 1000) / 1000})">${svgTabla(0, 0, tam, ['Tramo', 'Metros'], tabla)}</g>`;
  }
  // Acometidas (debajo de las distancias)
  const acom = filasAcometidas(d);
  if (acom.length) {
    const tam = 16 * k; const mt0 = tabla.length ? medidaTabla({ tam, encabezado: ['Tramo', 'Metros'], filas: tabla }) : null;
    const yA = y0 + 54 * k + (mt0 ? (tabla.length + 1) * mt0.alto * Math.min(1, (col[3] - col[2] - pad * 2) / mt0.w) + 10 * k : 0);
    const ma = medidaTabla({ tam, encabezado: ['Acometidas', 'Cant.'], filas: acom });
    const escA = Math.min(1, (col[3] - col[2] - pad * 2) / ma.w);
    s += `<g transform="translate(${r1(col[2] + pad)} ${r1(yA)}) scale(${r1(escA * 1000) / 1000})">${svgTabla(0, 0, tam, ['Acometidas', 'Cant.'], acom)}</g>`;
  }
  if (!tabla.length && !acom.length) {
    s += `<text x="${r1(col[2] + pad)}" y="${r1(y0 + 66 * k)}" font-size="${r1(f * 0.85)}" font-family="${FUENTE}" fill="#94a3b8">${d.escala || d.elementos.some(e => e.metros && Object.keys(e.metros).length) ? 'Etiqueta los puntos sobre los tramos' : 'Escribe los metros de los vanos o calibra'}</text>`;
  }
  // 4. Escala gráfica y norte
  s += tit(col[3], 'ESCALA');
  const anchoEsc = col[4] - col[3] - pad * 2;
  const largo = largoEscala(d.escala, anchoEsc);
  if (largo) {
    const px = largo / d.escala; const x = col[3] + pad; const y = y0 + 64 * k; const hb = 9 * k;
    for (let i = 0; i < 4; i++) s += `<rect x="${r1(x + (px / 4) * i)}" y="${r1(y)}" width="${r1(px / 4)}" height="${r1(hb)}" fill="${i % 2 ? '#ffffff' : '#0f2a43'}" stroke="#0f2a43" stroke-width="${r1(1.2 * k)}"/>`;
    [[0, '0'], [px / 2, String(largo / 2)], [px, `${largo} m`]].forEach(([dx, t]) => { s += `<text x="${r1(x + dx)}" y="${r1(y + hb + 17 * k)}" text-anchor="middle" font-size="${r1(f * 0.8)}" font-weight="700" font-family="${FUENTE}" fill="${NEGRO}">${esc(t)}</text>`; });
  } else s += `<text x="${r1(col[3] + pad)}" y="${r1(y0 + 66 * k)}" font-size="${r1(f * 0.85)}" font-family="${FUENTE}" fill="#94a3b8">Sin calibrar</text>`;
  if (l.norte !== false) {
    const cx = col[3] + (col[4] - col[3]) / 2; const cy = y0 + H - 62 * k; const r = 26 * k;
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="#ffffff" stroke="#cbd5e1" stroke-width="${r1(1.5 * k)}"/><path d="M${r1(cx)} ${r1(cy - r * 0.8)} L${r1(cx + r * 0.42)} ${r1(cy + r * 0.55)} L${r1(cx)} ${r1(cy + r * 0.25)} L${r1(cx - r * 0.42)} ${r1(cy + r * 0.55)} Z" fill="#0f2a43"/><text x="${r1(cx)}" y="${r1(cy - r - 6 * k)}" text-anchor="middle" font-size="${r1(f * 1.05)}" font-weight="800" font-family="${FUENTE}" fill="#0f2a43">N</text>`;
  }
  return s;
}

// Datos del poste con lo que se cambia en la propuesta: "35' · RS3 → 40' · TS3" (y los kVA de un transformador)
// Un renglón por dato: poste (altura y estructuras), transformador (referencia eléctrica y kVA) y nota.
// pantalla: en el editor, a un transformador existente sin referencia se le avisa "Falta referencia" (en rojo)
const ES_TRAFO = ['trafo', 'trafo_nuevo', 'banco'];
const textoKva = t => { const k = (t || []).filter(Boolean); return !k.length ? '' : k.length === 1 ? `Trafo ${k[0]} kVA` : `Banco ${k.every(x => x === k[0]) ? `${k.length} × ${k[0]}` : k.join(' + ')} kVA`; };
export const pideReferencia = el => ES_TRAFO.includes(el?.simbolo) && el.simbolo !== 'trafo_nuevo' && el.accion !== 'instalar';
// La referencia va junto al nombre del punto ("P2: DS102277"); aquí, los kVA. conRef: sin etiqueta, va al inicio
function textoTrafo(el, pantalla, conRef) {
  if (!ES_TRAFO.includes(el.simbolo)) return '';
  const ref = String(el.referencia || '').trim();
  const kva = el.accion === 'reemplazar' && el.reemplazo?.trafos ? '' : textoKva(el.trafos); // el cambio de kVA ya va en el renglón del poste
  if (!ref && pantalla && pideReferencia(el)) return `!!Falta referencia${kva ? ` · ${kva}` : ''}`;
  return [conRef ? ref : '', kva].filter(Boolean).join(' · ');
}
function textoConCambio(el, ver, pantalla = false, conRef = false) {
  const nota = String(el.nota || '').trim();
  return [textoConCambioPoste(el, ver), textoTrafo(el, pantalla, conRef), nota].filter(Boolean).join('\n');
}
// Referencia del transformador de un punto (para ponerla junto al nombre en su etiqueta)
export const referenciaDe = el => (ES_TRAFO.includes(el?.simbolo) ? String(el.referencia || '').trim() : '');
function textoConCambioPoste(el, ver) {
  const hoy = textoPoste(el, ver); const r = el.accion === 'reemplazar' ? el.reemplazo : null;
  const kva = t => ((t || []).filter(Boolean).length ? `${t.filter(Boolean).join(' + ')} kVA` : '');
  if (!r) return hoy;
  const partes = [];
  if (r.altura !== undefined || r.estructuras) { const nuevo = textoPoste({ ...el, ...(r.altura !== undefined ? { altura: r.altura } : {}), ...(r.estructuras ? { estructuras: r.estructuras } : {}) }, ver); partes.push(nuevo !== hoy ? `${hoy || '—'} → ${nuevo}` : hoy); } else if (hoy) partes.push(hoy);
  if (r.trafos) partes.push(`${kva(el.trafos) || '—'} → ${kva(r.trafos)}`);
  return partes.filter(Boolean).join(' · ');
}
// Traslado en la propuesta: flecha punteada desde el poste hasta donde queda, con un círculo en el lugar nuevo
function flechasTraslado(elementos, w) {
  const k = w / 1600; const c = '#b45309';
  return elementos.filter(e => e.tipo === 'simbolo' && e.accion === 'trasladar' && Array.isArray(e.traslado)).map(e => {
    const ax = e.x + 30 * e.escala; const ay = e.y + 30 * e.escala; const [bx, by] = e.traslado;
    const L = Math.hypot(bx - ax, by - ay) || 1; const ux = (bx - ax) / L; const uy = (by - ay) / L; const r = 30 * e.escala * 0.75; const q = 9 * k;
    const ex = bx - ux * (r + 3 * k); const ey = by - uy * (r + 3 * k);
    return `<g pointer-events="none"><circle cx="${r1(bx)}" cy="${r1(by)}" r="${r1(r)}" fill="#ffffff" fill-opacity="0.7" stroke="${c}" stroke-width="${r1(4 * k)}" stroke-dasharray="${r1(7 * k)} ${r1(5 * k)}"/>`
      + (L > r * 2 ? `<line x1="${r1(ax + ux * r)}" y1="${r1(ay + uy * r)}" x2="${r1(ex - ux * q)}" y2="${r1(ey - uy * q)}" stroke="#ffffff" stroke-width="${r1(8 * k)}" stroke-linecap="round"/><line x1="${r1(ax + ux * r)}" y1="${r1(ay + uy * r)}" x2="${r1(ex - ux * q)}" y2="${r1(ey - uy * q)}" stroke="${c}" stroke-width="${r1(4 * k)}" stroke-dasharray="${r1(10 * k)} ${r1(7 * k)}"/><path d="M${r1(ex)} ${r1(ey)} L${r1(ex - ux * q * 1.8 - uy * q)} ${r1(ey - uy * q * 1.8 + ux * q)} L${r1(ex - ux * q * 1.8 + uy * q)} ${r1(ey - uy * q * 1.8 - ux * q)} Z" fill="${c}"/>` : '') + '</g>';
  }).join('');
}

// Partes del SVG de la lámina: plano (fondo y capa de elementos) y cajetín. pantalla/ui: tiradores para editar
export function svgLamina(d, { pantalla = false, ui = 1 } = {}) {
  const { w, h } = tamano(d);
  const conCajetin = d.lamina?.activa !== false;
  const H = h + (conCajetin ? altoCajetin(d) : 0);
  // La imagen de fondo puede ir más tenue para que la red se lea encima (fondoOpacidad, 0.2 a 1)
  const op = d.fondoOpacidad && d.fondoOpacidad < 1 ? ` opacity="${d.fondoOpacidad}"` : '';
  const fondo = d.fondo ? `<rect width="${w}" height="${h}" fill="#ffffff"/><image href="${d.fondo.src}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"${op}/>` : `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
  const l = d.lamina || {};
  const ver = { calibre: l.verCalibre !== false, altura: l.verAltura !== false, estructuras: l.verEstructuras !== false, acometidas: l.verAcometidas !== false };
  // Un poste con etiqueta lleva sus datos dentro de la etiqueta (un solo rótulo por poste, sin encimarse)
  const simbolosRed = d.elementos.filter(e => e.tipo === 'simbolo' && SIMBOLOS[e.simbolo]?.grupo === 'red');
  // Datos de cada punto (si hay poste y transformador en el mismo lugar, juntos en el mismo rótulo)
  const cerca = (a, x, y) => Math.hypot(a[0] - x, a[1] - y) < 2;
  const postes = [];
  simbolosRed.forEach(e => {
    const x = e.x + 30 * e.escala; const y = e.y + 30 * e.escala; const texto = textoConCambio(e, ver, pantalla);
    const p = postes.find(q => cerca([q.x, q.y], x, y));
    const ref = referenciaDe(e);
    if (p) { p.r = Math.max(p.r, 30 * e.escala); p.ref ||= ref; if (texto && !p.texto.includes(texto)) p.texto = [p.texto, texto].filter(Boolean).join('\n'); } else postes.push({ x, y, r: 30 * e.escala, texto, ref });
  });
  const puntas = d.elementos.filter(e => e.tipo === 'etiqueta').map(e => [e.tx, e.ty]);
  const opts = { escala: d.escala, distancias: l.distanciasEnTramos !== false, ver, pantalla,
    datoEn: (x, y) => postes.find(p => cerca([p.x, p.y], x, y))?.texto || '', refEn: (x, y) => postes.find(p => cerca([p.x, p.y], x, y))?.ref || '', conEtiqueta: (x, y) => puntas.some(p => cerca(p, x, y)),
    // La línea guía de una etiqueta termina en el borde del símbolo (no lo cruza ni lo tapa)
    radioEn: (x, y) => postes.find(p => cerca([p.x, p.y], x, y))?.r || 0 };
  // Orden de dibujo: primero las líneas, encima los postes, luego transformadores y demás símbolos, y arriba los textos
  // (así un transformador sobre el poste no queda tapado). Dentro de cada capa se respeta el orden ("Al frente").
  // El seleccionado va al final para que sus tiradores se puedan tocar.
  const capaDe = e => (['polilinea', 'trazo', 'linea', 'flecha', 'rect', 'elipse'].includes(e.tipo) ? 0 : e.tipo === 'simbolo' ? (['poste', 'poste_nuevo'].includes(e.simbolo) ? 1 : 2) : 3);
  const orden = d.elementos.map((e, i) => [e, i]).sort((a, b) => capaDe(a[0]) - capaDe(b[0]) || a[1] - b[1]).map(([e]) => e);
  if (pantalla && d.sel) { const k = orden.findIndex(e => e.id === d.sel); if (k >= 0) orden.push(...orden.splice(k, 1)); }
  const capa = definiciones(d.elementos) + orden.map(e => svgElemento(e, { ...opts, sel: pantalla && e.id === d.sel, ui })).join('') + flechasTraslado(d.elementos, w)
    + (pantalla && d.iman ? `<circle class="dib-iman" cx="${r1(d.iman[0])}" cy="${r1(d.iman[1])}" r="${r1(8 * ui)}"/>` : '')
    + (pantalla && d.calibracion ? `<line x1="${r1(d.calibracion.x1)}" y1="${r1(d.calibracion.y1)}" x2="${r1(d.calibracion.x2)}" y2="${r1(d.calibracion.y2)}" stroke="#f97316" stroke-width="${r1(4 * ui)}" stroke-dasharray="${r1(10 * ui)} ${r1(6 * ui)}"/>` : '');
  const marco = `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#0f2a43" stroke-width="${r1(3 * w / 1600)}"/>`;
  return { w, h, H, fondo, capa, cajetin: conCajetin ? `<g pointer-events="none">${svgCajetin(d, h)}${marco}</g>` : '' };
}
// k: tamaño en píxeles × k (para exportar con más resolución; el dibujo es vectorial)
export function svgExportable(d, k = 1) {
  const { w, H, fondo, capa, cajetin } = svgLamina(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * k)}" height="${Math.round(H * k)}" viewBox="0 0 ${w} ${H}"><rect width="${w}" height="${H}" fill="#ffffff"/>${fondo}${capa}${cajetin}</svg>`;
}

// Cambia el tamaño arrastrando un tirador (esquina, extremos de línea o cota, vértices de tramo, punto de etiqueta)
export function redimensionar(el, tirador, x, y) {
  if (tirador === 'p1') return { ...el, x1: x, y1: y };
  if (tirador === 'p2') return { ...el, x2: x, y2: y };
  if (tirador === 'destino') return { ...el, tx: x, ty: y };
  if (/^v\d+$/.test(tirador)) { const i = Number(tirador.slice(1)); return { ...el, puntos: el.puntos.map((p, k) => (k === i ? [x, y] : p)) }; }
  if (el.tipo === 'rect' || el.tipo === 'elipse') return { ...el, w: x - el.x, h: y - el.y };
  if (el.tipo === 'simbolo') return { ...el, escala: Math.max(0.2, Math.min(8, Math.max(x - el.x, y - el.y) / 60)) };
  if (el.tipo === 'texto') return { ...el, tam: Math.max(12, Math.min(200, Math.round((y - (el.y - el.tam)) / Math.max(1, String(el.texto || '').split('\n').length * 1.2)))) };
  if (el.tipo === 'etiqueta' || el.tipo === 'leyenda' || el.tipo === 'tabla') {
    const m = el.tipo === 'etiqueta' ? medidaEtiqueta(el) : el.tipo === 'leyenda' ? medidaLeyenda(el) : medidaTabla(el);
    const k = Math.max((x - el.x) / m.w, (y - el.y) / m.h);
    return { ...el, tam: Math.max(10, Math.min(160, Math.round(el.tam * k))) };
  }
  return el;
}

// Imagen reducida para que no pese demasiado (lado mayor hasta `max` px)
export const medidaReducida = (w, h, max = 2400) => { const k = Math.min(1, max / Math.max(w, h)); return { w: Math.round(w * k), h: Math.round(h * k) }; };

// Una fila por línea: "P1W1 50", "P1W1, 50" o con tabulador (pegado de Excel)
export function leerFilasTabla(texto) {
  return String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const partes = l.split(/\s*[\t;,|]\s*/);
    if (partes.length > 1) return partes;
    const m = l.match(/^(.*\S)\s+(\S+)$/);
    return m ? [m[1], m[2]] : [l, ''];
  });
}

export { longitud };
