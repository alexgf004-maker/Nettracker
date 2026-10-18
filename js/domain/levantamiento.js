// Levantamiento de red en campo con GPS (levantamientos/{id}). Funciones puras.
// Un levantamiento tiene puntos (postes, transformadores, usuario…) con coordenadas y vanos que los unen. La distancia de
// cada vano sale de las coordenadas (precisión del GPS del celular: 3 a 10 m con buena señal) salvo que se escriban los
// metros medidos (cinta o telémetro), que mandan. Se pasa a la herramienta Dibujar como lámina y se exporta a KML.
import { TIPOS_TRAMO } from './plano.js';
import { medidaEtiqueta } from './dibujo.js';
import { hayAcometidas, sumaAcometidas, textoAcometidas, textoPoste } from './red.js';

// Tipos de punto que se marcan en campo (los mismos símbolos de red de Dibujar)
export const TIPOS_PUNTO = ['poste', 'poste_nuevo', 'puente', 'trafo', 'trafo_nuevo', 'banco', 'usuario', 'medidor_red', 'seccionador', 'medicion'];
export const PRECISION_BAJA = 15;
// Transformadores sobre un poste: kVA de cada unidad (una = transformador, varias = banco); también se escriben
export const KVA_TRAFO = ['5', '10', '15', '25', '37.5', '50', '75', '100', '167'];
export function textoTrafos(trafos) {
  const t = (trafos || []).filter(Boolean); if (!t.length) return '';
  if (t.length === 1) return `Trafo ${t[0]} kVA`;
  return `Banco ${t.every(k => k === t[0]) ? `${t.length} × ${t[0]}` : t.join(' + ')} kVA`;
}
// Símbolo con que se ve el punto: un poste con transformadores se ve como transformador (o banco si son varios)
export function simboloPunto(p) {
  const n = (p.trafos || []).filter(Boolean).length;
  if (!n || !['poste', 'poste_nuevo', 'trafo', 'trafo_nuevo', 'banco'].includes(p.tipo || 'poste')) return p.tipo || 'poste';
  if (p.tipo === 'poste_nuevo' || p.tipo === 'trafo_nuevo') return 'trafo_nuevo';
  return n > 1 ? 'banco' : p.tipo === 'banco' ? 'banco' : 'trafo';
}
// Estado inicial de la pantalla: marcar con GPS, poste, BT existente, unir al anterior, calles, seguir la ubicación
export const nuevaPantallaLev = () => ({ modo: 'gps', tipo: 'poste', tramo: 'bt', unir: true, actual: null, sel: null, unirDesde: null, movida: null, fondo: 'calles', seguir: true }); // m: se avisa antes de marcar con una precisión peor

const RADIO = 6371008.8; // m
const rad = g => (g * Math.PI) / 180;

// Distancia en metros entre dos coordenadas
export function distancia(a, b) {
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const listaPuntos = lev => Object.entries(lev?.puntos || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.orden || 0) - (b.orden || 0));
export const listaVanos = lev => Object.entries(lev?.vanos || {}).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.orden || 0) - (b.orden || 0));

// Metros de un vano: los medidos a mano mandan; si no, los del GPS
export function metrosDeVano(lev, v) {
  const m = Number(v.metros);
  if (v.metros !== undefined && v.metros !== null && v.metros !== '' && !Number.isNaN(m)) return { metros: m, origen: 'medido' };
  const a = lev.puntos?.[v.a]; const b = lev.puntos?.[v.b];
  return a && b ? { metros: distancia(a, b), origen: 'gps' } : { metros: null, origen: null };
}
export function resumenLevantamiento(lev) {
  const puntos = listaPuntos(lev); const vanos = listaVanos(lev);
  const total = vanos.reduce((s, v) => s + (metrosDeVano(lev, v).metros || 0), 0);
  return { puntos: puntos.length, postes: puntos.filter(p => /^poste/.test(p.tipo)).length, vanos: vanos.length, metros: total };
}

// Nombre automático del siguiente punto: P1, P2… (los que ya tienen nombre se respetan)
export function siguienteNombre(lev, prefijo = 'P') {
  const n = Math.max(0, ...listaPuntos(lev).map(p => Number(String(p.nombre || '').match(new RegExp(`^${prefijo}(\\d+)$`))?.[1] || 0)));
  return `${prefijo}${n + 1}`;
}

