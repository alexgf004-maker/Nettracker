// Análisis de reclamos a partir de los TXT del ECAMEC. Funciones puras (sin Firebase ni estado).
// En reclamo se mide con doble intervalo y el equipo genera dos TXT de 10 minutos:
//   - tensión (74 columnas: U, I y P con máximos y mínimos, PST… y STOTAL en la columna 75 cuando viene)
//   - armónicos (197 columnas: Uarm/Iarm de la 1 a la 25 y PST)
// Traslado de las macros del equipo, respetando su lógica:
//   - GraficarTension3 (Graficar.xlsm): perfiles de tensión, corriente, PST y cargabilidad con su resumen.
//   - Armonicos_SIGET10 (Armónicos.xlsm): armónicos según SIGET Acuerdo 38-E-2015, Título V.
// Cambios confirmados por el equipo:
//   - STOTAL se busca por nombre y, si no, en la columna 75 (la macro tomaba la última columna,
//     que en un TXT sin STOTAL es PST3). Si no está, no hay cargabilidad.
// Diferencia con la macro de armónicos: las filas incompletas (menos de 194 campos) no se cuentan
// en ningún cálculo; la macro las dejaba como ceros. Se avisa cuántas hubo.
import { leerTXT, minutosDeFecha } from './analisis.js';

export const FASES = ['1', '2', '3'];

// Urbanidad y tipo de red con su tolerancia (macro GraficarTension3, paso 4)
export const TIPOS_RED = {
  urbano_mt: { label: 'Urbano / MT', tol: 0.06 },
  rural_mt: { label: 'Rural / MT', tol: 0.07 },
  urbano_bt: { label: 'Urbano / BT', tol: 0.07 },
  rural_bt: { label: 'Rural / BT', tol: 0.08 },
};
// Niveles de tensión nominal que propone la macro
export const NIVELES = [120, 240, 277, 480, 2400, 4160, 7620, 13200, 23000];
export const LIMITE_INVALIDO = 0.7; // registro inválido: fase por debajo del 70 % del nominal
export const UMBRAL_FT = 0.05; // FebNoPer > 5 % → fuera de tolerancia
export const CARGA_ALERTA = 0.85; // línea del 85 % de la capacidad del trafo
export const LIMITE_PST = 1;

const numero = v => (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
const val = v => numero(v) ?? 0; // Val() de VBA: lo que no es número vale 0

// ¿Qué TXT es? Por los encabezados
export function tipoDeTXT(texto) {
  const enc = (leerTXT(String(texto || '').split(/\r?\n/, 1)[0])[0] || []);
  if (enc.includes('Uarm1-1') && enc.includes('Iarm1-1')) return 'armonicos';
  if (enc.includes('U1 [V]')) return 'tension';
  return null;
}

// Percentil inclusivo con interpolación, como PERCENTILE de Excel. Ignora vacíos.
export function percentil(arr, p) {
  const s = arr.filter(x => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!s.length) return null;
  const k = (s.length - 1) * p; const i = Math.floor(k);
  return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * (k - i) : s[i];
}

// Máx, Prom y Mín de una serie (como MAX, AVERAGE y MIN de Excel: ignoran vacíos)
export function estadisticas(arr) {
  const v = arr.filter(x => x !== null && x !== undefined);
  if (!v.length) return { max: null, prom: null, min: null };
  return { max: Math.max(...v), prom: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v) };
}

// ── TXT DE TENSIÓN ──

export function leerTension(texto) {
  const filas = leerTXT(texto);
  if (filas.length <= 1) return null;
  const enc = filas[0];
  const datos = filas.slice(1).filter(f => minutosDeFecha(f[0]) > 0);
  if (!datos.length) return null;
  const col = n => enc.indexOf(n);
  const serie = c => (c < 0 ? null : datos.map(f => numero(f[c])));
  const t0 = minutosDeFecha(datos[0][0]);
  const out = {
    columnas: enc.length, n: datos.length, inicio: datos[0][0], fin: datos[datos.length - 1][0],
    fechas: datos.map(f => f[0]), t: datos.map(f => minutosDeFecha(f[0]) - t0), U: {}, I: {}, PST: {}, S: null, stotal: null,
  };
  FASES.forEach(p => {
    const v = serie(col(`U${p} [V]`));
    if (v) out.U[p] = { v, max: serie(col(`U${p}Max [V]`)), min: serie(col(`U${p}Min [V]`)) };
    const i = serie(col(`I${p} [A]`));
    if (i) out.I[p] = { v: i, max: serie(col(`I${p}Max [A]`)) };
    const pst = serie(col(`PST${p} [p.u]`));
    if (pst) out.PST[p] = pst;
  });
  if (!out.U['1']) return null;
  // STOTAL: por nombre; si no, la columna 75 (así lo deja el equipo cuando la agrega)
  let cS = enc.findIndex(h => h.toUpperCase().startsWith('STOTAL'));
  let origen = 'nombre';
  if (cS < 0 && enc.length >= 75) { cS = 74; origen = 'columna 75'; }
  if (cS >= 0) {
    out.S = serie(cS);
    out.stotal = { origen, encabezado: enc[cS] || '' };
  }
  return out;
}

