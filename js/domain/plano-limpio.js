// Plano en "estilo de presentación" para las láminas de propuesta (pedido del equipo): el mismo dibujo de Dibujar,
// pero redibujado a tamaño de hoja con jerarquía clara: la red manda (líneas firmes con borde blanco), los datos
// acompañan (texto sin cajas con borde blanco suave) y el mapa queda de fondo, tenue. Letras y grosores fijos en
// píxeles de la lámina (no dependen del tamaño de la imagen) y las etiquetas se acomodan solas para no encimarse
// con otras, con la red ni con los símbolos. Funciones puras: devuelven SVG en coordenadas de la lámina.
import { SIMBOLOS } from './dibujo.js';
import { metrosVano, nombrePunto } from './plano.js';
import { conductorVano, textoAcometidas, textoAltura, textoEstructuras } from './red.js';

const FUENTE = 'Arial, Helvetica, sans-serif';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = v => Math.round(v * 10) / 10;
const ancho = (t, tam, negrita) => String(t).length * tam * (negrita ? 0.6 : 0.54);
const fmtM = m => `${(Math.round(m * 10) / 10).toFixed(1)} m`;
// Tamaños pensados para leerse impresos en carta (la lámina mide 1650 px = 11 pulgadas)
const K = 1.45;

// Colores (los de la lámina de propuesta)
const C = { existente: '#334155', nuevo: '#0e7490', retirar: '#e11d48', texto: '#0f172a', sub: '#475569', acometida: '#1e293b', mt: '#1e293b' };

// ── Choques (para acomodar etiquetas) ──
const seCruzan = (a, b, m = 2) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
// Segmento contra rectángulo (muestreo: suficiente a esta escala)
function tocaSegmento(r, [x0, y0], [x1, y1]) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; const y = y0 + ((y1 - y0) * i) / n; if (x > r.x - 2 && x < r.x + r.w + 2 && y > r.y - 2 && y < r.y + r.h + 2) return true; }
  return false;
}