// Partir un vano con un punto nuevo en medio: A–B pasa a A–N y N–B, del mismo tipo. Los metros medidos de A–B no se
// pueden repartir, así que los dos vanos nuevos quedan con la distancia del GPS (hay que medirlos de nuevo).
export function cambiosPartirVano(v, nuevoId, keys) {
  const base = { tramo: v.tramo || 'bt' }; const o = Number(v.orden) || 0;
  return { [`vanos/${v.id}`]: null, [`vanos/${keys[0]}`]: { ...base, a: v.a, b: nuevoId, orden: o }, [`vanos/${keys[1]}`]: { ...base, a: nuevoId, b: v.b, orden: o + 0.5 } };
}

// Proyección local (metros al este y al norte del centro), suficiente para unos cuantos kilómetros
export function proyectar(puntos) {
  if (!puntos.length) return { a: () => [0, 0], centro: null };
  const lat0 = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length; const lng0 = puntos.reduce((s, p) => s + p.lng, 0) / puntos.length;
  const kx = RADIO * Math.cos(rad(lat0)) * Math.PI / 180; const ky = RADIO * Math.PI / 180;
  return { a: p => [(p.lng - lng0) * kx, (lat0 - p.lat) * ky], centro: { lat: lat0, lng: lng0 } };
}

// Lámina de Dibujar: croquis en blanco con el norte arriba y la escala exacta (m por px), postes, vanos con sus metros
// y una etiqueta por punto con su nombre, transformadores y nota.
export function aDibujo(lev, { ancho = 1600, alto = 1000, margen = 140 } = {}) {
  const puntos = listaPuntos(lev);
  const pr = proyectar(puntos);
  const xy = puntos.map(p => pr.a(p));
  const xs = xy.map(c => c[0]); const ys = xy.map(c => c[1]);
  const w = Math.max(20, Math.max(...xs, 0) - Math.min(...xs, 0)); const h = Math.max(20, Math.max(...ys, 0) - Math.min(...ys, 0));
  const k = Math.min((ancho - margen * 2) / w, (alto - margen * 2) / h); // px por metro
  const x0 = Math.min(...xs); const y0 = Math.min(...ys);
  const ox = (ancho - w * k) / 2; const oy = (alto - h * k) / 2;
  const pos = {};
  puntos.forEach((p, i) => { pos[p.id] = [ox + (xy[i][0] - x0) * k, oy + (xy[i][1] - y0) * k]; });
  const elementos = [];
  let n = 0; const id = () => `lev${n++}`;
  listaVanos(lev).forEach(v => {
    if (!pos[v.a] || !pos[v.b]) return;
    const m = metrosDeVano(lev, v);
    const conductor = v.calibre || v.conductor ? { ...(v.calibre ? { calibre: v.calibre } : {}), ...(v.conductor ? { tipo: v.conductor } : {}) } : null;
    elementos.push({ id: id(), tipo: 'polilinea', tramo: TIPOS_TRAMO[v.tramo] ? v.tramo : 'bt', color: '#000000', grosor: 6, puntos: [pos[v.a], pos[v.b]], metros: m.origen === 'medido' ? { 1: m.metros } : {}, ...(conductor ? { conductor } : {}), ...(hayAcometidas(v.acom) ? { acometidas: { 1: { a: Number(v.acom.a) || 0, b: Number(v.acom.b) || 0, d: Number(v.acom.d) || 0 } } } : {}) });
  });
  puntos.forEach(p => {
    const [x, y] = pos[p.id]; const escala = p.tipo === 'usuario' ? 0.8 : 0.6;
    const sim = simboloPunto(p);
    elementos.push({ id: id(), tipo: 'simbolo', simbolo: sim, color: SIMBOLO_COLOR[sim] || '#111827', grosor: 3, escala, rot: 0, x: x - 30 * escala, y: y - 30 * escala,
      ...(p.altura ? { altura: Number(p.altura) } : {}), ...(p.estructuras?.length ? { estructuras: [...p.estructuras] } : {}), ...(p.trafos?.length ? { trafos: [...p.trafos] } : {}) });
  });
  // Etiquetas: nombre y nota (en dos líneas) hacia el lado más libre de vanos, dentro de la lámina
  const vecinos = {};
  listaVanos(lev).forEach(v => { if (pos[v.a] && pos[v.b]) { (vecinos[v.a] ??= []).push(pos[v.b]); (vecinos[v.b] ??= []).push(pos[v.a]); } });
  const DIRS = [-90, -45, -135, 0, 180, 45, 135, 90].map(g => (g * Math.PI) / 180); // arriba primero
  const difAng = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
  puntos.forEach(p => {
    const [x, y] = pos[p.id];
    const texto = [p.nombre, textoTrafos(p.trafos), p.nota].filter(Boolean).join('\n');
    if (!texto) return;
    const proyectado = p.tipo === 'poste_nuevo' || p.tipo === 'trafo_nuevo';
    const tam = 22; const m = medidaEtiqueta({ texto, tam }, textoPoste(p));
    const angs = (vecinos[p.id] || []).map(([vx, vy]) => Math.atan2(vy - y, vx - x));
    // Puntaje: lo más lejos posible de los vanos, mejor arriba (abajo van los metros) y sin salirse de la lámina
    const caja = a => { const ux = Math.cos(a); const uy = Math.sin(a); const dist = 34 + Math.abs(ux) * m.w / 2 + Math.abs(uy) * m.h / 2; return [x + ux * dist - m.w / 2, y + uy * dist - m.h / 2]; };
    const puntaje = (a, i) => {
      const libre = (angs.length ? Math.min(...angs.map(b => difAng(a, b))) : Math.PI) * 180 / Math.PI;
      const [bx, by] = caja(a); const fuera = bx < 8 || by < 8 || bx + m.w > ancho - 8 || by + m.h > alto - 8;
      return Math.min(libre, 90) - (fuera ? 200 : 0) - (Math.sin(a) > 0.3 ? 30 : 0) - i;
    };
    const dir = DIRS.map((a, i) => ({ a, p: puntaje(a, i) })).sort((p, q) => q.p - p.p)[0].a;
    const [bx, by] = caja(dir);
    const ex = Math.max(8, Math.min(ancho - m.w - 8, bx)); const ey = Math.max(8, Math.min(alto - m.h - 8, by));
    elementos.push({ id: id(), tipo: 'etiqueta', estilo: p.tipo === 'usuario' ? 'destacado' : proyectado ? 'proyectado' : 'existente', texto, tam, tx: x, ty: y, x: ex, y: ey });
  });
  return { fondo: null, elementos, escala: 1 / k, lienzo: { w: ancho, h: alto } };
}
const SIMBOLO_COLOR = { puente: '#0f766e', poste: '#111827', poste_nuevo: '#2563eb', trafo: '#15803d', trafo_nuevo: '#2563eb', banco: '#15803d', usuario: '#dc2626', medidor_red: '#0f172a', seccionador: '#ea580c', medicion: '#f59e0b' };

