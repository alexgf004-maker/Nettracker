// Lámina de propuesta (pedido del equipo, estilo "informe moderno"): a partir del dibujo de Dibujar arma la lista de
// trabajos a ejecutar (numerados sobre el plano), las cantidades de obra y dos láminas en carta horizontal:
// 1 · situación actual contra propuesta y 2 · propuesta para ejecutar (plano, trabajos y cantidades).
// Qué se hace con cada elemento: su acción (instalar, reemplazar, retirar, trasladar). Los postes, transformadores y
// tramos proyectados ya son "instalar" y la red a retirar ya es "retirar"; a los demás se les pone en el panel.
// Los textos y cantidades de los trabajos se arman solos y se pueden corregir (lamina.trabajos) o agregar a mano
// (lamina.trabajosExtra). Funciones puras: devuelven SVG (vectorial, en unidades de 1650 × 1275 = carta a 150 ppp).
import { caja, SIMBOLOS, simbologiaUsada, svgLamina } from './dibujo.js';
import { metrosTramo, metrosVano, nombrePunto, TIPOS_TRAMO } from './plano.js';
import { conductorVano } from './red.js';

export const ACCIONES = {
  instalar: { nombre: 'Instalar', tinta: '#0e7490', fondo: '#cffafe' },
  reemplazar: { nombre: 'Reemplazar', tinta: '#4338ca', fondo: '#e0e7ff' },
  retirar: { nombre: 'Retirar', tinta: '#be123c', fondo: '#ffe4e6' },
  trasladar: { nombre: 'Trasladar', tinta: '#b45309', fondo: '#fef3c7' },
};
// Colores de la lámina de propuesta: lo existente en gris pizarra, lo nuevo en turquesa y lo que se retira en rojo
export const PALETA = { existente: '#334155', nuevo: '#0e7490', retirar: '#e11d48', fondo: '#f4f1ea' };
const NUEVOS = ['poste_nuevo', 'trafo_nuevo'];
const TRAMOS_NUEVOS = ['bt_nueva', 'mt_nueva'];
const FUENTE = 'Arial, Helvetica, sans-serif';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = v => Math.round(v * 10) / 10;
const fmt = (n, dec = 1) => (Math.round(n * 10 ** dec) / 10 ** dec).toLocaleString('es-SV', { minimumFractionDigits: 0, maximumFractionDigits: dec });

// Acción de un elemento en la propuesta (null: existente, sin cambio)
export function accionDe(el) {
  if (el.accion === 'existente') return null;
  if (el.accion && ACCIONES[el.accion]) return el.accion;
  if (el.tipo === 'simbolo' && NUEVOS.includes(el.simbolo)) return 'instalar';
  if (el.tipo === 'polilinea' && TRAMOS_NUEVOS.includes(el.tramo)) return 'instalar';
  if (el.tipo === 'polilinea' && el.tramo === 'retirar') return 'retirar';
  return null;
}
export const conAccion = el => (el.tipo === 'simbolo' && SIMBOLOS[el.simbolo]?.grupo === 'red') || el.tipo === 'polilinea';

const centro = el => [el.x + 30 * el.escala, el.y + 30 * el.escala];
// Nombre del punto (etiqueta que apunta a ese lugar): "P3"
function nombreEn(elementos, [x, y], tol) {
  const et = elementos.find(e => e.tipo === 'etiqueta' && Math.hypot(e.tx - x, e.ty - y) <= tol);
  return et ? nombrePunto(et.texto) : '';
}
const esPoste = k => k === 'poste' || k === 'poste_nuevo';
const esTrafo = k => k === 'trafo' || k === 'trafo_nuevo' || k === 'banco';
export const kvaTexto = trafos => {
  const t = (trafos || []).filter(Boolean); if (!t.length) return '';
  return t.length === 1 ? `${t[0]} kVA` : t.every(k => k === t[0]) ? `${t.length} × ${t[0]} kVA` : `${t.join(' + ')} kVA`;
};
// Conductor con su nombre completo: "#2 Triplex" (el del vano i; por defecto el primero)
const nombreConductor = c => [c?.calibre, c?.tipo].filter(Boolean).join(' ');
const conductorDe = (t, i = 1) => nombreConductor(conductorVano(t, i));

