// Series de voltaje y corriente de un TXT de ECAMEC, para graficarlas. Funciones puras.
// Encabezados del TXT: "U1 [V]", "U1Max [V]", "U1Min [V]" … "I1 [A]", "I1Max [A]", "I1Min [A]" …
import { leerTXT, minutosDeFecha } from './analisis.js';

export const FASES = ['1', '2', '3'];
const redondear = (v, dec) => (v === null ? null : Math.round(v * 10 ** dec) / 10 ** dec);
const numero = v => (v === '' || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

// Devuelve { inicio, t: [minutos desde el inicio], U: { '1': { v, min, max } … }, I: { '1': { v, max } … }, sinCorriente }
// o null si no hay datos. Solo se toman las columnas que existen.
export function extraerSeries(texto) {
  const filas = leerTXT(texto);
  if (filas.length <= 1) return null;
  const enc = filas[0];
  const col = n => enc.indexOf(n);
  const datos = filas.slice(1).filter(f => minutosDeFecha(f[0]) > 0);
  if (!datos.length) return null;
  const t0 = minutosDeFecha(datos[0][0]);
  const serie = (c, dec) => (c < 0 ? null : datos.map(f => redondear(numero(f[c]), dec)));
  const out = { inicio: datos[0][0], fin: datos[datos.length - 1][0], t: datos.map(f => minutosDeFecha(f[0]) - t0), U: {}, I: {} };
  FASES.forEach(p => {
    const v = serie(col(`U${p} [V]`), 1);
    if (v) out.U[p] = { v, min: serie(col(`U${p}Min [V]`), 1) || v, max: serie(col(`U${p}Max [V]`), 1) || v };
    const i = serie(col(`I${p} [A]`), 2);
    if (i) out.I[p] = { v: i, max: serie(col(`I${p}Max [A]`), 2) || i };
  });
  if (!Object.keys(out.U).length) return null;
  // Si el TXT trae corriente con otro nombre, se informa para ajustarlo
  if (!Object.keys(out.I).length) out.sinCorriente = enc.filter(h => /\[A\]/.test(h)).slice(0, 6);
  return out;
}

// Firebase guarda los arreglos sin los null: se reconstruyen con su largo original
export const completar = (arr, n) => Array.from({ length: n }, (_, i) => (arr?.[i] ?? null));

// Fases con datos: su mediana pasa del 5 % de la mayor mediana (descarta fases en cero o con ruido)
export function fasesActivas(grupo) {
  const mediana = arr => { const s = arr.filter(x => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const med = Object.fromEntries(Object.entries(grupo).map(([p, s]) => [p, mediana(s.v)]));
  const mayor = Math.max(0, ...Object.values(med));
  return Object.keys(grupo).filter(p => mayor > 0 && med[p] > mayor * 0.05);
}

// Resumen de una fase de voltaje contra la banda: mínimo, máximo y % de registros fuera
export function resumenFase(s, limites) {
  const v = s.v.filter(x => x !== null);
  const fuera = limites ? v.filter(x => x < limites.inf || x > limites.sup).length : 0;
  return { min: Math.min(...s.min.filter(x => x !== null)), max: Math.max(...s.max.filter(x => x !== null)), prom: v.reduce((a, b) => a + b, 0) / (v.length || 1), fueraPct: v.length ? fuera / v.length : 0 };
}

// Fecha y hora de un punto ("dd/mm hh:mm")
export function fechaDePunto(inicio, minutos) {
  const base = minutosDeFecha(inicio);
  const d = new Date((base + minutos) * 60000);
  const dos = n => String(n).padStart(2, '0');
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}
