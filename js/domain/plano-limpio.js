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
const C = { existente: '#334155', nuevo: '#0e7490', retirar: '#e11d48', traslado: '#b45309', texto: '#0f172a', sub: '#475569', acometida: '#1e293b', mt: '#1e293b' };

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

// Texto tachado (lo de hoy que se cambia), con la raya dibujada (se imprime igual en cualquier visor)
const Tachado = (x, y, t, { tam, color = C.retirar, anc = 'middle', rot = 0 }) => {
  const w = ancho(t, tam, false); const x0 = anc === 'middle' ? x - w / 2 : anc === 'end' ? x - w : x;
  return `<g${rot ? ` transform="rotate(${r1(rot)} ${r1(x)} ${r1(y)})"` : ''}>${T(x, y, t, { tam, peso: 500, color, anc })}<line x1="${r1(x0)}" y1="${r1(y - tam * 0.32)}" x2="${r1(x0 + w)}" y2="${r1(y - tam * 0.32)}" stroke="${color}" stroke-width="${r1(Math.max(1, tam * 0.09))}"/></g>`;
};

// Símbolos de red simplificados, del mismo tamaño en cualquier dibujo (cx, cy en la lámina)
// (también se usan en la leyenda de la lámina; e: tamaño)
export function simbolo(k, cx, cy, { nuevo, color, rot = 0 }, e = K) {
  const c = nuevo ? C.nuevo : color; const q = v => r1(v * e);
  // Seccionamiento: corta la línea (hueco blanco) con dos barras rojas de través
  if (k === 'seccionamiento') return `<g transform="rotate(${r1(rot)} ${r1(cx)} ${r1(cy)})"><rect x="${r1(cx - 6 * e)}" y="${r1(cy - 9 * e)}" width="${q(12)}" height="${q(18)}" fill="#ffffff"/><g stroke="${C.retirar}" stroke-width="${q(3)}" stroke-linecap="round"><line x1="${r1(cx - 4 * e)}" y1="${r1(cy - 9 * e)}" x2="${r1(cx - 4 * e)}" y2="${r1(cy + 9 * e)}"/><line x1="${r1(cx + 4 * e)}" y1="${r1(cy - 9 * e)}" x2="${r1(cx + 4 * e)}" y2="${r1(cy + 9 * e)}"/></g></g>`;
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
    // Existente: con su color si la red tiene uno propio (para distinguir redes, p. ej. de dos transformadores)
    return { color: el.colorRed || (/^mt/.test(el.tramo) ? C.mt : C.existente), w: (/^mt/.test(el.tramo) ? 3.6 : 3) * K };
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
    const acc = accion(el); const nuevo = acc !== 'seccionar' && (acc === 'instalar' || acc === 'reemplazar' || acc === 'trasladar' || /_nuevo$/.test(el.simbolo));
    // Traslado: dónde está hoy (círculo punteado) y una flecha hasta su lugar nuevo
    if (el._traslado) {
      const [ax, ay] = P(el._traslado.desde); const L = Math.hypot(cx - ax, cy - ay) || 1; const ux = (cx - ax) / L; const uy = (cy - ay) / L;
      const r0 = 7 * K; const bx = cx - ux * 11 * K; const by = cy - uy * 11 * K; const q = 6 * K;
      sims += `<circle cx="${r1(ax)}" cy="${r1(ay)}" r="${r1(r0)}" fill="#ffffff" fill-opacity="0.6" stroke="${C.traslado}" stroke-width="${r1(1.8 * K)}" stroke-dasharray="${r1(3 * K)} ${r1(2.5 * K)}"/>`;
      if (L > r0 + 14 * K) sims += `<line x1="${r1(ax + ux * (r0 + 2 * K))}" y1="${r1(ay + uy * (r0 + 2 * K))}" x2="${r1(bx - ux * q * 0.6)}" y2="${r1(by - uy * q * 0.6)}" stroke="${C.traslado}" stroke-width="${r1(2.2 * K)}" stroke-dasharray="${r1(6 * K)} ${r1(4 * K)}"/><path d="M${r1(bx)} ${r1(by)} L${r1(bx - ux * q * 1.6 - uy * q)} ${r1(by - uy * q * 1.6 + ux * q)} L${r1(bx - ux * q * 1.6 + uy * q)} ${r1(by - uy * q * 1.6 - ux * q)} Z" fill="${C.traslado}"/>`;
      ocupados.push({ x: ax - r0, y: ay - r0, w: r0 * 2, h: r0 * 2 });
    }
    sims += simbolo(el.simbolo, cx, cy, { nuevo, color: SIMBOLOS[el.simbolo]?.color || C.existente, rot: el.rot || 0 });
    if (acc === 'retirar' || acc === 'reemplazar') { const q = 9 * K; sims += `<g stroke="${C.retirar}" stroke-width="${r1(2.6 * K)}" stroke-linecap="round"><line x1="${r1(cx - q)}" y1="${r1(cy - q)}" x2="${r1(cx + q)}" y2="${r1(cy + q)}"/><line x1="${r1(cx + q)}" y1="${r1(cy - q)}" x2="${r1(cx - q)}" y2="${r1(cy + q)}"/></g>`; }
    ocupados.push(cajaSimbolo(el.simbolo, cx, cy));
    return { el, cx, cy, nuevo };
  });

  // ── Metros de cada vano como en el editor (pedido del equipo): recuadro blanco derecho al lado de la línea, metros
  // arriba y debajo, más chico, el conductor y las acometidas (y el conductor de hoy tachado si se cambia) ──
  let vanos = '';
  tramos.forEach(el => {
    const e = estiloTramo(el);
    for (let i = 1; i < el.puntos.length; i++) {
      const [x0, y0] = P(el.puntos[i - 1]); const [x1, y1] = P(el.puntos[i]);
      const L = Math.hypot(x1 - x0, y1 - y0); if (L < 14 * K) continue;
      const m = metrosVano(el, i, d.escala); const c = conductorVano(el, i);
      const cond = el.tramo === 'acometida' ? '' : [c?.calibre, c?.tipo].filter(Boolean).join(' ');
      const acom = textoAcometidas(el.acometidas?.[i]);
      const tam = 10.5 * K; const ta = 8.5 * K;
      const lineas = [m !== null ? { t: fmtM(m), tam, peso: 800 } : null, cond || acom ? { t: [cond, acom].filter(Boolean).join(' · '), tam: ta, peso: 600 } : null,
        el._antes && el.tramo !== 'acometida' ? { t: el._antes, tam: ta, tachado: true } : null].filter(Boolean);
      if (!lineas.length) continue;
      if (m === null) { lineas[0].tam = tam * 0.9; lineas[0].peso = 700; }
      const pad = 4 * K; const cw = Math.max(...lineas.map(l => ancho(l.t, l.tam, l.peso >= 700))) + pad * 2;
      const ch = lineas.reduce((a, l) => a + l.tam * 1.18, 0) + pad * 1.1;
      // Al lado de la línea (no encima), donde no choque: a un lado o al otro, en el centro o corrido a lo largo del vano
      const ux = (x1 - x0) / L; const uy = (y1 - y0) / L; let nx = -uy; let ny = ux;
      if (Math.abs(ny) >= 0.45 ? ny < 0 : nx > 0) { nx = -nx; ny = -ny; } // abajo en los acostados, a la izquierda en los parados
      const sep = Math.abs(ny) * ch / 2 + Math.abs(nx) * cw / 2 + e.w / 2 + 4 * K + (accion(el) === 'reemplazar' ? 9 * K : 0); // libra el conductor de hoy (rojo punteado)
      const opciones = [0.5, 0.32, 0.68].flatMap(t => [1, -1].map(sg => {
        const cx = x0 + (x1 - x0) * t + nx * sep * sg; const cy = y0 + (y1 - y0) * t + ny * sep * sg;
        return { cx, cy, caja: { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch } };
      }));
      const o = opciones.find(q => !ocupados.some(z => seCruzan(q.caja, z)) && !segmentos.some(([pa, pb]) => tocaSegmento(q.caja, pa, pb))) || opciones.find(q => !ocupados.some(z => seCruzan(q.caja, z))) || opciones[0];
      ocupados.push(o.caja);
      const borde = e.color === C.retirar ? C.retirar : e.color === C.nuevo ? C.nuevo : '#94a3b8';
      vanos += `<rect x="${r1(o.caja.x)}" y="${r1(o.caja.y)}" width="${r1(cw)}" height="${r1(ch)}" rx="${r1(4 * K)}" fill="#ffffff" fill-opacity="0.96" stroke="${borde}" stroke-width="${r1(1.1 * K)}"/>`;
      let yy = o.caja.y + pad * 0.55;
      lineas.forEach((l, k) => {
        yy += l.tam * 1.18; const by = yy - l.tam * 0.28;
        const color = k === 0 ? (e.color === C.retirar ? C.retirar : e.color === C.nuevo ? C.nuevo : C.texto) : C.sub;
        vanos += l.tachado ? Tachado(o.cx, by, l.t, { tam: l.tam, anc: 'middle' }) : `<text x="${r1(o.cx)}" y="${r1(by)}" font-family="${FUENTE}" font-size="${r1(l.tam)}" font-weight="${l.peso}" fill="${color}" text-anchor="middle">${esc(l.t)}</text>`;
      });
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
    // Si cambian los kVA, la nota de la etiqueta con los de hoy ("Trafo 25 kVA") no sale: van los nuevos y los de hoy tachados
    const cambiaKva = g.some(s => /kVA/.test(s.el._antes || ''));
    const resto = et ? [lineas[0].includes(':') ? lineas[0].split(':').slice(1).join(':').trim() : '', ...lineas.slice(1)].filter(t => t && !(cambiaKva && /kva/i.test(t))) : [];
    const sub = [];
    g.forEach(s => { const datos = [textoAltura(s.el.altura), textoEstructuras(s.el.estructuras)].filter(Boolean).join(' · '); if (datos) sub.push({ t: datos, nuevo: s.nuevo }); });
    resto.forEach(t => sub.push({ t, nuevo: g.every(s => s.nuevo) }));
    g.forEach(s => {
      const kva = (s.el.trafos || []).filter(Boolean);
      if (kva.length && !resto.some(t => /kva/i.test(t))) sub.push({ t: `${s.nuevo ? 'Trafo nuevo ' : 'Trafo '}${kva.length > 1 ? kva.join(' + ') : kva[0]} kVA`, nuevo: s.nuevo });
      if (s.el.detalleAccion) sub.push({ t: s.el.detalleAccion, nuevo: true });
      if (String(s.el.nota || '').trim()) sub.push({ t: String(s.el.nota).trim(), nuevo: false }); // nota del símbolo (p. ej. el medidor del usuario)
    });
    // Lo de hoy que se cambia, tachado en rojo debajo de lo nuevo
    g.forEach(s => { if (s.el._antes) sub.push({ t: s.el._antes, antes: true }); });
    if (g.some(s => s.el.simbolo === 'seccionamiento')) sub.push({ t: 'Seccionamiento', corte: true });
    // Referencia eléctrica del transformador junto al nombre: "P2: DS102277"
    const ref = g.map(s => String(s.el.referencia || '').trim()).find(Boolean) || '';
    const conRef = ref && !resto.some(t => t.includes(ref)) && !nombre.includes(ref) ? (nombre ? `${nombre}: ${ref}` : ref) : nombre;
    return { cx: s0.cx, cy: s0.cy, nuevo: g.filter(s => s.el.simbolo !== 'seccionamiento').every(s => s.nuevo), nombre: conRef, sub, destacado: et?.estilo === 'destacado' || g.some(s => s.el.simbolo === 'usuario') };
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
    p.sub.forEach((l, i) => { const yy = o.caja.y + tn + 2 + (i + 1) * (ts + 2.5) - 3 * K; rotulos += l.antes ? Tachado(tx, yy, l.t, { tam: ts, anc: o.anc }) : T(tx, yy, l.t, { tam: ts, peso: l.corte ? 800 : 600, color: l.corte ? C.retirar : l.nuevo ? C.nuevo : C.sub, anc: o.anc }); });
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