// Trabajo que sale de un elemento: { id, accion, texto, cantidad, ancla }
function trabajoDe(el, d, tol) {
  const accion = accionDe(el); if (!accion) return null;
  if (el.tipo === 'simbolo') {
    const k = el.simbolo; const pt = nombreEn(d.elementos, centro(el), tol);
    const datos = [el.altura ? `${el.altura}'` : '', (el.estructuras || []).length ? `con ${el.estructuras.join(' / ')}` : ''].filter(Boolean).join(' ');
    let texto;
    if (esPoste(k)) texto = `Poste ${datos}${pt ? ` (${pt})` : ''}`.replace(/\s+/g, ' ').trim();
    else if (esTrafo(k)) texto = `${k === 'banco' ? 'Banco de transformadores' : 'Transformador'}${kvaTexto(el.trafos) ? ` ${kvaTexto(el.trafos)}` : ''}${pt ? ` en ${pt}` : ''}`;
    else texto = `${SIMBOLOS[k]?.nombre.replace(/ (existente|proyectado)$/i, '') || 'Elemento'}${pt ? ` en ${pt}` : ''}`;
    if (el.detalleAccion) texto += `: ${el.detalleAccion}`;
    // Marca abajo a la derecha del símbolo (arriba suele ir su etiqueta)
    const [cx, cy] = centro(el); const s = 30 * el.escala;
    return { id: el.id, accion, texto, cantidad: '1 u', ancla: [cx + s * 1.45, cy + s * 1.45] };
  }
  // Tramo: entre los puntos de sus extremos, con el conductor y los metros
  const a = nombreEn(d.elementos, el.puntos[0], tol); const b = nombreEn(d.elementos, el.puntos[el.puntos.length - 1], tol);
  const tramo = el.tramo === 'acometida' ? 'Acometida' : /^mt/.test(el.tramo) ? 'Red MT' : el.tramo === 'retirar' ? 'Red' : 'Red BT';
  const cond = conductorDe(el);
  let texto = accion === 'retirar' ? `Conductor${cond ? ` ${cond}` : ''}` : `${tramo}${cond ? ` ${cond}` : ''}`;
  if (a && b) texto += `, ${a}–${b}`;
  if (el.detalleAccion) texto += `: ${el.detalleAccion}`;
  const m = metrosTramo(el, d.escala);
  // Marca junto al vano más largo, hacia afuera de la línea
  let mejor = 1; let largo = -1;
  for (let i = 1; i < el.puntos.length; i++) { const l = Math.hypot(el.puntos[i][0] - el.puntos[i - 1][0], el.puntos[i][1] - el.puntos[i - 1][1]); if (l > largo) { largo = l; mejor = i; } }
  const [x0, y0] = el.puntos[mejor - 1] || el.puntos[0]; const [x1, y1] = el.puntos[mejor] || el.puntos[0];
  const L = Math.hypot(x1 - x0, y1 - y0) || 1; const sep = 34 * tol / 12;
  let nx = -(y1 - y0) / L; let ny = (x1 - x0) / L; if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
  return { id: el.id, accion, texto, cantidad: m !== null ? `${fmt(m)} m` : el.tramo === 'acometida' ? '1 u' : '— m', metros: m, ancla: [(x0 + x1) / 2 + nx * sep, (y0 + y1) / 2 + ny * sep],
    tramo: { clave: `${accion}|${el.tramo}|${cond}|${el.detalleAccion || ''}`, a: el.puntos[0], b: el.puntos[el.puntos.length - 1], na: a, nb: b, largo, base: el.tramo === 'acometida' ? 'Acometida' : accion === 'retirar' ? 'Conductor' : tramo, cond, detalle: el.detalleAccion || '' } };
}
// Los tramos seguidos con el mismo trabajo (acción, tipo y conductor) salen como uno solo: "Red BT #2 Triplex, P1–P3"
function juntarTramos(lista, tol) {
  const out = []; const usados = new Set();
  const toca = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
  lista.forEach((t, i) => {
    if (usados.has(i)) return;
    if (!t.tramo) { out.push(t); return; }
    const grupo = [t]; usados.add(i);
    let crecio = true;
    while (crecio) {
      crecio = false;
      lista.forEach((u, j) => {
        if (usados.has(j) || !u.tramo || u.tramo.clave !== t.tramo.clave) return;
        if (grupo.some(g => toca(g.tramo.a, u.tramo.a) || toca(g.tramo.a, u.tramo.b) || toca(g.tramo.b, u.tramo.a) || toca(g.tramo.b, u.tramo.b))) { grupo.push(u); usados.add(j); crecio = true; }
      });
    }
    if (grupo.length === 1) { out.push(t); return; }
    // Extremos de la cadena: los que no tocan a otro tramo del grupo
    const puntas = grupo.flatMap(g => [[g.tramo.a, g.tramo.na], [g.tramo.b, g.tramo.nb]]).filter(([p], k, todos) => todos.filter(([q]) => toca(p, q)).length === 1);
    const nombres = puntas.map(([, n]) => n);
    const metros = grupo.every(g => g.metros !== null && g.metros !== undefined) ? grupo.reduce((a, g) => a + g.metros, 0) : null;
    const largo = grupo.reduce((m, g) => (g.tramo.largo > m.tramo.largo ? g : m), grupo[0]);
    let texto = `${t.tramo.base}${t.tramo.cond ? ` ${t.tramo.cond}` : ''}`;
    if (nombres.length === 2 && nombres.every(Boolean)) texto += `, ${nombres[0]}–${nombres[1]}`;
    if (t.tramo.detalle) texto += `: ${t.tramo.detalle}`;
    out.push({ ...t, texto, metros, cantidad: metros !== null ? `${fmt(metros)} m` : '— m', ancla: largo.ancla, ids: grupo.map(g => g.id) });
  });
  return out;
}