// Fases que trae el TXT con tensión (mediana sobre el 5 % de la mayor): sugerencia del tipo de instalación
export function fasesConTension(U) {
  const mediana = arr => { const s = arr.filter(x => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const med = FASES.map(p => (U[p] ? mediana(U[p].v) : 0));
  const mayor = Math.max(...med);
  let n = 0;
  med.forEach((m, i) => { if (mayor > 0 && m > mayor * 0.05) n = i + 1; });
  return Math.max(1, n);
}

// Nivel nominal más cercano a la tensión medida (solo una sugerencia; lo confirma el usuario)
export function sugerirNominal(U) {
  const v = U?.['1']?.v?.filter(x => x !== null) || [];
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)];
  return NIVELES.reduce((a, b) => (Math.abs(b - med) < Math.abs(a - med) ? b : a));
}

export const fasesDe = n => FASES.slice(0, n);

// Resumen de la medición sobre la tensión promedio (macro: PASO 9)
// Inválido: alguna fase por debajo del 70 % del nominal. FT: alguna fase fuera de la banda.
export function resumenTension(U, nFases, nominal, tol) {
  const limSup = nominal * (1 + tol); const limInf = nominal * (1 - tol); const inv = nominal * LIMITE_INVALIDO;
  const fases = fasesDe(nFases);
  let total = 0; let invalidos = 0; let ft = 0;
  const n = U['1'].v.length;
  for (let i = 0; i < n; i++) {
    if (U['1'].v[i] === null) continue; // la macro salta la fila si U1 está vacía
    total++;
    const vs = fases.map(p => U[p]?.v[i] ?? 0);
    if (vs.some(v => v < inv)) { invalidos++; continue; }
    if (vs.some(v => v < limInf || v > limSup)) ft++;
  }
  const validos = total - invalidos;
  const febNoPer = validos > 0 ? ft / validos : 0;
  const estado = validos === 0 ? 'ERROR - NIVEL DE TENSIÓN INCORRECTO' : febNoPer > UMBRAL_FT ? 'FUERA DE TOLERANCIA' : 'DENTRO DE TOLERANCIA';
  return { total, invalidos, validos, ft, febNoPer, estado, limSup, limInf };
}

// Corriente máxima del trafo para la línea de la gráfica. Trifásico: kVA × 1000 / (√3 × V L-L)
// (corregido; la macro no dividía entre √3). Monofásico y bifásico: kVA × 1000 / V L-L.
export const corrienteMaxTrafo = (kva, vll, fases = 3) => (kva > 0 && vll > 0 ? (kva * 1000) / ((fases === 3 ? Math.sqrt(3) : 1) * vll) : null);

// STOTAL viene en VA: la macro lo pasa a kVA
export const cargabilidadKVA = S => (S ? S.map(x => (x === null ? null : x / 1000)) : null);

// Todo lo de la macro de tensión listo para mostrar y exportar
// params: { fases, nominal, tol, kva, vll, kvaCarga }
export function analizarTension(d, params) {
  const fases = fasesDe(params.fases).filter(p => d.U[p]);
  const est = (grupo, campo) => Object.fromEntries(fases.filter(p => grupo[p]?.[campo]).map(p => [p, estadisticas(grupo[p][campo])]));
  const S = cargabilidadKVA(d.S);
  return {
    fases,
    resumen: params.nominal > 0 ? resumenTension(d.U, params.fases, params.nominal, params.tol) : null,
    U: { v: est(d.U, 'v'), max: est(d.U, 'max'), min: est(d.U, 'min') },
    I: { v: est(d.I, 'v'), max: est(d.I, 'max') },
    pstP95: Object.fromEntries(fases.filter(p => d.PST[p]).map(p => [p, percentil(d.PST[p], 0.95)])),
    iMaxTrafo: corrienteMaxTrafo(params.kva, params.vll, params.fases),
    S, carga: S ? estadisticas(S) : null,
  };
}

// ── TXT DE ARMÓNICOS (Armonicos_SIGET10) ──

