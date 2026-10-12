// Dibujar como lámina de red: tipos de tramo, estilos de etiqueta, escala real, distancias y cajetín.
// Funciones puras (sin DOM). La escala es metros por píxel de la imagen y se obtiene calibrando con una distancia
// conocida (la barra de escala del mapa o un vano medido).

// Tramos por tipo: el estilo dice qué es (no solo un color)
export const TIPOS_TRAMO = {
  bt: { nombre: 'Red BT existente', color: '#a21caf', dash: null, ancho: 1 },
  bt_nueva: { nombre: 'Red BT proyectada', color: '#2563eb', dash: null, ancho: 1.15 },
  mt: { nombre: 'Red MT', color: '#dc2626', dash: null, ancho: 1.15 },
  mt_nueva: { nombre: 'Red MT proyectada', color: '#ea580c', dash: '3 1.6', ancho: 1.15 },
  retirar: { nombre: 'Red a retirar', color: '#6b7280', dash: '1.6 1.4', ancho: 0.9 },
  acometida: { nombre: 'Acometida', color: '#0f172a', dash: '1 1', ancho: 0.55 },
};

// Estilos de las etiquetas de punto
export const ESTILOS_ETIQUETA = {
  existente: { nombre: 'Punto existente', fondo: '#0f2a43', texto: '#ffffff', prefijo: 'P' },
  proyectado: { nombre: 'Punto proyectado', fondo: '#2563eb', texto: '#ffffff', prefijo: 'W' },
  destacado: { nombre: 'Destacado', fondo: '#facc15', texto: '#111827', prefijo: '' },
  neutro: { nombre: 'Nota', fondo: '#ffffff', texto: '#111827', prefijo: '' },
};

export const longitud = puntos => puntos.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - puntos[i - 1][0], p[1] - puntos[i - 1][1]) : 0), 0);
export const fmtMetros = m => (m === null || m === undefined || Number.isNaN(m) ? '— m' : m >= 100 ? `${Math.round(m)} m` : `${(Math.round(m * 10) / 10).toFixed(1)} m`);

// Calibración: con una línea de `px` píxeles que mide `metros` en la realidad
export function escalaDe(px, metros) {
  const m = Number(String(metros).replace(',', '.'));
  return px > 0 && m > 0 ? m / px : null;
}

// Puntos a los que se ajustan tramos, cotas y etiquetas: centros de los símbolos de red, vértices y destinos
export function anclas(elementos, simbolos) {
  const out = [];
  elementos.forEach(e => {
    if (e.tipo === 'simbolo' && simbolos[e.simbolo]?.grupo === 'red') out.push({ x: e.x + 30 * e.escala, y: e.y + 30 * e.escala, id: e.id });
    if (e.tipo === 'polilinea') e.puntos.forEach(([x, y]) => out.push({ x, y, id: e.id }));
    if (e.tipo === 'etiqueta') out.push({ x: e.tx, y: e.ty, id: e.id });
  });
  return out;
}
export function ajustar(p, lista, tol, excluir = null) { return imanar(p, lista, [], tol, excluir).p; }

// Imán: primero a un punto (poste, vértice, punta de etiqueta) dentro de `tol`; si no hay, a la línea de un tramo
// (proyección sobre el vano) dentro de `tol` × 0.8. Devuelve { p, a: 'punto' | 'linea' | null }.
export function imanar([x, y], puntos, segmentos, tol, excluir = null) {
  let mejor = null; let dmin = tol;
  puntos.forEach(a => { if (a.id === excluir) return; const d = Math.hypot(a.x - x, a.y - y); if (d <= dmin) { dmin = d; mejor = [a.x, a.y]; } });
  if (mejor) return { p: mejor, a: 'punto' };
  let dl = tol * 0.8;
  segmentos.forEach(sg => {
    if (sg.id === excluir) return;
    const [x0, y0] = sg.p0; const [x1, y1] = sg.p1; const vx = x1 - x0; const vy = y1 - y0; const l2 = vx * vx + vy * vy; if (!l2) return;
    const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / l2));
    const px = x0 + vx * t; const py = y0 + vy * t; const d = Math.hypot(px - x, py - y);
    if (d <= dl) { dl = d; mejor = [px, py]; }
  });
  return mejor ? { p: mejor, a: 'linea' } : { p: [x, y], a: null };
}
// Vanos de los tramos como segmentos para el imán
export const segmentosTramos = elementos => elementos.filter(e => e.tipo === 'polilinea').flatMap(e => e.puntos.slice(1).map((p, i) => ({ id: e.id, p0: e.puntos[i], p1: p })));