// Trabajos a ejecutar, numerados: los de los elementos (con las correcciones de la lámina) y luego los escritos a mano
export function trabajos(d) {
  const l = d.lamina || {}; const tol = 12 * Math.max(1, (d.fondo?.w || 1600) / 1600);
  const cambios = l.trabajos || {};
  const auto = juntarTramos(d.elementos.filter(conAccion).map(el => trabajoDe(el, d, tol)).filter(Boolean), tol)
    .filter(t => !cambios[t.id]?.oculto)
    .map(t => ({ ...t, auto: { texto: t.texto, cantidad: t.cantidad }, texto: cambios[t.id]?.texto || t.texto, cantidad: cambios[t.id]?.cantidad || t.cantidad }));
  const extra = (l.trabajosExtra || []).filter(t => String(t.texto || '').trim()).map((t, i) => ({ id: `extra${i}`, extra: i, accion: ACCIONES[t.accion] ? t.accion : 'instalar', texto: t.texto, cantidad: t.cantidad || '' }));
  return [...auto, ...extra].map((t, i) => ({ ...t, n: i + 1 }));
}
// Trabajos que se quitaron de la lista (para volver a ponerlos)
export function trabajosOcultos(d) {
  const tol = 12 * Math.max(1, (d.fondo?.w || 1600) / 1600); const cambios = d.lamina?.trabajos || {};
  return juntarTramos(d.elementos.filter(conAccion).map(el => trabajoDe(el, d, tol)).filter(Boolean), tol).filter(t => cambios[t.id]?.oculto);
}

// Cantidades de obra: postes por altura, estructuras, transformadores por kVA, conductor por calibre, retiros y traslados
export function cantidades(d) {
  const filas = new Map();
  const sumar = (k, ud, n) => { const x = filas.get(k) || { material: k, unidad: ud, cantidad: 0, incompleto: false }; if (n === null) x.incompleto = true; else x.cantidad += n; filas.set(k, x); };
  d.elementos.filter(conAccion).forEach(el => {
    const acc = accionDe(el); if (!acc) return;
    if (el.tipo === 'simbolo') {
      const k = el.simbolo;
      if (esPoste(k)) {
        if (acc === 'instalar' || acc === 'reemplazar') {
          sumar(el.altura ? `Poste de ${el.altura}'` : 'Poste (sin altura)', 'u', 1);
          (el.estructuras || []).forEach(c => sumar(`Estructura ${c}`, 'u', 1));
        }
        if (acc === 'retirar' || acc === 'reemplazar') sumar('Retiro de poste', 'u', 1);
        if (acc === 'trasladar') sumar('Traslado de poste', 'u', 1);
      } else if (esTrafo(k)) {
        const lista = (el.trafos || []).filter(Boolean);
        if (acc === 'instalar' || acc === 'reemplazar') (lista.length ? lista : ['']).forEach(kva => sumar(kva ? `Transformador ${kva} kVA` : 'Transformador', 'u', 1));
        if (acc === 'retirar' || acc === 'reemplazar') sumar('Retiro de transformador', 'u', lista.length || 1);
        if (acc === 'trasladar') sumar('Traslado de transformador', 'u', lista.length || 1);
      } else {
        const nom = SIMBOLOS[k]?.nombre.replace(/ (existente|proyectado)$/i, '') || 'Elemento';
        sumar(acc === 'instalar' ? nom : `${ACCIONES[acc].nombre} ${nom.toLowerCase()}`, 'u', 1);
      }
      return;
    }
    // Tramos: metros por conductor (por vano, por si cambia el calibre)
    const porConductor = new Map();
    for (let i = 1; i < el.puntos.length; i++) {
      const c = conductorDe(el, i) || 'sin calibre'; const m = metrosVano(el, i, d.escala);
      porConductor.set(c, porConductor.get(c) === null || m === null ? null : (porConductor.get(c) || 0) + m);
    }
    const acometida = el.tramo === 'acometida';
    porConductor.forEach((m, c) => {
      if (acometida) { sumar(acc === 'trasladar' ? 'Traslado de acometida' : acc === 'retirar' ? 'Retiro de acometida' : 'Acometida nueva', 'u', 1); return; }
      if (acc === 'instalar' || acc === 'reemplazar') sumar(`Conductor ${c}`, 'm', m);
      if (acc === 'retirar') sumar(`Retiro de conductor ${c}`, 'm', m);
      if (acc === 'trasladar') sumar(`Traslado de red ${c}`, 'm', m);
    });
  });
  const orden = x => (/^Poste/.test(x) ? 0 : /^Transformador|^Banco/.test(x) ? 1 : /^Estructura/.test(x) ? 2 : /^Conductor|^Acometida nueva/.test(x) ? 3 : /^Retiro/.test(x) ? 4 : 5);
  return [...filas.values()].sort((a, b) => orden(a.material) - orden(b.material) || a.material.localeCompare(b.material))
    .map(f => ({ ...f, texto: f.incompleto && !f.cantidad ? `— ${f.unidad}` : `${fmt(f.cantidad)}${f.incompleto ? '+' : ''} ${f.unidad}` }));
}