// Texto con borde blanco (se lee sobre el mapa o las líneas)
const T = (x, y, t, { tam = 11, peso = 600, color = C.texto, anc = 'start', rot = 0 } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" font-family="${FUENTE}" font-size="${tam}" font-weight="${peso}" fill="${color}" text-anchor="${anc}" stroke="#ffffff" stroke-width="${r1(tam * 0.32)}" stroke-linejoin="round" paint-order="stroke"${rot ? ` transform="rotate(${r1(rot)} ${r1(x)} ${r1(y)})"` : ''}>${esc(t)}</text>`;

// Símbolos de red simplificados, del mismo tamaño en cualquier dibujo (cx, cy en la lámina)
// (también se usan en la leyenda de la lámina; e: tamaño)
export function simbolo(k, cx, cy, { nuevo, color }, e = K) {
  const c = nuevo ? C.nuevo : color; const q = v => r1(v * e);
  if (k === 'poste' || k === 'poste_nuevo') return nuevo ? `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${q(5.5)}" fill="#ffffff" stroke="${C.nuevo}" stroke-width="${q(2.6)}"/>` : `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${q(4.6)}" fill="${C.existente}" stroke="#ffffff" stroke-width="${q(1.6)}"/>`;
  if (k === 'trafo' || k === 'trafo_nuevo') return `<path d="M${r1(cx)} ${r1(cy - 10 * e)} L${r1(cx + 9 * e)} ${r1(cy + 6 * e)} L${r1(cx - 9 * e)} ${r1(cy + 6 * e)} Z" fill="${nuevo ? '#ffffff' : C.existente}" stroke="${nuevo ? C.nuevo : '#ffffff'}" stroke-width="${q(nuevo ? 2.2 : 1.5)}" stroke-linejoin="round"/>${nuevo ? `<text x="${r1(cx)}" y="${r1(cy + 4 * e)}" text-anchor="middle" font-family="${FUENTE}" font-size="${q(8)}" font-weight="800" fill="${C.nuevo}">N</text>` : ''}`;
  if (k === 'usuario') return `<path d="M${r1(cx)} ${r1(cy + 2 * e)} C${r1(cx - 10 * e)} ${r1(cy - 10 * e)} ${r1(cx - 8 * e)} ${r1(cy - 22 * e)} ${r1(cx)} ${r1(cy - 22 * e)} C${r1(cx + 8 * e)} ${r1(cy - 22 * e)} ${r1(cx + 10 * e)} ${r1(cy - 10 * e)} ${r1(cx)} ${r1(cy + 2 * e)} Z" fill="${C.retirar}" stroke="#ffffff" stroke-width="${q(1.5)}"/><circle cx="${r1(cx)}" cy="${r1(cy - 13 * e)}" r="${q(3.4)}" fill="#ffffff"/>`;
  const s = SIMBOLOS[k]; if (!s) return '';
  return `<g transform="translate(${r1(cx - 11 * e)} ${r1(cy - 11 * e)}) scale(${r1(0.367 * e * 1000) / 1000})" color="${c}" stroke="${c}" stroke-width="3" fill="none">${s.svg}</g>`;
}
const cajaSimbolo = (k, cx, cy) => (k === 'usuario' ? { x: cx - 10 * K, y: cy - 22 * K, w: 20 * K, h: 25 * K } : k === 'poste' || k === 'poste_nuevo' ? { x: cx - 6 * K, y: cy - 6 * K, w: 12 * K, h: 12 * K } : { x: cx - 11 * K, y: cy - 11 * K, w: 22 * K, h: 22 * K });

// Plano limpio dentro de la tarjeta (x, y, w, h) con la vista (en coordenadas del dibujo) encajada sin deformar.
// accion(el): acción del elemento en la propuesta; marcas: [{ n, ancla }] trabajos numerados (ancla en el dibujo)
export function planoLimpio(d, elementos, { x, y, w, h, vista, accion = () => null, marcas = [], fondoOpacidad = 0.55 }) {
  const f = Math.min(w / vista.w, h / vista.h);
  const ox = x + (w - vista.w * f) / 2 - vista.x * f; const oy = y + (h - vista.h * f) / 2 - vista.y * f;
  const P = ([px, py]) => [ox + px * f, oy + py * f];
  let fondo = '';
  if (d.fondo) fondo = `<image href="${d.fondo.src}" x="${r1(ox)}" y="${r1(oy)}" width="${r1(d.fondo.w * f)}" height="${r1(d.fondo.h * f)}" preserveAspectRatio="none" opacity="${fondoOpacidad}"/>`;

  // ── Red: tramos con borde blanco; acometidas finas punteadas ──
  const tramos = elementos.filter(e => e.tipo === 'polilinea' && e.puntos.length > 1);
  const segmentos = [];
  let red = '';
  const estiloTramo = el => {
    const acc = accion(el);
    if (el.tramo === 'acometida') return { color: acc === 'retirar' ? C.retirar : acc ? C.nuevo : C.acometida, w: 1.6 * K, dash: `${5 * K} ${4 * K}` };
    if (acc === 'retirar') return { color: C.retirar, w: 2.4 * K, dash: `${8 * K} ${6 * K}` };
    if (acc === 'instalar' || acc === 'reemplazar' || acc === 'trasladar') return { color: C.nuevo, w: 4.6 * K };
    return { color: /^mt/.test(el.tramo) ? C.mt : C.existente, w: (/^mt/.test(el.tramo) ? 3.6 : 3) * K };
  };
  tramos.forEach(el => {
    const pts = el.puntos.map(P); const e = estiloTramo(el);
    const dd = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${r1(a)} ${r1(b)}`).join(' ');
    red += `<path d="${dd}" fill="none" stroke="#ffffff" stroke-width="${r1(e.w + 3.5 * K)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>`;
    red += `<path d="${dd}" fill="none" stroke="${e.color}" stroke-width="${e.w}" stroke-linecap="round" stroke-linejoin="round"${e.dash ? ` stroke-dasharray="${e.dash}"` : ''}/>`;
    // Conductor viejo (se cambia): rojo punteado al lado del nuevo
    if (accion(el) === 'reemplazar') {
      const off = pts.map(([px, py], i) => {
        const [ax, ay] = pts[Math.max(0, i - 1)]; const [bx, by] = pts[Math.min(pts.length - 1, i + 1)]; const L = Math.hypot(bx - ax, by - ay) || 1;
        return `${i ? 'L' : 'M'}${r1(px - ((by - ay) / L) * 7 * K)} ${r1(py + ((bx - ax) / L) * 7 * K)}`;
      }).join(' ');
      red += `<path d="${off}" fill="none" stroke="${C.retirar}" stroke-width="${r1(2 * K)}" stroke-dasharray="${7 * K} ${6 * K}"/>`;
    }
    for (let i = 1; i < pts.length; i++) segmentos.push([pts[i - 1], pts[i]]);
  });

  // ── Símbolos ──
  const ocupados = [];
  const simbolos = elementos.filter(e => e.tipo === 'simbolo' && SIMBOLOS[e.simbolo]?.grupo === 'red');
  let sims = '';
  const datosSim = simbolos.map(el => {
    const [cx, cy] = P([el.x + 30 * el.escala, el.y + 30 * el.escala]);
    const acc = accion(el); const nuevo = acc === 'instalar' || acc === 'reemplazar' || /_nuevo$/.test(el.simbolo);
    sims += simbolo(el.simbolo, cx, cy, { nuevo, color: SIMBOLOS[el.simbolo]?.color || C.existente });
    if (acc === 'retirar' || acc === 'reemplazar') { const q = 9 * K; sims += `<g stroke="${C.retirar}" stroke-width="${r1(2.6 * K)}" stroke-linecap="round"><line x1="${r1(cx - q)}" y1="${r1(cy - q)}" x2="${r1(cx + q)}" y2="${r1(cy + q)}"/><line x1="${r1(cx + q)}" y1="${r1(cy - q)}" x2="${r1(cx - q)}" y2="${r1(cy + q)}"/></g>`; }
    ocupados.push(cajaSimbolo(el.simbolo, cx, cy));
    return { el, cx, cy, nuevo };
  });

  // ── Metros y conductor de cada vano: una línea discreta, a lo largo del vano ──
  let vanos = '';
  tramos.forEach(el => {
    const e = estiloTramo(el);
    for (let i = 1; i < el.puntos.length; i++) {
      const [x0, y0] = P(el.puntos[i - 1]); const [x1, y1] = P(el.puntos[i]);
      const L = Math.hypot(x1 - x0, y1 - y0); if (L < 46 * K) continue;
      const m = metrosVano(el, i, d.escala); const c = conductorVano(el, i);
      const cond = [c?.calibre, c?.tipo].filter(Boolean).join(' ');
      // Metros y conductor; si no caben en el vano, solo los metros
      const tam = 10.5 * K;
      const opciones = [[m !== null ? fmtM(m) : '', el.tramo === 'acometida' ? '' : cond].filter(Boolean).join(' · '), m !== null ? fmtM(m) : ''].filter(Boolean);
      const texto = opciones.find(t => ancho(t, tam, true) <= L - 10 * K);
      if (!texto) continue;
      const tw = ancho(texto, tam, true);
      let ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      const rad = (ang * Math.PI) / 180; const nx = -Math.sin(rad); const ny = Math.cos(rad); // abajo del vano (o a la derecha)
      const mx = (x0 + x1) / 2; const my = (y0 + y1) / 2;
      // A un lado o al otro, donde no choque
      // Acometidas del vano: segunda línea más chica, por fuera de la primera
      const acom = textoAcometidas(el.acometidas?.[i]); const ta = 9 * K; const alto = acom ? tam + ta * 1.15 : tam;
      const lados = [1, -1].map(sg => { const sep = 8 * K + alto * 0.5; const cx = mx + nx * sep * sg; const cy = my + ny * sep * sg; const ax = Math.abs(Math.cos(rad)); const ay = Math.abs(Math.sin(rad));
        const aw = Math.max(tw, acom ? ancho(acom, ta, false) : 0);
        return { sg, cx, cy, caja: { x: cx - (aw * ax + alto * ay) / 2, y: cy - (aw * ay + alto * ax) / 2, w: aw * ax + alto * ay, h: aw * ay + alto * ax } }; });
      const lado = lados.find(l => !ocupados.some(o => seCruzan(l.caja, o))) || lados[0];
      ocupados.push(lado.caja);
      const color = e.color === C.retirar ? C.retirar : e.color === C.nuevo ? C.nuevo : C.sub;
      // Metros pegados a la línea y acometidas por fuera (en el lado de abajo o en el de arriba)
      const d1 = (alto - tam) / 2 * -lado.sg; const d2 = (alto - ta) / 2 * lado.sg;
      vanos += T(lado.cx + nx * d1, lado.cy + ny * d1 + tam * 0.36, texto, { tam, peso: 600, color, anc: 'middle', rot: ang });
      if (acom) vanos += T(lado.cx + nx * d2, lado.cy + ny * d2 + ta * 0.36, acom, { tam: ta, peso: 500, color: C.sub, anc: 'middle', rot: ang });
    }
  });

  // ── Etiquetas de los puntos: nombre en negrita y datos debajo, sin caja, donde haya lugar ──
  const etiquetas = elementos.filter(e => e.tipo === 'etiqueta');
  const usadas = new Set();
  // Un rótulo por lugar: el poste y el transformador que se le pone encima comparten nombre y datos.
  // Cada línea de datos va en turquesa si es de algo nuevo (sub: [{ t, nuevo }])
  const grupos = [];
  datosSim.forEach(s => { const g = grupos.find(x => Math.hypot(x[0].cx - s.cx, x[0].cy - s.cy) < 6); if (g) g.push(s); else grupos.push([s]); });
  const puntos = grupos.map(g => {
    const s0 = g[0];
    const et = etiquetas.find(e => { const [tx, ty] = P([e.tx, e.ty]); return Math.hypot(tx - s0.cx, ty - s0.cy) < 6; });
    if (et) usadas.add(et);
    const lineas = et ? String(et.texto || '').split('\n').map(t => t.trim()).filter(Boolean) : [];
    const nombre = et ? nombrePunto(lineas[0]) : '';
    const resto = et ? [lineas[0].includes(':') ? lineas[0].split(':').slice(1).join(':').trim() : '', ...lineas.slice(1)].filter(Boolean) : [];
    const sub = [];
    g.forEach(s => { const datos = [textoAltura(s.el.altura), textoEstructuras(s.el.estructuras)].filter(Boolean).join(' · '); if (datos) sub.push({ t: datos, nuevo: s.nuevo }); });
    resto.forEach(t => sub.push({ t, nuevo: g.every(s => s.nuevo) }));
    g.forEach(s => {
      const kva = (s.el.trafos || []).filter(Boolean);
      if (kva.length && !resto.some(t => /kva/i.test(t))) sub.push({ t: `${s.nuevo ? 'Trafo nuevo ' : 'Trafo '}${kva.length > 1 ? kva.join(' + ') : kva[0]} kVA`, nuevo: s.nuevo });
      if (s.el.detalleAccion) sub.push({ t: s.el.detalleAccion, nuevo: true });
    });
    return { cx: s0.cx, cy: s0.cy, nuevo: g.every(s => s.nuevo), nombre, sub, destacado: et?.estilo === 'destacado' || g.some(s => s.el.simbolo === 'usuario') };
  }).filter(p => p.nombre || p.sub.length);
  // Etiquetas sueltas (no apuntan a un símbolo)
  etiquetas.filter(e => !usadas.has(e)).forEach(e => {
    const [cx, cy] = P([e.tx, e.ty]); const lineas = String(e.texto || '').split('\n').map(t => t.trim()).filter(Boolean);
    if (lineas.length) puntos.push({ cx, cy, nombre: lineas[0], sub: lineas.slice(1).map(t => ({ t, nuevo: e.estilo === 'proyectado' })), nuevo: e.estilo === 'proyectado', destacado: e.estilo === 'destacado' });
  });
  let rotulos = '';
  const DIRS = [[1, -1], [1, 1], [-1, -1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]];
  puntos.forEach(p => {
    const tn = 12.5 * K; const ts = 10 * K; const lw = Math.max(ancho(p.nombre, tn, true), ...p.sub.map(l => ancho(l.t, ts, false)));
    const lh = tn + p.sub.length * (ts + 2.5) + 2;
    // Primero pegado al punto; si todo choca, un poco más lejos (en dos anillos)
    const opciones = [1, 2.4, 4].flatMap((lejos, anillo) => DIRS.map(d => [d, anillo * 8 + DIRS.indexOf(d), lejos])).map(([[dx, dy], k, lejos]) => {
      const gap = 9 * K * lejos;
      const bx = dx > 0 ? p.cx + gap : dx < 0 ? p.cx - gap - lw : p.cx - lw / 2;
      const by = dy < 0 ? p.cy - gap - lh : dy > 0 ? p.cy + gap : p.cy - lh / 2;
      const caja = { x: bx, y: by, w: lw, h: lh };
      const choques = ocupados.filter(o => seCruzan(caja, o)).length * 3 + segmentos.filter(([a, b]) => tocaSegmento(caja, a, b)).length * 2;
      const fuera = caja.x < x + 4 || caja.y < y + 4 || caja.x + caja.w > x + w - 4 || caja.y + caja.h > y + h - 4 ? 6 : 0;
      return { caja, lejos, anc: dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle', puntaje: choques + fuera + k * 0.01 };
    }).sort((a, b) => a.puntaje - b.puntaje);
    const o = opciones[0]; ocupados.push(o.caja);
    const tx = o.anc === 'start' ? o.caja.x : o.anc === 'end' ? o.caja.x + o.caja.w : o.caja.x + o.caja.w / 2;
    // Lejos del punto: una línea fina lo une con su rótulo
    if (o.lejos > 1) { const qx = Math.max(o.caja.x, Math.min(p.cx, o.caja.x + o.caja.w)); const qy = Math.max(o.caja.y, Math.min(p.cy, o.caja.y + o.caja.h)); rotulos += `<line x1="${r1(p.cx)}" y1="${r1(p.cy)}" x2="${r1(qx)}" y2="${r1(qy)}" stroke="#64748b" stroke-width="1.2"/>`; }
    if (p.destacado) rotulos += `<rect x="${r1(o.caja.x - 6)}" y="${r1(o.caja.y - 4)}" width="${r1(o.caja.w + 12)}" height="${r1(lh + 7)}" rx="7" fill="#fde047"/>`;
    rotulos += T(tx, o.caja.y + tn * 0.9, p.nombre, { tam: tn, peso: 800, color: p.nuevo ? C.nuevo : C.texto, anc: o.anc });
    p.sub.forEach((l, i) => { rotulos += T(tx, o.caja.y + tn + 2 + (i + 1) * (ts + 2.5) - 3 * K, l.t, { tam: ts, peso: 600, color: l.nuevo ? C.nuevo : C.sub, anc: o.anc }); });
  });

  // ── Marcas de los trabajos: junto a su elemento, sin taparlo ──
  let mk = '';
  marcas.filter(m => m.ancla).forEach(m => {
    const [ax, ay] = P(m.ancla); const r = 11 * K;
    const cands = [[0, 0], [14, -14], [-14, -14], [14, 14], [-14, 14], [24, 0], [-24, 0], [0, -24], [0, 24], [34, -20], [-34, -20], [34, 20], [-34, 20]].map(([dx, dy]) => ({ cx: ax + dx * K, cy: ay + dy * K }));
    const c = cands.find(q => { const caja = { x: q.cx - r, y: q.cy - r, w: r * 2, h: r * 2 }; return !ocupados.some(o => seCruzan(caja, o, 1)); }) || cands[0];
    ocupados.push({ x: c.cx - r, y: c.cy - r, w: r * 2, h: r * 2 });
    mk += `<circle cx="${r1(c.cx)}" cy="${r1(c.cy)}" r="${r1(r)}" fill="#0f172a" stroke="#ffffff" stroke-width="${r1(2.5 * K)}"/><text x="${r1(c.cx)}" y="${r1(c.cy + 4 * K)}" text-anchor="middle" font-family="${FUENTE}" font-size="${r1(11.5 * K)}" font-weight="800" fill="#ffffff">${m.n}</text>`;
  });

  return fondo + red + vanos + sims + rotulos + mk;
}