export const VDAT_LIM = 8;
export const DATI_LIM = 20;
export const P_UMBRAL = 3.5; // kW: a partir de aquí la corriente se evalúa en %, por debajo en A
export const PERC_MAX = 5; // % del tiempo fuera de límite permitido (Arts. 45 y 51)
export const MAX_HARM = 25;
export const ARMONICAS = Array.from({ length: MAX_HARM - 1 }, (_, i) => i + 2);
const CAMPOS_MIN = 194;

// Tabla 4: TDI de voltaje (%)
const TDI_V = { 5: 6, 7: 5, 11: 3.5, 13: 3, 17: 2, 19: 1.5, 23: 1.5, 25: 1.5, 3: 5, 9: 1.5, 15: 0.3, 21: 0.2, 2: 2, 4: 1, 6: 0.5, 8: 0.5, 10: 0.5, 12: 0.2 };
export const limTDI = n => TDI_V[n] ?? ((n % 2 === 1 && n % 3 !== 0) ? 0.2 + (1.3 * 25) / n : 0.2);
// Tabla 5: DAII de corriente (%), P >= 3.5 kW
const DAII = { 5: 12, 7: 8.5, 11: 4.3, 13: 3, 17: 2.7, 19: 1.9, 23: 1.6, 25: 1.6, 3: 16.6, 9: 2.2, 15: 0.6, 21: 0.4, 2: 10, 4: 2.5, 6: 1, 8: 0.8, 10: 0.8, 12: 0.4 };
export const limDAII = n => DAII[n] ?? ((n % 2 === 1 && n % 3 !== 0) ? 0.2 + (0.8 * 25) / n : 0.3);
// Tabla 5: intensidad armónica (A), P < 3.5 kW
const II_A = { 5: 2.28, 7: 1.54, 11: 0.66, 13: 0.42, 17: 0.26, 19: 0.24, 23: 0.2, 25: 0.18, 3: 4.6, 9: 0.8, 15: 0.3, 21: 0.21, 2: 2.16, 4: 0.86, 6: 0.6, 8: 0.46, 10: 0.37, 12: 0.31 };
export const limIiA = n => II_A[n] ?? (n % 2 === 1 ? 4.5 / n : 3.68 / n);