// Cifras del encabezado: trabajos, metros de red nueva, postes nuevos y kVA que se agregan
export function cifras(d, lista = trabajos(d)) {
  let red = 0; let redOk = false; let postes = 0; const kva = [];
  d.elementos.filter(conAccion).forEach(el => {
    const acc = accionDe(el);
    if (el.tipo === 'polilinea' && el.tramo !== 'acometida' && (acc === 'instalar' || acc === 'reemplazar')) { const m = metrosTramo(el, d.escala); if (m !== null) { red += m; redOk = true; } }
    if (el.tipo === 'simbolo' && esPoste(el.simbolo) && (acc === 'instalar' || acc === 'reemplazar')) postes++;
    if (el.tipo === 'simbolo' && esTrafo(el.simbolo) && acc === 'instalar') kva.push(...(el.trafos || []).filter(Boolean).map(Number).filter(n => n > 0));
  });
  const out = [['Trabajos', String(lista.length)]];
  if (redOk) out.push(['Red nueva', `${fmt(red)} m`]);
  if (postes) out.push(['Postes nuevos', String(postes)]);
  if (kva.length) out.push(['Transformador', `+${fmt(kva.reduce((a, b) => a + b, 0))} kVA`]);
  return out;
}

// Elementos con los colores de la lámina de propuesta (existente gris, nuevo turquesa, a retirar rojo)
function conPaleta(elementos) {
  return elementos.map(el => {
    const acc = accionDe(el);
    if (el.tipo === 'polilinea' && el.tramo !== 'acometida') return { ...el, colorRed: acc === 'retirar' ? PALETA.retirar : acc === 'instalar' || acc === 'reemplazar' ? PALETA.nuevo : PALETA.existente };
    if (el.tipo === 'simbolo' && SIMBOLOS[el.simbolo]?.grupo === 'red' && (acc === 'instalar' || acc === 'reemplazar')) return { ...el, color: PALETA.nuevo };
    return el;
  });
}
// Situación actual: sin lo nuevo (ni sus etiquetas de punto proyectado) y lo que se retira o cambia, como existe hoy
export function elementosActuales(elementos) {
  const nuevos = elementos.filter(el => conAccion(el) && accionDe(el) === 'instalar');
  const puntas = nuevos.flatMap(el => (el.tipo === 'simbolo' ? [centro(el)] : []));
  const enNuevo = e => e.tipo === 'etiqueta' && (e.estilo === 'proyectado' || puntas.some(([x, y]) => Math.hypot(e.tx - x, e.ty - y) < 3));
  return elementos.filter(el => !nuevos.includes(el) && !enNuevo(el)).map(el => {
    if (!conAccion(el)) return el;
    const r = { ...el, accion: 'existente' };
    if (el.tipo === 'polilinea' && el.tramo === 'retirar') r.tramo = 'bt';
    return r;
  });
}

// ── SVG de las láminas ──
function partirTexto(texto, max) {
  const out = []; let linea = '';
  String(texto || '').split(/\s+/).forEach(p => { if ((linea + ' ' + p).trim().length > max && linea) { out.push(linea); linea = p; } else linea = (linea + ' ' + p).trim(); });
  if (linea) out.push(linea);
  return out;
}
const T = (x, y, t, { tam = 13, peso = 400, color = '#0f172a', anc = 'start', esp = 0 } = {}) => `<text x="${r1(x)}" y="${r1(y)}" font-family="${FUENTE}" font-size="${tam}" font-weight="${peso}" fill="${color}" text-anchor="${anc}"${esp ? ` letter-spacing="${esp}"` : ''}>${esc(t)}</text>`;

