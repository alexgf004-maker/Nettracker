// Inspección de las instalaciones del usuario (una por reclamo, en reclamos/{id}/inspeccion). Funciones puras.
// Reglas confirmadas por el equipo:
//   - Resistencia de puesta a tierra: hasta 25 Ω CUMPLE (NEC 2008, 250.56), arriba NO CUMPLE.
//   - Equipo dañado con rango de voltaje de placa: NO CUMPLE si la tensión estuvo fuera del rango más del 5 % del
//     tiempo (mismo criterio que el FEBNoPer). Se compara con el secundario equivalente si la medición es en MT con
//     relación TP; si no, con la tensión medida. Opcional ×√3 cuando la placa es fase-fase y la medición fase-neutro.
// Las fotos no se guardan en la app: el borrador deja un espacio para pegarlas.

export const LIMITE_TIERRA = 25; // Ω
export const UMBRAL_EQUIPO = 0.05; // fracción del tiempo fuera del rango de placa

export const TIPOS_SUBESTACION = ['Banco de transformadores', 'Transformador trifásico', 'Transformador pad mounted', 'Transformador monofásico', 'Otro'];
export const CONEXIONES = ['Estrella', 'Estrella aterrizada', 'Delta'];
export const BASES_EQUIPO = { directa: 'Tensión tal cual', ff: '×√3 (placa fase-fase, medición fase-neutro)' };

const num = v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

// Listas guardadas como objetos con claves de push → arreglo con su clave, en el orden en que se agregaron
export const lista = obj => Object.entries(obj || {}).map(([id, x]) => ({ id, ...x })).sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id.localeCompare(b.id));

export function kvaTotal(sub = {}) {
  const c = num(sub.cantidad); const k = num(sub.kva);
  return c && k ? c * k : k;
}

export function veredictoTierra(ohm) {
  const v = num(ohm);
  return v === null ? null : v <= LIMITE_TIERRA ? 'CUMPLE' : 'NO CUMPLE';
}

// ¿Tiene la inspección algo capturado?
export function inspeccionVacia(insp) {
  if (!insp) return true;
  const { fecha, atendio, circuito, subestacionDist, subestacion, medidor, tableros, equipos } = insp;
  return !fecha && !atendio && !circuito && !subestacionDist && !Object.values(subestacion || {}).some(Boolean)
    && !Object.values(medidor || {}).some(Boolean) && !lista(tableros).length && !lista(equipos).length;
}

// Tensión del equipo frente a su rango de placa.
// U: { fase: { v: [...] } } de leerTension; factor: relación TP (1 si no aplica); base: 'directa' | 'ff'
export function tensionVsEquipo(U, fases, { vmin, vmax, base = 'directa' }, factor = 1) {
  const lo = num(vmin); const hi = num(vmax);
  if (lo === null || hi === null || hi <= lo) return null;
  const k = (base === 'ff' ? Math.sqrt(3) : 1) / (factor || 1);
  const porFase = {};
  fases.filter(p => U[p]).forEach(p => {
    const v = U[p].v.filter(x => x !== null && x !== undefined).map(x => x * k);
    const arriba = v.filter(x => x > hi).length; const abajo = v.filter(x => x < lo).length;
    porFase[p] = { n: v.length, arriba, abajo, pArriba: v.length ? arriba / v.length : 0, pAbajo: v.length ? abajo / v.length : 0,
      max: v.length ? Math.max(...v) : null, min: v.length ? Math.min(...v) : null, prom: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null };
  });
  const peor = Math.max(0, ...Object.values(porFase).map(x => x.pArriba + x.pAbajo));
  return { vmin: lo, vmax: hi, porFase, peor, cumple: peor <= UMBRAL_EQUIPO };
}