// Nombre corto de una etiqueta: "P1: DS111267" → "P1"
export const nombrePunto = t => String(t || '').split(/[:\n]/)[0].trim();

// Metros de un vano (entre puntos[i-1] y puntos[i]): el escrito a mano manda; si no, con la escala; si no, null
export function metrosVano(t, i, escala) {
  const manual = Number(t.metros?.[i]);
  if (t.metros?.[i] !== undefined && t.metros?.[i] !== '' && manual >= 0 && !Number.isNaN(manual)) return manual;
  if (!escala) return null;
  const [x0, y0] = t.puntos[i - 1]; const [x1, y1] = t.puntos[i];
  return Math.hypot(x1 - x0, y1 - y0) * escala;
}
// Largo total de un tramo en metros (null si falta algún vano)
export function metrosTramo(t, escala) {
  let total = 0;
  for (let i = 1; i < t.puntos.length; i++) { const m = metrosVano(t, i, escala); if (m === null) return null; total += m; }
  return total;
}

// Distancias entre puntos etiquetados a lo largo de cada tramo (los vértices que coinciden con la punta de una etiqueta).
// Usa los metros escritos a mano y, donde no hay, la escala; un trecho con algún vano sin metros no sale.
export function tablaDistancias(elementos, escala, tol = 12) {
  const etiquetas = elementos.filter(e => e.tipo === 'etiqueta');
  const filas = [];
  elementos.filter(e => e.tipo === 'polilinea' && e.puntos.length > 1).forEach(t => {
    let previo = null; let acumulado = 0; let completo = true;
    t.puntos.forEach((p, i) => {
      if (i) { const m = metrosVano(t, i, escala); if (m === null) completo = false; else acumulado += m; }
      const et = etiquetas.find(e => Math.hypot(e.tx - p[0], e.ty - p[1]) <= tol);
      if (!et) return;
      if (previo && completo) filas.push({ desde: previo.nombre, hasta: nombrePunto(et.texto), metros: acumulado - previo.en, tramo: t.tramo || 'bt' });
      previo = { nombre: nombrePunto(et.texto), en: acumulado }; completo = true;
    });
  });
  return filas;
}
// Total por tipo de tramo (solo los tramos con todos sus vanos medidos)
export function totalesPorTipo(elementos, escala) {
  const tot = {};
  elementos.filter(e => e.tipo === 'polilinea' && e.puntos.length > 1).forEach(t => {
    const m = metrosTramo(t, escala); if (m === null) return;
    const k = t.tramo || 'bt'; tot[k] = (tot[k] || 0) + m;
  });
  return Object.entries(tot).map(([k, m]) => ({ tipo: k, nombre: TIPOS_TRAMO[k]?.nombre || k, metros: m }));
}
// Nombre de cada vano para escribir sus metros: "P1 → P2" si los extremos tienen etiqueta, si no "punto 1 → 2"
export function nombresVanos(t, elementos, tol = 12) {
  const etiquetas = elementos.filter(e => e.tipo === 'etiqueta');
  const nom = (p, i) => { const et = etiquetas.find(e => Math.hypot(e.tx - p[0], e.ty - p[1]) <= tol); return et ? nombrePunto(et.texto) : `punto ${i + 1}`; };
  return t.puntos.slice(1).map((p, k) => `${nom(t.puntos[k], k)} → ${nom(p, k + 1)}`);
}

// Textos frecuentes de las etiquetas de punto (de las propuestas de red)
export const ACCIONES_PUNTO = ['Instalar transformador', 'Seccionar red BT', 'Remate de red BT', 'Poste de madera deteriorado', 'Cambio de poste', 'Puente al vuelo'];

// Largo "redondo" para la escala gráfica que quepa en `maxPx`
export function largoEscala(escala, maxPx) {
  if (!escala) return null;
  const opciones = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const cabe = opciones.filter(m => m / escala <= maxPx);
  return cabe.length ? cabe[cabe.length - 1] : null;
}
