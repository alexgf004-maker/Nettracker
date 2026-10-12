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
export function ajustar([x, y], lista, tol, excluir = null) {
  let mejor = null; let dmin = tol;
  lista.forEach(a => { if (a.id === excluir) return; const d = Math.hypot(a.x - x, a.y - y); if (d <= dmin) { dmin = d; mejor = a; } });
  return mejor ? [mejor.x, mejor.y] : [x, y];
}

// Nombre corto de una etiqueta: "P1: DS111267" → "P1"
export const nombrePunto = t => String(t || '').split(/[:\n]/)[0].trim();

// Distancias entre puntos etiquetados a lo largo de cada tramo (los vértices que coinciden con la punta de una etiqueta)
export function tablaDistancias(elementos, escala, tol = 12) {
  if (!escala) return [];
  const etiquetas = elementos.filter(e => e.tipo === 'etiqueta');
  const filas = [];
  elementos.filter(e => e.tipo === 'polilinea' && e.puntos.length > 1).forEach(t => {
    let previo = null; let acumulado = 0;
    t.puntos.forEach((p, i) => {
      if (i) acumulado += Math.hypot(p[0] - t.puntos[i - 1][0], p[1] - t.puntos[i - 1][1]);
      const et = etiquetas.find(e => Math.hypot(e.tx - p[0], e.ty - p[1]) <= tol);
      if (!et) return;
      if (previo) filas.push({ desde: previo.nombre, hasta: nombrePunto(et.texto), metros: (acumulado - previo.en) * escala, tramo: t.tramo || 'bt' });
      previo = { nombre: nombrePunto(et.texto), en: acumulado };
    });
  });
  return filas;
}
// Total por tipo de tramo
export function totalesPorTipo(elementos, escala) {
  if (!escala) return [];
  const tot = {};
  elementos.filter(e => e.tipo === 'polilinea').forEach(t => { const k = t.tramo || 'bt'; tot[k] = (tot[k] || 0) + longitud(t.puntos) * escala; });
  return Object.entries(tot).map(([k, m]) => ({ tipo: k, nombre: TIPOS_TRAMO[k]?.nombre || k, metros: m }));
}

// Largo "redondo" para la escala gráfica que quepa en `maxPx`
export function largoEscala(escala, maxPx) {
  if (!escala) return null;
  const opciones = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const cabe = opciones.filter(m => m / escala <= maxPx);
  return cabe.length ? cabe[cabe.length - 1] : null;
}
