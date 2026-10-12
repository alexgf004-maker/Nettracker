// Herramienta Dibujar: una imagen de fondo (captura del mapa, foto o plano) y elementos encima: tramos de red,
// simbología, etiquetas de punto, cotas, líneas, figuras, textos y trazo libre. Debajo va el cajetín de la lámina
// (título, simbología, distancias, escala y norte). Funciones puras: el estado es
// { fondo: { src, w, h } | null, elementos: [...], escala (m por px) | null, lamina: {...} } y de aquí sale el SVG
// que se ve en pantalla y el que se exporta a PNG. Coordenadas en píxeles de la imagen.
import { ESTILOS_ETIQUETA, fmtMetros, largoEscala, longitud, metrosVano, nombrePunto, tablaDistancias, TIPOS_TRAMO, totalesPorTipo } from './plano.js';

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
  banco: { grupo: 'red', nombre: 'Banco de transformadores', color: '#15803d', svg: '<path d="M2 50 L12 28 L22 50 Z M19 50 L30 24 L41 50 Z M38 50 L48 28 L58 50 Z" fill="currentColor" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><line x1="2" y1="52" x2="58" y2="52" stroke="currentColor" stroke-width="3"/>' },
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
export function medidaEtiqueta(el) {
  const lineas = String(el.texto || '').split('\n'); const pad = el.tam * 0.45;
  return { w: Math.max(1, ...lineas.map(l => l.length)) * el.tam * ANCHO_LETRA + pad * 2, h: lineas.length * el.tam * 1.2 + pad * 0.8, pad, lineas };
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
export function svgElemento(el, { sel = false, ui = 1, escala = null, distancias = false } = {}) {
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
      const color = tp ? tp.color : el.color; const ancho = el.grosor * (tp ? tp.ancho : 1);
      const d = el.puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ');
      let chips = '';
      if (distancias) {
        // Metros de cada vano: los escritos a mano o, con escala, los medidos
        for (let i = 1; i < el.puntos.length; i++) {
          const [x0, y0] = el.puntos[i - 1]; const [x1, y1] = el.puntos[i];
          const m = metrosVano(el, i, escala);
          if (m === null || Math.hypot(x1 - x0, y1 - y0) < ancho * 10) continue;
          chips += chipTexto((x0 + x1) / 2, (y0 + y1) / 2, fmtMetros(m), Math.max(11, ancho * 2.2), color);
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
      s = `<g ${id}>${l(el.x1, el.y1, el.x2, el.y2, 18, 'transparent')}${l(el.x1, el.y1, el.x2, el.y2, r1(lw * 3), '#ffffff')}${l(el.x1, el.y1, el.x2, el.y2, lw, NEGRO)}${l(el.x1 - nx, el.y1 - ny, el.x1 + nx, el.y1 + ny, lw, NEGRO)}${l(el.x2 - nx, el.y2 - ny, el.x2 + nx, el.y2 + ny, lw, NEGRO)}${chipTexto((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, escala ? fmtMetros(px * escala) : 'Sin escala', el.tam, NEGRO)}</g>`;
      break;
    }
    case 'simbolo': {
      const sim = SIMBOLOS[el.simbolo]; if (!sim) return '';
      const sw = 3 / el.escala;
      s = `<g ${id} transform="translate(${r1(el.x)} ${r1(el.y)}) scale(${el.escala}) rotate(${el.rot || 0} 30 30)" color="${el.color}" stroke="${el.color}" stroke-width="${r1(sw * (el.grosor || 3) / 3)}" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="60" height="60" fill="transparent" stroke="none"/>${sim.svg}</g>`;
      break;
    }
    case 'etiqueta': {
      // Chip redondeado con línea guía hasta el punto
      const est = ESTILOS_ETIQUETA[el.estilo] || null;
      const fondo = est ? est.fondo : el.fondo || '#ffffff'; const tinta = est ? est.texto : NEGRO;
      const linea = est && fondo.toLowerCase() !== '#ffffff' && fondo.toLowerCase() !== '#facc15' ? fondo : NEGRO;
      const m = medidaEtiqueta(el); const [sx, sy] = salidaEtiqueta(el, m);
      const lw = r1(Math.max(1.5, el.tam * 0.09));
      const guia = Math.hypot(el.tx - sx, el.ty - sy) > el.tam * 0.5
        ? `<line x1="${r1(sx)}" y1="${r1(sy)}" x2="${r1(el.tx)}" y2="${r1(el.ty)}" stroke="#ffffff" stroke-width="${r1(lw * 3.4)}" stroke-linecap="round"/><line x1="${r1(sx)}" y1="${r1(sy)}" x2="${r1(el.tx)}" y2="${r1(el.ty)}" stroke="${linea}" stroke-width="${r1(lw * 1.4)}" stroke-linecap="round"/><circle cx="${r1(el.tx)}" cy="${r1(el.ty)}" r="${r1(el.tam * 0.2)}" fill="${linea}" stroke="#ffffff" stroke-width="${lw}"/>` : '';
      const borde = fondo.toLowerCase() === '#ffffff' ? NEGRO : '#ffffff';
      s = `<g ${id}>${guia}<rect x="${r1(el.x)}" y="${r1(el.y)}" width="${r1(m.w)}" height="${r1(m.h)}" rx="${r1(el.tam * 0.32)}" fill="${fondo}" stroke="${borde}" stroke-width="${r1(lw * 1.3)}" filter="url(#dib-sombra)"/>${m.lineas.map((l, i) => `<text x="${r1(el.x + m.w / 2)}" y="${r1(el.y + m.pad * 0.4 + el.tam * (i + 1) * 1.2 - el.tam * 0.25)}" text-anchor="middle" font-size="${el.tam}" font-weight="700" font-family="${FUENTE}" fill="${tinta}">${esc(l) || ' '}</text>`).join('')}</g>`;
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
  const b = caja(el); const m = 8 * ui; const rt = r1(14 * ui);
  const tirador = (k, x, y, extra = '') => `<circle class="dib-tirador${extra}" data-tirador="${k}" cx="${r1(x)}" cy="${r1(y)}" r="${rt}"/>`;
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
  const tramos = [...new Set(elementos.filter(e => e.tipo === 'polilinea').map(e => e.tramo || ''))];
  tramos.forEach(k => { if (TIPOS_TRAMO[k]) out.push({ clase: 'tramo', clave: k, nombre: TIPOS_TRAMO[k].nombre }); });
  const sims = [];
  elementos.filter(e => e.tipo === 'simbolo' && SIMBOLOS[e.simbolo]?.grupo === 'red').forEach(e => { if (!sims.some(x => x.simbolo === e.simbolo && x.color === e.color)) sims.push(e); });
  sims.forEach(e => out.push({ clase: 'simbolo', simbolo: e.simbolo, color: e.color, nombre: SIMBOLOS[e.simbolo].nombre }));
  // Solo los puntos (existente / proyectado); las notas y destacados no son simbología
  const estilos = [...new Set(elementos.filter(e => e.tipo === 'etiqueta' && ESTILOS_ETIQUETA[e.estilo]?.prefijo).map(e => e.estilo))];
  estilos.forEach(k => {
    const ej = elementos.find(e => e.tipo === 'etiqueta' && e.estilo === k);
    out.push({ clase: 'etiqueta', estilo: k, ejemplo: nombrePunto(ej?.texto) || ESTILOS_ETIQUETA[k].prefijo, nombre: ESTILOS_ETIQUETA[k].nombre });
  });
  return out;
}
export function filasDistancias(d) {
  const l = d.lamina || {};
  if (l.distancias === 'manual') return (l.filas || []).map(f => [f[0] ?? '', f[1] ?? '']);
  return tablaDistancias(d.elementos, d.escala, 14 * Math.max(1, tamano(d).w / 1600)).map(f => [`${f.desde} – ${f.hasta}`, (Math.round(f.metros * 10) / 10).toFixed(1)]);
}
const totalesCajetin = d => (d.lamina?.distancias !== 'manual' ? totalesPorTipo(d.elementos, d.escala).map(t => [`Total ${t.nombre.charAt(0).toLowerCase()}${t.nombre.slice(1)}`, (Math.round(t.metros * 10) / 10).toFixed(1)]) : []);
export function altoCajetin(d) {
  const { w } = tamano(d); const k = w / 1600;
  const filasSimb = Math.ceil(simbologiaUsada(d.elementos).length / 2);
  const filasDist = filasDistancias(d).length + totalesCajetin(d).length;
  return Math.round(k * Math.max(230, 92 + Math.max(filasSimb * 34, (filasDist + 1) * 22)));
}

function svgCajetin(d, y0) {
  const { w } = tamano(d); const k = w / 1600; const H = altoCajetin(d);
  const l = d.lamina || {};
  const pad = 22 * k; const f = 15 * k;
  const col = [0, 0.3, 0.64, 0.86, 1].map(p => p * w);
  let s = `<rect x="0" y="${r1(y0)}" width="${r1(w)}" height="${r1(H)}" fill="#ffffff"/><rect x="0" y="${r1(y0)}" width="${r1(w)}" height="${r1(5 * k)}" fill="#0f2a43"/>`;
  col.slice(1, -1).forEach(x => { s += `<line x1="${r1(x)}" y1="${r1(y0 + 18 * k)}" x2="${r1(x)}" y2="${r1(y0 + H - 18 * k)}" stroke="#cbd5e1" stroke-width="${r1(1.5 * k)}"/>`; });
  const tit = (x, texto) => `<text x="${r1(x + pad)}" y="${r1(y0 + 36 * k)}" font-size="${r1(f * 0.82)}" font-weight="700" letter-spacing="${r1(1.5 * k)}" font-family="${FUENTE}" fill="#64748b">${esc(texto)}</text>`;
  // 1. Título y datos
  s += `<text x="${r1(pad)}" y="${r1(y0 + 52 * k)}" font-size="${r1(f * 1.9)}" font-weight="800" font-family="${FUENTE}" fill="#0f2a43">${esc((l.titulo || 'Plano de red').toUpperCase())}</text>`;
  if (l.subtitulo) s += `<text x="${r1(pad)}" y="${r1(y0 + 80 * k)}" font-size="${r1(f * 1.05)}" font-weight="600" font-family="${FUENTE}" fill="#334155">${esc(l.subtitulo)}</text>`;
  [['Proyecto / WO', l.proyecto], ['Fecha', l.fecha], ['Elaboró', l.elaboro]].forEach(([e, v], i) => {
    const y = y0 + (112 + i * 34) * k;
    s += `<text x="${r1(pad)}" y="${r1(y)}" font-size="${r1(f * 0.75)}" font-weight="700" letter-spacing="${r1(1 * k)}" font-family="${FUENTE}" fill="#64748b">${esc(e.toUpperCase())}</text><text x="${r1(pad)}" y="${r1(y + 17 * k)}" font-size="${r1(f)}" font-weight="700" font-family="${FUENTE}" fill="${NEGRO}">${esc(v || '—')}</text>`;
  });
  // 2. Simbología a dos columnas
  s += tit(col[1], 'SIMBOLOGÍA');
  const simb = simbologiaUsada(d.elementos); const anchoCol = (col[2] - col[1] - pad * 2) / 2;
  simb.forEach((it, i) => {
    const x = col[1] + pad + (i % 2) * anchoCol; const cy = y0 + (62 + Math.floor(i / 2) * 34) * k;
    if (it.clase === 'tramo') {
      const tp = TIPOS_TRAMO[it.clave];
      s += trazosTramo(`M${r1(x)} ${r1(cy)} L${r1(x + 44 * k)} ${r1(cy)}`, tp.color, 6 * k * tp.ancho, tp.dash);
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
    const tam = 12.5 * k;
    const mt = medidaTabla({ tam, encabezado: ['Tramo', 'Metros'], filas: tabla });
    const esc2 = Math.min(1, (col[3] - col[2] - pad * 2) / mt.w);
    s += `<g transform="translate(${r1(col[2] + pad)} ${r1(y0 + 50 * k)}) scale(${r1(esc2 * 1000) / 1000})">${svgTabla(0, 0, tam, ['Tramo', 'Metros'], tabla)}</g>`;
  } else {
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

// Partes del SVG de la lámina: plano (fondo y capa de elementos) y cajetín. pantalla/ui: tiradores para editar
export function svgLamina(d, { pantalla = false, ui = 1 } = {}) {
  const { w, h } = tamano(d);
  const conCajetin = d.lamina?.activa !== false;
  const H = h + (conCajetin ? altoCajetin(d) : 0);
  const fondo = d.fondo ? `<image href="${d.fondo.src}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"/>` : `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
  const opts = { escala: d.escala, distancias: d.lamina?.distanciasEnTramos !== false };
  const capa = definiciones(d.elementos) + d.elementos.map(e => svgElemento(e, { ...opts, sel: pantalla && e.id === d.sel, ui })).join('')
    + (pantalla && d.iman ? `<circle class="dib-iman" cx="${r1(d.iman[0])}" cy="${r1(d.iman[1])}" r="${r1(16 * ui)}"/>` : '')
    + (pantalla && d.calibracion ? `<line x1="${r1(d.calibracion.x1)}" y1="${r1(d.calibracion.y1)}" x2="${r1(d.calibracion.x2)}" y2="${r1(d.calibracion.y2)}" stroke="#f97316" stroke-width="${r1(4 * ui)}" stroke-dasharray="${r1(10 * ui)} ${r1(6 * ui)}"/>` : '');
  const marco = `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#0f2a43" stroke-width="${r1(3 * w / 1600)}"/>`;
  return { w, h, H, fondo, capa, cajetin: conCajetin ? `<g pointer-events="none">${svgCajetin(d, h)}${marco}</g>` : '' };
}
export function svgExportable(d) {
  const { w, H, fondo, capa, cajetin } = svgLamina(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}"><rect width="${w}" height="${H}" fill="#ffffff"/>${fondo}${capa}${cajetin}</svg>`;
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
