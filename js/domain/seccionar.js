// Seccionamiento de carga (pedido del equipo): se corta el secundario en un poste (o, a veces, a media línea) y un lado
// de la red pasa a otro transformador, nuevo o existente. En el dibujo es un símbolo "seccionamiento" (dos barras
// rojas, circuito abierto) en el punto del corte: ahí la red se parte en dos redes (redDe no cruza el corte) y el lado
// que cambia lleva el color y el nombre de su transformador. En la situación actual la red se ve como antes (una sola).
// Funciones puras.
import { familiaTramo, nombrePunto, redDe } from './plano.js';

const centro = e => [e.x + 30 * e.escala, e.y + 30 * e.escala];
const cerca = (a, b, tol) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
export const esCorte = e => e?.tipo === 'simbolo' && e.simbolo === 'seccionamiento';

// Datos de cada vano del tramo (por número de vano, desde 1)
const POR_VANO = ['metros', 'metrosAncla', 'calibres', 'desfases', 'acometidas'];
function reindexar(t, nuevo) {
  const out = { ...t };
  POR_VANO.forEach(k => {
    if (!t[k]) return;
    const m = {};
    Object.entries(t[k]).forEach(([i, v]) => { nuevo(Number(i), v).forEach(([j, w]) => { if (w !== undefined && w !== null) m[j] = w; }); });
    if (Object.keys(m).length) out[k] = m; else delete out[k];
  });
  return out;
}

// Pone un vértice en p dentro del vano i (entre puntos[i-1] y puntos[i]); f: fracción del vano hasta p.
// Los metros escritos o anclados del vano se reparten en proporción; el calibre sigue en las dos partes.
export function insertarVertice(t, i, p, f) {
  const r = reindexar(t, (j, v) => {
    if (j < i) return [[j, v]];
    if (j > i) return [[j + 1, v]];
    return [[j, v], [j + 1, v]];
  });
  ['metros', 'metrosAncla'].forEach(k => {
    const v = Number(t[k]?.[i]);
    if (t[k]?.[i] !== undefined && Number.isFinite(v)) { r[k][i] = Math.round(v * f * 10) / 10; r[k][i + 1] = Math.round(v * (1 - f) * 10) / 10; }
  });
  if (r.desfases) { delete r.desfases[i]; delete r.desfases[i + 1]; }
  if (r.acometidas?.[i + 1]) delete r.acometidas[i + 1]; // las acometidas del vano quedan en la primera parte
  return { ...r, puntos: [...t.puntos.slice(0, i), p, ...t.puntos.slice(i)] };
}

// Parte el tramo en el vértice k (0 < k < último): dos tramos que se tocan en ese punto
export function partirEnVertice(t, k, nuevoId) {
  const a = reindexar(t, (j, v) => (j <= k ? [[j, v]] : []));
  const b = reindexar(t, (j, v) => (j > k ? [[j - k, v]] : []));
  return [{ ...a, puntos: t.puntos.slice(0, k + 1) }, { ...b, id: nuevoId, puntos: t.puntos.slice(k) }];
}

// Dónde cae p sobre el tramo: en un vértice ({ k }) o dentro de un vano ({ i, f, q } con q el punto sobre la línea)
export function puntoEnTramo(t, p, tol) {
  let mejor = null;
  t.puntos.forEach((q, k) => { const dd = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dd <= tol && (!mejor || dd < mejor.dd)) mejor = { k, dd }; });
  if (mejor) return { k: mejor.k };
  for (let i = 1; i < t.puntos.length; i++) {
    const [ax, ay] = t.puntos[i - 1]; const [bx, by] = t.puntos[i]; const dx = bx - ax; const dy = by - ay; const L = dx * dx + dy * dy; if (!L) continue;
    const f = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L)); const q = [ax + f * dx, ay + f * dy];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= tol && (!mejor || Math.hypot(q[0] - p[0], q[1] - p[1]) < mejor.dd)) mejor = { i, f, q, dd: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  }
  return mejor ? { i: mejor.i, f: mejor.f, q: mejor.q } : null;
}