// KML para Google Earth o My Maps: un punto por poste y una línea por vano
export function kmlLevantamiento(lev, nombresTipo = {}) {
  const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const puntos = listaPuntos(lev);
  const pm = puntos.map(p => `<Placemark><name>${x(p.nombre || '')}</name><description>${x([nombresTipo[p.tipo] || p.tipo, textoTrafos(p.trafos), p.altura ? `${p.altura}'` : '', (p.estructuras || []).join(' / '), p.nota, p.acc ? `Precisión ±${Math.round(p.acc)} m` : ''].filter(Boolean).join(' · '))}</description><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`).join('');
  const ln = listaVanos(lev).map(v => {
    const a = lev.puntos?.[v.a]; const b = lev.puntos?.[v.b]; if (!a || !b) return '';
    const m = metrosDeVano(lev, v);
    return `<Placemark><name>${x(`${a.nombre || ''} – ${b.nombre || ''}`)}</name><description>${x([TIPOS_TRAMO[v.tramo]?.nombre || '', [v.calibre, v.conductor].filter(Boolean).join(' '), textoAcometidas(v.acom), `${m.metros?.toFixed(1)} m (${m.origen === 'medido' ? 'medido' : 'GPS'})`].filter(Boolean).join(' · '))}</description><LineString><coordinates>${a.lng},${a.lat},0 ${b.lng},${b.lat},0</coordinates></LineString></Placemark>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(lev.nombre || 'Levantamiento')}</name>${pm}${ln}</Document></kml>`;
}

// Acometidas de todo el levantamiento (los vanos y las pendientes del próximo vano)
export const acometidasLevantamiento = lev => sumaAcometidas([...listaVanos(lev).map(v => v.acom), lev?.pendiente]);
