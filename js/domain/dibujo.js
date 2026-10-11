// Herramienta Dibujar: una imagen de fondo y elementos encima (líneas, flechas, figuras, textos, trazo libre y
// símbolos eléctricos). Funciones puras: el estado es { fondo: { src, w, h } | null, elementos: [...] } y de aquí
// sale el SVG que se ve en pantalla y el que se exporta a PNG. Coordenadas en píxeles de la imagen.

export const LIENZO = { w: 1600, h: 1000 }; // sin imagen de fondo
export const COLORES = ['#dc2626', '#0f172a', '#2563eb', '#16a34a', '#f59e0b', '#ffffff'];
export const GROSORES = { fino: 2, medio: 4, grueso: 8 };
export const TAM_TEXTO = { chico: 22, mediano: 34, grande: 52 };

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = v => Math.round(v * 10) / 10;

// Símbolos eléctricos dibujados en una caja de 60×60 (trazo con el color del elemento)
export const SIMBOLOS = {
  transformador: { nombre: 'Transformador', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="23" r="11"/><circle cx="30" cy="37" r="11"/><line x1="30" y1="48" x2="30" y2="60"/>' },
  interruptor: { nombre: 'Interruptor', svg: '<line x1="30" y1="0" x2="30" y2="18"/><line x1="30" y1="42" x2="30" y2="60"/><line x1="30" y1="42" x2="44" y2="20"/><circle cx="30" cy="18" r="2.5"/><circle cx="30" cy="42" r="2.5"/>' },
  fusible: { nombre: 'Fusible', svg: '<line x1="30" y1="0" x2="30" y2="14"/><rect x="21" y="14" width="18" height="32" rx="2"/><line x1="30" y1="14" x2="30" y2="46"/><line x1="30" y1="46" x2="30" y2="60"/>' },
  medidor: { nombre: 'Medidor', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="30" r="18"/><text x="30" y="36" text-anchor="middle" font-size="15" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">kWh</text><line x1="30" y1="48" x2="30" y2="60"/>' },
  analizador: { nombre: 'Analizador', svg: '<rect x="8" y="10" width="44" height="40" rx="4"/><path d="M14 34 L20 26 L26 38 L32 22 L38 36 L46 28"/><line x1="30" y1="0" x2="30" y2="10"/>' },
  tablero: { nombre: 'Tablero', svg: '<rect x="10" y="6" width="40" height="48" rx="2"/><line x1="18" y1="18" x2="42" y2="18"/><line x1="18" y1="28" x2="42" y2="28"/><line x1="18" y1="38" x2="42" y2="38"/>' },
  tierra: { nombre: 'Tierra', svg: '<line x1="30" y1="0" x2="30" y2="30"/><line x1="14" y1="30" x2="46" y2="30"/><line x1="20" y1="38" x2="40" y2="38"/><line x1="26" y1="46" x2="34" y2="46"/>' },
  motor: { nombre: 'Motor', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="30" r="18"/><text x="30" y="37" text-anchor="middle" font-size="20" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">M</text>' },
  variador: { nombre: 'Variador (VFD)', svg: '<line x1="30" y1="0" x2="30" y2="12"/><rect x="8" y="12" width="44" height="36" rx="3"/><line x1="8" y1="48" x2="52" y2="12"/><text x="20" y="27" text-anchor="middle" font-size="11" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">~</text><text x="41" y="43" text-anchor="middle" font-size="11" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">=</text><line x1="30" y1="48" x2="30" y2="60"/>' },
  capacitor: { nombre: 'Capacitor', svg: '<line x1="30" y1="0" x2="30" y2="25"/><line x1="14" y1="25" x2="46" y2="25"/><line x1="14" y1="35" x2="46" y2="35"/><line x1="30" y1="35" x2="30" y2="60"/>' },
  dps: { nombre: 'DPS', svg: '<line x1="30" y1="0" x2="30" y2="14"/><rect x="20" y="14" width="20" height="28"/><path d="M33 18 L26 29 L34 29 L27 39"/><line x1="30" y1="42" x2="30" y2="50"/><line x1="20" y1="50" x2="40" y2="50"/><line x1="24" y1="55" x2="36" y2="55"/>' },
  carga: { nombre: 'Carga', svg: '<line x1="30" y1="0" x2="30" y2="24"/><path d="M16 24 L44 24 L30 50 Z"/>' },
  poste: { nombre: 'Poste', svg: '<line x1="30" y1="4" x2="30" y2="60"/><line x1="12" y1="14" x2="48" y2="14"/><circle cx="14" cy="10" r="3"/><circle cx="30" cy="10" r="3"/><circle cx="46" cy="10" r="3"/>' },
  generador: { nombre: 'Planta / generador', svg: '<line x1="30" y1="0" x2="30" y2="12"/><circle cx="30" cy="30" r="18"/><text x="30" y="37" text-anchor="middle" font-size="20" font-weight="700" stroke="none" fill="currentColor" font-family="Arial">G</text>' },
};

let contador = 0;
export const nuevoId = () => `e${Date.now().toString(36)}${(contador++).toString(36)}`;

// Caja que ocupa un elemento: { x, y, w, h }
export function caja(el) {
  switch (el.tipo) {
    case 'linea': case 'flecha': return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    case 'rect': case 'elipse': return { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) };
    case 'trazo': {
      const xs = el.puntos.map(p => p[0]); const ys = el.puntos.map(p => p[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    case 'simbolo': return { x: el.x, y: el.y, w: 60 * el.escala, h: 60 * el.escala };
    case 'texto': { const lineas = String(el.texto || '').split('\n'); return { x: el.x, y: el.y - el.tam, w: Math.max(...lineas.map(l => l.length)) * el.tam * 0.58, h: lineas.length * el.tam * 1.2 }; }
    default: return { x: 0, y: 0, w: 0, h: 0 };
  }
}

// Mueve un elemento dx, dy
export function mover(el, dx, dy) {
  switch (el.tipo) {
    case 'linea': case 'flecha': return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case 'trazo': return { ...el, puntos: el.puntos.map(([x, y]) => [x + dx, y + dy]) };
    default: return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

// SVG de un elemento. sel: dibuja también los tiradores de edición
export function svgElemento(el, { sel = false, ui = 1 } = {}) {
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
    case 'simbolo': {
      const sim = SIMBOLOS[el.simbolo]; if (!sim) return '';
      const sw = 3 / el.escala;
      s = `<g ${id} transform="translate(${r1(el.x)} ${r1(el.y)}) scale(${el.escala}) rotate(${el.rot || 0} 30 30)" color="${el.color}" stroke="${el.color}" stroke-width="${r1(sw * (el.grosor || 3) / 3)}" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="0" y="0" width="60" height="60" fill="transparent" stroke="none"/>${sim.svg}</g>`;
      break;
    }
    case 'texto': {
      const lineas = String(el.texto || '').split('\n');
      const borde = el.color.toLowerCase() === '#ffffff' ? '#0f172a' : '#ffffff';
      s = `<text ${id} x="${r1(el.x)}" y="${r1(el.y)}" fill="${el.color}" font-size="${el.tam}" font-weight="700" font-family="Arial, Helvetica, sans-serif" stroke="${borde}" stroke-width="${r1(el.tam / 9)}" paint-order="stroke" stroke-linejoin="round">${lineas.map((l, i) => `<tspan x="${r1(el.x)}" dy="${i ? r1(el.tam * 1.2) : 0}">${esc(l) || ' '}</tspan>`).join('')}</text>`;
      break;
    }
    default: return '';
  }
  if (!sel) return s;
  // ui: tamaño de la marca de selección y los tiradores según la escala del lienzo en pantalla
  const b = caja(el); const m = 8 * ui; const rt = r1(14 * ui);
  let t = `<rect class="dib-sel" x="${r1(b.x - m)}" y="${r1(b.y - m)}" width="${r1(b.w + m * 2)}" height="${r1(b.h + m * 2)}"/>`;
  if (el.tipo === 'linea' || el.tipo === 'flecha') t = `<circle class="dib-tirador" data-tirador="p1" cx="${r1(el.x1)}" cy="${r1(el.y1)}" r="${rt}"/><circle class="dib-tirador" data-tirador="p2" cx="${r1(el.x2)}" cy="${r1(el.y2)}" r="${rt}"/>`;
  else if (el.tipo !== 'trazo') t += `<circle class="dib-tirador" data-tirador="esquina" cx="${r1(b.x + b.w + m)}" cy="${r1(b.y + b.h + m)}" r="${rt}"/>`;
  return s + t;
}

// Puntas de flecha (una por color usado)
export function definiciones(elementos) {
  const colores = [...new Set(elementos.filter(e => e.tipo === 'flecha').map(e => e.color))];
  return `<defs>${colores.map(c => `<marker id="punta-${c.slice(1)}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker>`).join('')}</defs>`;
}

export const tamano = d => (d.fondo ? { w: d.fondo.w, h: d.fondo.h } : LIENZO);

// SVG completo para exportar (sin tiradores)
export function svgExportable(d) {
  const { w, h } = tamano(d);
  const fondo = d.fondo ? `<image href="${d.fondo.src}" x="0" y="0" width="${w}" height="${h}"/>` : `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${definiciones(d.elementos)}${fondo}${d.elementos.map(e => svgElemento(e)).join('')}</svg>`;
}

// Cambia el tamaño arrastrando el tirador (esquina inferior derecha o extremos de línea)
export function redimensionar(el, tirador, x, y) {
  if (tirador === 'p1') return { ...el, x1: x, y1: y };
  if (tirador === 'p2') return { ...el, x2: x, y2: y };
  if (el.tipo === 'rect' || el.tipo === 'elipse') return { ...el, w: x - el.x, h: y - el.y };
  if (el.tipo === 'simbolo') return { ...el, escala: Math.max(0.4, Math.min(8, Math.max(x - el.x, y - el.y) / 60)) };
  if (el.tipo === 'texto') return { ...el, tam: Math.max(12, Math.min(200, Math.round((y - (el.y - el.tam)) / Math.max(1, String(el.texto || '').split('\n').length * 1.2)))) };
  return el;
}

// Imagen reducida para que no pese demasiado (lado mayor hasta `max` px)
export const medidaReducida = (w, h, max = 2400) => { const k = Math.min(1, max / Math.max(w, h)); return { w: Math.round(w * k), h: Math.round(h * k) }; };