// Secciona la red BT en p: el tramo que pasa por ahí se parte en dos (si el corte cae a media línea, se le pone un
// vértice). Devuelve { elementos, punto, angulo } (angulo: dirección de la línea, en grados) o null si no hay red BT ahí.
export function seccionar(elementos, p, tol, nuevoId) {
  const bt = elementos.filter(e => e.tipo === 'polilinea' && e.puntos?.length > 1 && familiaTramo(e.tramo) === 'bt');
  const toques = bt.map(t => ({ t, en: puntoEnTramo(t, p, tol) })).filter(x => x.en);
  if (!toques.length) return null;
  // El punto exacto: el vértice más cercano (un poste) o el punto sobre la línea
  const primero = toques.find(x => x.en.k !== undefined) || toques[0];
  const punto = primero.en.k !== undefined ? [...primero.t.puntos[primero.en.k]] : primero.en.q;
  let angulo = 0;
  const salida = [];
  elementos.forEach(e => {
    const x = toques.find(z => z.t === e);
    if (!x) { salida.push(e); return; }
    let t = e; let en = puntoEnTramo(t, punto, 0.5);
    if (!en) { salida.push(e); return; }
    if (en.i !== undefined) { t = insertarVertice(t, en.i, punto, en.f); en = { k: en.i }; }
    const a = t.puntos[Math.max(0, en.k - 1)]; const b = t.puntos[Math.min(t.puntos.length - 1, en.k + 1)];
    if (e === primero.t) angulo = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (en.k > 0 && en.k < t.puntos.length - 1) salida.push(...partirEnVertice(t, en.k, nuevoId()));
    else salida.push(t);
  });
  // Las barras quedan derechas (de -90° a 90°)
  if (angulo > 90) angulo -= 180; if (angulo <= -90) angulo += 180;
  return { elementos: salida, punto, angulo: Math.round(angulo * 10) / 10 };
}

// Nombre del punto en p (de la etiqueta que apunta ahí)
function nombreEn(elementos, p, tol) {
  const et = elementos.find(e => e.tipo === 'etiqueta' && cerca([e.tx, e.ty], p, tol));
  return et ? nombrePunto(et.texto) : '';
}
// Los dos (o más) lados del corte: cada red BT que llega al punto, con hacia dónde va ("P4")
export function ladosDe(elementos, corte, tol) {
  const p = centro(corte);
  const llegan = elementos.filter(e => e.tipo === 'polilinea' && e.puntos?.length > 1 && familiaTramo(e.tramo) === 'bt' && e.puntos.some(q => cerca(q, p, tol)));
  const lados = [];
  llegan.forEach(t => {
    if (lados.some(l => l.ids.includes(t.id))) return;
    const ids = redDe(elementos, t.id, tol);
    // El punto vecino al corte en este tramo (o la otra punta) para nombrar el lado
    const k = t.puntos.findIndex(q => cerca(q, p, tol)); const vecino = t.puntos[k === 0 ? 1 : k - 1]; const otra = t.puntos[k === 0 ? t.puntos.length - 1 : 0];
    lados.push({ tramo: t.id, ids, hacia: nombreEn(elementos, vecino, tol) || nombreEn(elementos, otra, tol) });
  });
  return lados;
}

// Estructura del poste al cortar (confirmado): tangente secundaria pasa a corte secundario con el mismo número
// (TS3 → CS3; con derivación TD1 → CD1). { antes, despues } solo con las que cambian.
export function estructurasCorte(estructuras) {
  const antes = []; const despues = [];
  (estructuras || []).forEach(c => { const m = /^T([SD])(\d+)$/i.exec(String(c).trim()); if (m) { antes.push(c); despues.push(`C${m[1].toUpperCase()}${m[2]}`); } });
  return { antes, despues };
}
// Poste (o símbolo con datos de poste) en el punto del corte
export const posteEn = (elementos, corte, tol) => elementos.find(e => e.tipo === 'simbolo' && ['poste', 'poste_nuevo', 'trafo', 'trafo_nuevo', 'banco'].includes(e.simbolo) && cerca(centro(e), centro(corte), tol));
// Las estructuras del poste con el corte aplicado (si se pidió el cambio)
export function conEstructuraCorte(poste, corte) {
  if (!poste || corte.cambiaEstructura === false) return null;
  const { antes } = estructurasCorte(poste.estructuras); if (!antes.length) return null;
  return (poste.estructuras || []).map(c => { const m = /^T([SD])(\d+)$/i.exec(String(c).trim()); return m ? `C${m[1].toUpperCase()}${m[2]}` : c; });
}

// Transformadores del dibujo para elegir cuál alimenta el lado que cambia: { id, nombre ("P6"), texto ("P6 · 37.5 kVA · proyectado") }
export function trafosDe(elementos, tol) {
  return elementos.filter(e => e.tipo === 'simbolo' && ['trafo', 'trafo_nuevo', 'banco'].includes(e.simbolo)).map(e => {
    const n = nombreEn(elementos, centro(e), tol); const kva = (e.trafos || []).filter(Boolean); const kt = kva.length ? `${kva.join(' + ')} kVA` : '';
    return { id: e.id, nombre: n || (kt ? `de ${kt}` : 'sin nombre'), texto: [n || 'Trafo', kt, /_nuevo$/.test(e.simbolo) ? 'proyectado' : ''].filter(Boolean).join(' · ') };
  });
}
