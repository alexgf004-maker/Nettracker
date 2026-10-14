// Diagnóstico de armónicos a partir del análisis del TXT (analizarArmonicos) y, si hay, de la inspección.
// Funciones puras. Partes confirmadas por el equipo:
//   - Contexto en amperios: con poca carga el % de corriente se infla aunque la corriente armónica sea pequeña.
//   - Tipo de carga por los órdenes dominantes de corriente.
//   - Origen (red o usuario), siempre como INDICIO con la evidencia; la conclusión la decide quien firma.
//   - Severidad (veces el límite) y perfil horario.
// Umbrales propios de este diagnóstico (descriptivos, no normativos):
//   - Correlación entre la distorsión de tensión y la corriente armónica del usuario: r ≥ 0.6 indicio de aporte del
//     usuario; r ≤ 0.2 indicio de que viene de la red; en medio, no concluyente.
//   - Orden "dominante": de los tres con mayor DAII P95 promedio de las fases.
import { limDAII, limTDI, P_UMBRAL, percentil } from './reclamo.js';

export const R_USUARIO = 0.6;
export const R_RED = 0.2;
const TRIPLENS = [3, 9, 15, 21];

const n2 = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d));
const enumerar = arr => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`);
const mediana = arr => percentil(arr, 0.5);
const hora = h => `${String(h % 24).padStart(2, '0')}:00`;

// Correlación de Pearson (null si alguna serie no varía)
export function correlacion(a, b) {
  const pares = a.map((x, i) => [x, b[i]]).filter(([x, y]) => x !== null && y !== null && x !== undefined && y !== undefined && !Number.isNaN(x) && !Number.isNaN(y));
  const n = pares.length; if (n < 3) return null;
  const mx = pares.reduce((s, [x]) => s + x, 0) / n; const my = pares.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  pares.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
  // Una serie que prácticamente no varía no permite correlacionar
  const quieta = (ss, m) => ss / n <= (Math.abs(m) * 1e-6) ** 2 + 1e-18;
  return quieta(sxx, mx) || quieta(syy, my) ? null : sxy / Math.sqrt(sxx * syy);
}

// Promedio por hora del día: [{ h, prom }]
export function perfilHorario(serie, fechas) {
  const horas = Array.from({ length: 24 }, () => ({ s: 0, c: 0 }));
  serie.forEach((v, i) => {
    const hh = Number(String(fechas[i] || '').split(' ')[1]?.slice(0, 2));
    if (v === null || v === undefined || Number.isNaN(hh)) return;
    horas[hh].s += v; horas[hh].c++;
  });
  return horas.map((x, h) => ({ h, prom: x.c ? x.s / x.c : null })).filter(x => x.prom !== null);
}
const extremosHora = perfil => perfil.length ? { pico: perfil.reduce((a, b) => (b.prom > a.prom ? b : a)), valle: perfil.reduce((a, b) => (b.prom < a.prom ? b : a)) } : null;

// Tipo de carga característico de los órdenes dominantes
export function tipoDeCarga(ordenes) {
  const top = ordenes.map(o => o.n);
  const tiene = (...ns) => ns.every(x => top.includes(x));
  const out = [];
  if (tiene(5, 7) || (top[0] === 5)) out.push({ clave: 'seisPulsos', texto: 'convertidores de 6 pulsos (variadores de frecuencia, rectificadores trifásicos o UPS)', ordenes: [5, 7] });
  if (tiene(11, 13)) out.push({ clave: 'docePulsos', texto: 'convertidores de 12 pulsos', ordenes: [11, 13] });
  if (top.includes(3) || top.includes(9)) out.push({ clave: 'monofasicas', texto: 'cargas monofásicas no lineales (fuentes conmutadas de equipo de cómputo, iluminación LED o fluorescente)', ordenes: [3, 9] });
  if (top.some(x => x % 2 === 0)) out.push({ clave: 'pares', texto: 'rectificación de media onda, cargas con componente de corriente directa o saturación de transformadores', ordenes: top.filter(x => x % 2 === 0) });
  return out;
}

// opts: { enMT, subestacion (normalizada), cargas (checklist de la inspección) }
export function diagnosticarArmonicos(arm, { enMT = false, subestacion = {}, cargas = {} } = {}) {
  if (!arm?.n || !arm.I1) return null;
  const fases = arm.fases;
  const parrafos = [];

  // ── 1. Contexto en amperios ──
  const amp = fases.map(p => {
    const cargados = arm.cargados[p]; const fracCarga = arm.n ? cargados / arm.n : 0;
    return { fase: p, i1: mediana(arm.I1[p]), ihP95: percentil(arm.IhA[p], 0.95), datiP95: arm.corriente[0].fases[p].p95, fracCarga, cumple: arm.corriente[0].fases[p].cumple };
  });
  const i1Max = Math.max(...amp.map(a => a.i1 || 0));
  // Fases donde el % se infla: no cumple el DATI y casi no hubo carga (Art. 49) o su corriente es mucho menor que la de las otras fases
  const infladas = amp.filter(a => !a.cumple && (a.fracCarga < 0.5 || (i1Max > 0 && a.i1 < i1Max * 0.25)));
  const amperios = { fases: amp, infladas: infladas.map(a => a.fase) };
  if (infladas.length) {
    const sinCarga = infladas.filter(a => a.fracCarga < 0.5);
    parrafos.push(`En ${enumerar(infladas.map(a => `la Fase ${a.fase}`))} el DATI resulta elevado en porcentaje (${enumerar(infladas.map(a => `${n2(a.datiP95)}%`))}) con una corriente fundamental baja (mediana de ${enumerar(infladas.map(a => `${n2(a.i1, 1)} A`))}${i1Max ? `, frente a ${n2(i1Max, 1)} A de la fase más cargada` : ''}) y una corriente armónica total de ${enumerar(infladas.map(a => `${n2(a.ihP95, 2)} A`))} (P95). Con tan poca corriente el porcentaje se dispara aunque la corriente armónica en amperios sea pequeña, por lo que conviene leerlo junto con su valor en amperios.${sinCarga.length ? ` En ${enumerar(sinCarga.map(a => `la Fase ${a.fase}`))} la mayor parte del tiempo la potencia fue menor a ${P_UMBRAL} kW, régimen en el que, conforme al Art. 49, la corriente se evalúa en amperios.` : ''}`);
  }

  // ── 2. Órdenes dominantes y tipo de carga ──
  const dominantes = arm.espectro.map(e => ({ n: e.n, v: fases.reduce((s, p) => s + (e.daii[p] || 0), 0) / fases.length }))
    .sort((a, b) => b.v - a.v).slice(0, 3).filter(x => x.v > 0);
  const tipos = tipoDeCarga(dominantes);
  if (dominantes.length && tipos.length) {
    const vfd = cargas?.vfd && tipos.some(t => t.clave === 'seisPulsos');
    const compu = (cargas?.computo || cargas?.led) && tipos.some(t => t.clave === 'monofasicas');
    parrafos.push(`El espectro de corriente está dominado por ${enumerar(dominantes.map(x => `H${x.n} (${n2(x.v)}%)`))}, patrón característico de ${enumerar(tipos.map(t => t.texto))}.${vfd ? ' Esto concuerda con los variadores de frecuencia identificados en la inspección.' : ''}${compu ? ' Esto concuerda con las cargas electrónicas identificadas en la inspección.' : ''}`);
  }

  // ── 3. Origen: ¿la distorsión de tensión sigue a la corriente armónica del usuario? ──
  const porFase = fases.map(p => ({ fase: p, r: correlacion(arm.VDAT[p], arm.IhA[p]) }));
  const rs = porFase.map(x => x.r).filter(x => x !== null);
  const rProm = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  // Órdenes de tensión que no cumplen (o el mayor si todos cumplen) con su correlación propia
  const ordenesV = arm.tension.slice(1).filter(f => fases.some(p => !f.fases[p].cumple)).map(f => Number(f.nombre.match(/H(\d+)/)[1]));
  const porOrden = ordenesV.map(o => ({ n: o, r: correlacion(fases.flatMap(p => arm.TDI[o][p]), fases.flatMap(p => arm.IA[o][p])) }));
  const lectura = r => (r === null ? null : r >= R_USUARIO ? 'usuario' : r <= R_RED ? 'red' : 'incierto');
  const origen = { porFase, rProm, indicio: lectura(rProm), porOrden: porOrden.map(o => ({ ...o, indicio: lectura(o.r) })) };
  if (rProm !== null) {
    const base = `La correlación entre la distorsión de tensión (VDAT) y la corriente armónica del usuario a lo largo del período fue de ${enumerar(porFase.filter(x => x.r !== null).map(x => `${n2(x.r)} en la Fase ${x.fase}`))}.`;
    const texto = origen.indicio === 'usuario' ? ' La distorsión de tensión aumenta cuando el usuario inyecta más corriente armónica, lo que sugiere que las cargas del usuario contribuyen a la distorsión de tensión medida.'
      : origen.indicio === 'red' ? ' La distorsión de tensión no sigue a la corriente armónica del usuario, lo que sugiere que proviene principalmente de la red de distribución (otras cargas conectadas al circuito) y no de la instalación del usuario.'
        : ' La relación es débil, por lo que los datos no permiten atribuir con claridad la distorsión de tensión a la red o al usuario.';
    parrafos.push(base + texto);
  }
  origen.porOrden.filter(o => o.r !== null).forEach(o => {
    parrafos.push(`Para el armónico H${o.n} de tensión, que incumple su límite, la correlación con la corriente H${o.n} del usuario fue de ${n2(o.r)}: ${o.indicio === 'usuario' ? 'indicio de aporte del usuario' : o.indicio === 'red' ? 'indicio de que proviene de la red' : 'no concluyente'}.`);
  });
  // Conexión del transformador: un devanado en delta atrapa la secuencia cero (triplens)
  const delta = subestacion.tipo === 'tri' && [subestacion.conexionPri, subestacion.conexionSec].includes('Delta');
  const triplensV = ordenesV.filter(o => TRIPLENS.includes(o));
  origen.delta = delta;
  if (enMT && delta) {
    parrafos.push(`El transformador del usuario tiene un devanado en delta (${subestacion.conexionPri || '—'} en el primario, ${subestacion.conexionSec || '—'} en el secundario), en el que circulan las corrientes armónicas triplen (H3, H9, H15, H21) de las cargas del usuario sin pasar a la red de media tensión. Por ello, ${triplensV.length ? `el ${enumerar(triplensV.map(o => 'H' + o))} de tensión medido en media tensión` : 'los armónicos triplen de tensión medidos en media tensión'} no ${triplensV.length === 1 ? 'puede atribuirse' : 'pueden atribuirse'} a las cargas del usuario, lo que es un indicio de que ${triplensV.length === 1 ? 'proviene' : 'provienen'} de la red.`);
  }

  // ── 4. Perfil horario ──
  const vdatProm = arm.VDAT[fases[0]].map((_, i) => fases.reduce((s, p) => s + (arm.VDAT[p][i] || 0), 0) / fases.length);
  const ihTot = arm.IhA[fases[0]].map((_, i) => fases.reduce((s, p) => s + (arm.IhA[p][i] || 0), 0));
  const hv = extremosHora(perfilHorario(vdatProm, arm.fechas)); const hi = extremosHora(perfilHorario(ihTot, arm.fechas));
  const horario = { tension: hv, corriente: hi };
  if (hv && hi && hv.pico.prom > hv.valle.prom) {
    let tx = `La distorsión de tensión es mayor en promedio entre las ${hora(hv.pico.h)} y las ${hora(hv.pico.h + 1)} horas (VDAT ${n2(hv.pico.prom)}%) y menor entre las ${hora(hv.valle.h)} y las ${hora(hv.valle.h + 1)} horas (${n2(hv.valle.prom)}%).`;
    // Corriente casi pareja todo el día (el máximo horario no pasa de 1.2 veces el mínimo): no tiene sentido comparar horas
    if (hi.valle.prom > 0 && hi.pico.prom / hi.valle.prom < 1.2) tx += ` La corriente armónica del usuario se mantiene prácticamente constante a lo largo del día (entre ${n2(hi.valle.prom, 1)} y ${n2(hi.pico.prom, 1)} A).`;
    else {
      const mismas = Math.min(Math.abs(hv.pico.h - hi.pico.h), 24 - Math.abs(hv.pico.h - hi.pico.h)) <= 2;
      tx += ` La corriente armónica del usuario es mayor entre las ${hora(hi.pico.h)} y las ${hora(hi.pico.h + 1)} horas (${n2(hi.pico.prom, 1)} A). ${mismas ? 'Ambos máximos coinciden en horario.' : 'Los máximos no coinciden en horario.'}`;
    }
    parrafos.push(tx);
  }

  // ── 5. Severidad: veces el límite y % del tiempo fuera ──
  const severidad = (lista, lim) => lista.slice(1).filter(f => fases.some(p => !f.fases[p].cumple)).map(f => {
    const o = Number(f.nombre.match(/H(\d+)/)[1]);
    // Corriente de una fase sin intervalos con carga (P < 3.5 kW): se compara en amperios
    const enA = p => f.limiteA && f.fases[p].cargados === 0;
    const valor = p => (enA(p) ? f.fases[p].p95A / f.limiteA : (f.fases[p].p95 || 0) / (lim(o) || 1));
    const peor = fases.reduce((a, p) => (!a || valor(p) > valor(a) ? p : a), null);
    const x = f.fases[peor];
    if (enA(peor)) return { n: o, limite: f.limiteA, unidad: 'A', fase: peor, p95: x.p95A, veces: x.p95A / f.limiteA, pctTiempo: Math.max(...fases.map(p => f.fases[p].pct)) };
    return { n: o, limite: lim(o), unidad: '%', fase: peor, p95: x.p95, veces: lim(o) ? x.p95 / lim(o) : null, pctTiempo: Math.max(...fases.map(p => f.fases[p].pct)) };
  }).sort((a, b) => (b.veces || 0) - (a.veces || 0));
  const sev = { tension: severidad(arm.tension, limTDI), corriente: severidad(arm.corriente, limDAII) };

  return { amperios, dominantes, tipos, origen, horario, severidad: sev, parrafos };
}