// nf: fases activas (1 mono, 2 bi, 3 tri)
export function analizarArmonicos(texto, nf) {
  const filas = leerTXT(texto);
  if (filas.length <= 1) return null;
  const datos = filas.slice(1);
  const completas = datos.filter(c => c.length >= CAMPOS_MIN);
  const fases = fasesDe(nf);
  const vacio = () => Object.fromEntries(fases.map(p => [p, []]));
  const porArm = () => Object.fromEntries(ARMONICAS.map(n => [n, vacio()]));
  const r = {
    n: completas.length, incompletas: datos.length - completas.length, nf, fases,
    fechas: [], P: vacio(), VDAT: vacio(), DATI: vacio(), TDI: porArm(), DAII: porArm(),
    vdatOver: {}, datiOver: {}, tdiOver: {}, daiiOver: {}, cargados: {},
  };
  fases.forEach(p => { r.vdatOver[p] = 0; r.datiOver[p] = 0; r.cargados[p] = 0; });
  ARMONICAS.forEach(n => { r.tdiOver[n] = {}; r.daiiOver[n] = {}; fases.forEach(p => { r.tdiOver[n][p] = 0; r.daiiOver[n][p] = 0; }); });

  for (const c of completas) {
    r.fechas.push(c[0]);
    const pTot = val(c[11]);
    fases.forEach((p, k) => {
      // P por fase; si viene en 0 pero PTotal indica carga, se reparte entre las fases activas (como la macro)
      let P = val(c[8 + k]);
      if (P === 0 && pTot > P_UMBRAL * nf) P = pTot / nf;
      r.P[p].push(P);
      const U = n => val(c[19 + (n - 1) * 3 + k]);
      const I = n => val(c[94 + (n - 1) * 4 + k]);
      const u1 = U(1); const i1 = I(1);
      // Voltaje: VDAT y TDI
      const vdat = u1 > 0 ? (Math.sqrt(ARMONICAS.reduce((s, n) => s + U(n) ** 2, 0)) / u1) * 100 : 0;
      r.VDAT[p].push(vdat);
      if (vdat > VDAT_LIM) r.vdatOver[p]++;
      ARMONICAS.forEach(n => {
        const tdi = u1 > 0 ? (U(n) / u1) * 100 : 0;
        r.TDI[n][p].push(tdi);
        if (tdi > limTDI(n)) r.tdiOver[n][p]++;
      });
      // Corriente: DATI y DAII (DATI solo se penaliza con P >= 3.5 kW, Art. 49a)
      const dati = i1 > 0 ? (Math.sqrt(ARMONICAS.reduce((s, n) => s + I(n) ** 2, 0)) / i1) * 100 : 0;
      r.DATI[p].push(dati);
      const cargado = P >= P_UMBRAL;
      if (cargado) r.cargados[p]++;
      if (cargado && dati > DATI_LIM) r.datiOver[p]++;
      ARMONICAS.forEach(n => {
        const d = i1 > 0 ? (I(n) / i1) * 100 : 0;
        r.DAII[n][p].push(d);
        // Por intervalo según el régimen (Art. 49/50): con carga en %, sin carga en amperios
        if (cargado ? d > limDAII(n) : I(n) > limIiA(n)) r.daiiOver[n][p]++;
      });
    });
  }
  if (!r.n) return r;

  const t0 = minutosDeFecha(r.fechas[0]);
  r.t = r.fechas.map(f => minutosDeFecha(f) - t0);
  r.inicio = r.fechas[0]; r.fin = r.fechas[r.n - 1];
  // P95 solo de los intervalos con carga (régimen en %), como P95Cargado
  const p95Cargado = (arr, p) => percentil(arr.filter((_, i) => r.P[p][i] >= P_UMBRAL), 0.95) ?? 0;
  const pct = over => (over / r.n) * 100;
  const fila = (nombre, limite, limTxt, p95, over) => {
    const out = { nombre, limite, limTxt, fases: {} };
    fases.forEach(p => { const x = pct(over[p]); out.fases[p] = { p95: p95[p], exc: over[p], pct: x, cumple: x <= PERC_MAX }; });
    return out;
  };
  const mapa = f => Object.fromEntries(fases.map(p => [p, f(p)]));
  // Formato "0.0##" de la macro: al menos un decimal y hasta tres
  const fmtLim = x => { const t = (Math.round(x * 1000) / 1000).toFixed(3).replace(/0{1,2}$/, ''); return t; };
  r.tension = [
    fila('VDAT (Total)', VDAT_LIM, '8.0%', mapa(p => percentil(r.VDAT[p], 0.95)), r.vdatOver),
    ...ARMONICAS.map(n => fila(`H${n} - TDI`, limTDI(n), fmtLim(limTDI(n)) + '%', mapa(p => percentil(r.TDI[n][p], 0.95)), r.tdiOver[n])),
  ];
  r.corriente = [
    fila('DATI (Total)', DATI_LIM, '20.0%', mapa(p => p95Cargado(r.DATI[p], p)), r.datiOver),
    ...ARMONICAS.map(n => fila(`H${n} - DAII`, limDAII(n), `${fmtLim(limDAII(n))}% / ${limIiA(n).toFixed(2)}A`, mapa(p => p95Cargado(r.DAII[n][p], p)), r.daiiOver[n])),
  ];
  // Espectros (hoja Graficos de la macro): P95 de todos los intervalos, también en corriente
  r.espectro = ARMONICAS.map(n => ({
    n, limTDI: limTDI(n), limDAII: limDAII(n),
    tdi: mapa(p => percentil(r.TDI[n][p], 0.95)), daii: mapa(p => percentil(r.DAII[n][p], 0.95)),
  }));
  // Veredicto por fase: no cumple si algún indicador pasa del 5 % del tiempo
  const veredicto = lista => mapa(p => lista.every(f => f.fases[p].cumple));
  r.cumpleTension = veredicto(r.tension);
  r.cumpleCorriente = veredicto(r.corriente);
  return r;
}

// Resumen corto que se guarda en el reclamo (para la lista y el Inicio)
export function resumenGuardado(tension, arm) {
  const out = {};
  if (tension?.resumen) out.tension = { febNoPer: tension.resumen.febNoPer, estado: tension.resumen.estado };
  // Flicker: no cumple si el percentil 95 del PST de alguna fase pasa de 1 (tabla de la macro)
  const pst = Object.values(tension?.pstP95 || {}).filter(v => v !== null);
  if (pst.length) out.flicker = pst.some(v => v > LIMITE_PST) ? 'NO CUMPLE' : 'CUMPLE';
  if (arm?.n) {
    const todas = obj => Object.values(obj).every(Boolean);
    out.armonicos = { tension: todas(arm.cumpleTension) ? 'CUMPLE' : 'NO CUMPLE', corriente: todas(arm.cumpleCorriente) ? 'CUMPLE' : 'NO CUMPLE' };
  }
  return out;
}