// Marcas numeradas de los trabajos sobre el plano (en unidades del dibujo)
function marcas(lista, w) {
  const k = w / 1600; const r = 21 * k;
  return lista.filter(t => t.ancla).map(t => { const [x, y] = t.ancla; return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="#0f172a" stroke="#ffffff" stroke-width="${r1(4 * k)}"/><text x="${r1(x)}" y="${r1(y + 7 * k)}" text-anchor="middle" font-family="${FUENTE}" font-size="${r1(20 * k)}" font-weight="800" fill="#ffffff">${t.n}</text>`; }).join('');
}
// Marca X roja sobre los símbolos que se retiran o se reemplazan
function equis(elementos, w) {
  const k = w / 1600;
  return elementos.filter(el => el.tipo === 'simbolo' && ['retirar', 'reemplazar'].includes(accionDe(el))).map(el => {
    const [x, y] = centro(el); const s = 30 * el.escala * 0.95;
    return `<g stroke="${PALETA.retirar}" stroke-width="${r1(5 * k)}" stroke-linecap="round"><line x1="${r1(x - s)}" y1="${r1(y - s)}" x2="${r1(x + s)}" y2="${r1(y + s)}"/><line x1="${r1(x + s)}" y1="${r1(y - s)}" x2="${r1(x - s)}" y2="${r1(y + s)}"/></g>`;
  }).join('');
}
// Plano en una tarjeta (x, y, ancho, alto): el dibujo encajado sin deformar, con fondo tipo mapa si no hay imagen
// Lo que ocupa el dibujo (sin imagen de fondo se acerca a lo dibujado para que llene la tarjeta)
export function encuadre(d, elementos) {
  const p = svgLamina({ ...d, elementos: [], lamina: { ...(d.lamina || {}), activa: false } });
  if (d.fondo || !elementos.length) return { x: 0, y: 0, w: p.w, h: p.h };
  const cajas = elementos.map(caja).filter(c => Number.isFinite(c.x) && Number.isFinite(c.y));
  if (!cajas.length) return { x: 0, y: 0, w: p.w, h: p.h };
  const x0 = Math.min(...cajas.map(c => c.x)); const y0 = Math.min(...cajas.map(c => c.y));
  const x1 = Math.max(...cajas.map(c => c.x + c.w)); const y1 = Math.max(...cajas.map(c => c.y + c.h));
  const m = Math.max(x1 - x0, y1 - y0) * 0.07 + 40;
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + m * 2, h: y1 - y0 + m * 2 };
}
function tarjetaPlano(d, elementos, { x, y, w, h, id, extra = '', vista }) {
  const p = svgLamina({ ...d, elementos, sel: null, lamina: { ...(d.lamina || {}), activa: false } });
  const fondo = d.fondo ? p.fondo : '';
  const v = vista || encuadre(d, elementos);
  return `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PALETA.fondo}"/>
    <svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${r1(v.x)} ${r1(v.y)} ${r1(v.w)} ${r1(v.h)}" preserveAspectRatio="xMidYMid meet">${fondo}${p.capa}${extra}</svg></g>`;
}
// Conductor que se cambia: el viejo en rojo punteado al lado del nuevo
function reemplazos(elementos, w) {
  const k = w / 1600; const sep = 9 * k;
  return elementos.filter(el => el.tipo === 'polilinea' && accionDe(el) === 'reemplazar' && el.puntos.length > 1).map(el => {
    const d = el.puntos.map(([px, py], i) => {
      const [ax, ay] = el.puntos[Math.max(0, i - 1)]; const [bx, by] = el.puntos[Math.min(el.puntos.length - 1, i + 1)];
      const L = Math.hypot(bx - ax, by - ay) || 1; return `${i ? 'L' : 'M'}${r1(px - ((by - ay) / L) * sep)} ${r1(py + ((bx - ax) / L) * sep)}`;
    }).join(' ');
    return `<path d="${d}" fill="none" stroke="${PALETA.retirar}" stroke-width="${r1(3 * k)}" stroke-dasharray="${r1(10 * k)} ${r1(8 * k)}"/>`;
  }).join('');
}
// Leyenda flotante (solo lo que aparece) y escala gráfica
function leyendaFlotante(elementos, { x, y, conMarca }) {
  const items = [];
  const hay = f => elementos.some(f);
  if (hay(e => e.tipo === 'polilinea' && e.tramo !== 'acometida' && !accionDe(e))) items.push(['linea', PALETA.existente, 'Existente']);
  if (hay(e => e.tipo === 'polilinea' && ['instalar', 'reemplazar'].includes(accionDe(e)))) items.push(['gruesa', PALETA.nuevo, 'Nuevo']);
  if (hay(e => e.tipo === 'polilinea' && accionDe(e) === 'retirar')) items.push(['guion', PALETA.retirar, 'Se retira']);
  if (hay(e => e.tipo === 'polilinea' && e.tramo === 'acometida')) items.push(['punteada', '#0f172a', 'Acometida']);
  simbologiaUsada(elementos).filter(s => s.clase === 'simbolo').forEach(s => items.push(['simbolo', s.color, s.nombre, s.simbolo]));
  if (hay(e => e.tipo === 'simbolo' && ['retirar', 'reemplazar'].includes(accionDe(e)))) items.push(['equis', PALETA.retirar, 'Se retira / cambia']);
  if (conMarca) items.push(['marca', '#0f172a', 'Trabajo']);
  if (!items.length) return '';
  const cols = 3; const anchoCol = 192; const filas = Math.ceil(items.length / cols); const W = cols * anchoCol + 20; const H = filas * 24 + 18;
  let s = `<rect x="${x}" y="${y - H}" width="${W}" height="${H}" rx="12" fill="#ffffff" fill-opacity="0.95"/>`;
  items.forEach(([tipo, color, nombre, sim], i) => {
    const cx = x + 14 + (i % cols) * anchoCol; const cy = y - H + 21 + Math.floor(i / cols) * 24;
    if (tipo === 'linea') s += `<line x1="${cx}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="${color}" stroke-width="3"/>`;
    else if (tipo === 'gruesa') s += `<line x1="${cx}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="${color}" stroke-width="5"/>`;
    else if (tipo === 'guion') s += `<line x1="${cx}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="${color}" stroke-width="2.5" stroke-dasharray="6 5"/>`;
    else if (tipo === 'punteada') s += `<line x1="${cx}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 3"/>`;
    else if (tipo === 'simbolo') s += `<g transform="translate(${cx + 6} ${cy - 9}) scale(0.3)" color="${color}" stroke="${color}" stroke-width="3" fill="none">${SIMBOLOS[sim].svg}</g>`;
    else if (tipo === 'equis') s += `<g stroke="${color}" stroke-width="2.5" stroke-linecap="round"><line x1="${cx + 8}" y1="${cy - 7}" x2="${cx + 22}" y2="${cy + 7}"/><line x1="${cx + 22}" y1="${cy - 7}" x2="${cx + 8}" y2="${cy + 7}"/></g>`;
    else s += `<circle cx="${cx + 15}" cy="${cy}" r="9" fill="#0f172a"/><text x="${cx + 15}" y="${cy + 4}" text-anchor="middle" font-family="${FUENTE}" font-size="10" font-weight="800" fill="#fff">1</text>`;
    s += T(cx + 40, cy + 4.5, nombre.length > 24 ? nombre.slice(0, 23) + '…' : nombre, { tam: 12.5, peso: 500 });
  });
  return s;
}
function escalaGrafica(d, { x, y, factor }) {
  if (!d.escala) return '';
  // factor: px de la lámina por px del dibujo
  const opciones = [5, 10, 20, 25, 50, 100, 200, 500]; const maxPx = 120;
  const largo = opciones.filter(m => (m / d.escala) * factor <= maxPx).pop(); if (!largo) return '';
  const px = (largo / d.escala) * factor; const W = px + 150;
  let s = `<rect x="${x - W}" y="${y - 36}" width="${W}" height="36" rx="10" fill="#ffffff" fill-opacity="0.95"/>`;
  s += T(x - W + 12, y - 13, 'Escala', { tam: 12, peso: 700 });
  for (let i = 0; i < 4; i++) s += `<rect x="${r1(x - W + 62 + (px / 4) * i)}" y="${y - 21}" width="${r1(px / 4)}" height="6" fill="${i % 2 ? '#ffffff' : '#0f172a'}" stroke="#0f172a" stroke-width="1"/>`;
  return s + T(x - 12, y - 13, `${largo} m`, { tam: 12, peso: 700, anc: 'end' });
}
const norte = (x, y) => `<circle cx="${x}" cy="${y}" r="24" fill="#ffffff"/><path d="M${x} ${y - 15} L${x + 8} ${y + 6} L${x} ${y + 2} L${x - 8} ${y + 6} Z" fill="#0f172a"/>${T(x, y + 18, 'N', { tam: 10, peso: 800, anc: 'middle' })}`;

// Encabezado común: tipo, título, datos y cifras clave
function encabezado(d, lista) {
  const l = d.lamina || {};
  let s = T(34, 54, String(l.etiquetaPropuesta || 'Propuesta de mejora · Red de distribución').toUpperCase(), { tam: 12.5, peso: 800, color: '#0e7490', esp: 2 });
  s += T(34, 94, l.subtitulo || l.titulo || 'Propuesta', { tam: 31, peso: 800 });
  const datos = [l.proyecto, l.referencia].filter(Boolean).join(' · ');
  if (datos) s += T(34, 121, datos, { tam: 15, color: '#475569' });
  let x = 1616;
  [...cifras(d, lista)].reverse().forEach(([e, v]) => {
    const w = Math.max(e.length * 7.6, v.length * 10) + 28; x -= w;
    s += `<rect x="${x}" y="52" width="${w}" height="56" rx="10" fill="#f1f5f9"/>` + T(x + 14, 74, e.toUpperCase(), { tam: 10.5, peso: 700, color: '#64748b', esp: 0.6 }) + T(x + 14, 97, v, { tam: 17, peso: 800 });
    x -= 10;
  });
  return s + `<rect x="34" y="136" width="1582" height="3" fill="#0b2e3b"/>`;
}
// Pie: empresa, fecha, firmas y número de lámina
function pie(d, n, total) {
  const l = d.lamina || {};
  let s = `<rect x="34" y="1196" width="1582" height="1" fill="#e2e8f0"/>`;
  s += T(34, 1226, 'CPT INNOVA', { tam: 14, peso: 800 }) + T(34, 1244, ['Calidad del Producto Técnico', l.fecha].filter(Boolean).join(' · '), { tam: 12, color: '#475569' });
  [['Elaboró', l.elaboro], ['Revisó', l.reviso], ['Aprobó', l.aprobo]].forEach(([e, v], i) => {
    const x = 440 + i * 345;
    s += `<rect x="${x}" y="1214" width="320" height="1" fill="#94a3b8"/>` + (v ? T(x, 1232, v, { tam: 13, peso: 700 }) : '') + T(x, 1248, e, { tam: 12, color: '#475569' });
  });
  return s + T(1616, 1210, 'LÁMINA', { tam: 10, peso: 700, color: '#94a3b8', anc: 'end', esp: 1.5 }) + T(1616, 1246, `${n}/${total}`, { tam: 34, peso: 800, anc: 'end' });
}
const marco = cuerpo => `<svg xmlns="http://www.w3.org/2000/svg" width="1650" height="1275" viewBox="0 0 1650 1275"><rect width="1650" height="1275" fill="#ffffff"/>${cuerpo}</svg>`;

// Lámina de la propuesta para ejecutar: plano con los trabajos numerados, lista de trabajos y cantidades de obra
export function svgPropuesta(d, { n = 2, total = 2 } = {}) {
  const lista = trabajos(d); const elementos = conPaleta(d.elementos);
  const p = svgLamina({ ...d, elementos, lamina: { ...(d.lamina || {}), activa: false } });
  const W = 1092; const H = 1026;
  const v = encuadre(d, elementos); const factor = Math.min(W / v.w, H / v.h);
  let s = encabezado(d, lista);
  s += tarjetaPlano(d, elementos, { x: 34, y: 154, w: W, h: H, id: 'clip-prop', vista: v, extra: reemplazos(d.elementos, p.w) + equis(d.elementos, p.w) + marcas(lista, p.w) });
  if (d.lamina?.norte !== false) s += norte(34 + W - 40, 194);
  s += leyendaFlotante(d.elementos, { x: 48, y: 154 + H - 14, conMarca: lista.length > 0 });
  s += escalaGrafica(d, { x: 34 + W - 14, y: 154 + H - 14, factor });
  // Columna derecha: trabajos (tarjetas) y cantidades de obra
  const X = 1146; let y = 172;
  s += T(X, y, 'TRABAJOS A EJECUTAR', { tam: 12.5, peso: 800, color: '#64748b', esp: 1.6 }); y += 14;
  const compacto = lista.length > 7;
  lista.forEach(t => {
    const lineas = partirTexto(t.texto, compacto ? 44 : 40).slice(0, compacto ? 1 : 2);
    const h = compacto ? 46 : 30 + lineas.length * 17 + 6;
    const a = ACCIONES[t.accion];
    s += `<rect x="${X}" y="${y}" width="470" height="${h}" rx="12" fill="#f8fafc"/>`;
    s += `<circle cx="${X + 26}" cy="${y + h / 2}" r="14" fill="#0f172a"/>` + T(X + 26, y + h / 2 + 4.5, String(t.n), { tam: 13, peso: 800, color: '#ffffff', anc: 'middle' });
    const etW = a.nombre.length * 7.4 + 16;
    if (compacto) {
      s += `<rect x="${X + 52}" y="${y + 8}" width="${etW}" height="17" rx="8.5" fill="${a.fondo}"/>` + T(X + 52 + etW / 2, y + 20.5, a.nombre.toUpperCase(), { tam: 10, peso: 800, color: a.tinta, anc: 'middle', esp: 0.6 });
      s += T(X + 52, y + 39, lineas[0] + (partirTexto(t.texto, 44).length > 1 ? '…' : ''), { tam: 13, peso: 600 });
    } else {
      s += `<rect x="${X + 52}" y="${y + 11}" width="${etW}" height="18" rx="9" fill="${a.fondo}"/>` + T(X + 52 + etW / 2, y + 24, a.nombre.toUpperCase(), { tam: 10, peso: 800, color: a.tinta, anc: 'middle', esp: 0.6 });
      lineas.forEach((ln, i) => { s += T(X + 52, y + 47 + i * 17, ln, { tam: 13.5, peso: 600 }); });
    }
    const [num, ...ud] = String(t.cantidad || '').split(' ');
    s += T(X + 456, y + h / 2 + (ud.length ? 1 : 6), num, { tam: 18, peso: 800, anc: 'end' });
    if (ud.length) s += T(X + 456, y + h / 2 + 17, { m: 'metros', u: num === '1' ? 'unidad' : 'unidades' }[ud.join(' ')] || ud.join(' '), { tam: 10.5, peso: 600, color: '#94a3b8', anc: 'end' });
    y += h + 8;
  });
  if (!lista.length) { s += T(X, y + 20, 'Marca en el dibujo qué se instala, reemplaza, retira o traslada.', { tam: 13, color: '#94a3b8' }); y += 40; }
  const cant = cantidades(d);
  if (cant.length && y < 1120) {
    y += 16; s += T(X, y, 'CANTIDADES DE OBRA', { tam: 12.5, peso: 800, color: '#64748b', esp: 1.6 }); y += 12;
    const filas = cant.slice(0, Math.max(1, Math.floor((1180 - y - 12) / 28)));
    s += `<rect x="${X}" y="${y}" width="470" height="${filas.length * 28 + 10}" rx="12" fill="#f8fafc"/>`;
    filas.forEach((f, i) => {
      const fy = y + 5 + i * 28;
      if (i) s += `<rect x="${X + 14}" y="${fy}" width="442" height="1" fill="#e2e8f0"/>`;
      s += T(X + 14, fy + 19, f.material, { tam: 13 }) + T(X + 456, fy + 19, f.texto, { tam: 13, peso: 800, anc: 'end' });
    });
  }
  s += pie(d, n, total);
  return marco(s);
}

// Lámina de comparación: situación actual y propuesta lado a lado, con el problema y lo que se logra
export function svgComparacion(d, { n = 1, total = 2 } = {}) {
  const lista = trabajos(d); const l = d.lamina || {};
  const W = 781; const H = 770;
  let s = encabezado(d, lista);
  const actual = elementosActuales(d.elementos).map(el => (el.tipo === 'polilinea' && el.tramo !== 'acometida' ? { ...el, colorRed: PALETA.existente } : el));
  const prop = conPaleta(d.elementos);
  const pw = svgLamina({ ...d, lamina: { ...(l), activa: false } }).w;
  // Las dos vistas con el mismo encuadre (el de la propuesta) para compararlas lado a lado
  const v = encuadre(d, prop);
  s += tarjetaPlano(d, actual, { x: 34, y: 154, w: W, h: H, id: 'clip-act', vista: v });
  s += tarjetaPlano(d, prop, { x: 835, y: 154, w: W, h: H, id: 'clip-pro', vista: v, extra: reemplazos(d.elementos, pw) + equis(d.elementos, pw) });
  const pastilla = (x, texto, color) => { const w = texto.length * 9.6 + 26; return `<rect x="${x + 14}" y="168" width="${w}" height="30" rx="8" fill="${color}"/>` + T(x + 27, 188, texto, { tam: 14, peso: 800, color: '#ffffff', esp: 1.4 }); };
  s += pastilla(34, '1 · SITUACIÓN ACTUAL', '#475569') + pastilla(835, '2 · SITUACIÓN PROPUESTA', PALETA.nuevo);
  // Problema y resultado: una línea por dato ("Transformador P1: 25 kVA al 118 %")
  const bloque = (x, titulo, color, texto) => {
    let b = T(x, 962, titulo, { tam: 12.5, peso: 800, color, esp: 1.6 });
    const lineas = String(texto || '').split(/\r?\n/).map(t => t.trim()).filter(Boolean).slice(0, 7);
    if (!lineas.length) b += T(x, 992, 'Escríbelo en el panel de la lámina (una línea por dato)', { tam: 13, color: '#94a3b8' });
    lineas.forEach((ln, i) => {
      const [k, ...v] = ln.split(':'); const yy = 992 + i * 26;
      if (v.length) b += T(x, yy, k.trim(), { tam: 13.5, peso: 600, color: '#475569' }) + T(x + 210, yy, v.join(':').trim(), { tam: 15, peso: 700, color });
      else b += T(x, yy, ln, { tam: 15, peso: 700, color });
    });
    return b;
  };
  s += bloque(34, 'PROBLEMA ENCONTRADO', '#b91c1c', l.problema) + bloque(835, 'CON LA PROPUESTA', PALETA.nuevo, l.solucion);
  s += pie(d, n, total);
  return marco(s);
}
