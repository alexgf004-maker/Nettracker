// Borrador del informe de un reclamo con lo que la app ya tiene: datos del expediente, de la instalación y el
// análisis de los TXT. Funciones puras: devuelven bloques (títulos, párrafos, tablas y marcas de gráfica) que
// js/docx.js convierte en un Word para terminarlo a mano. Lo que la app no sabe queda como [completar].
// Redacción y artículos citados como en los informes CPT (SIGET, Acuerdo 38-E-2015).
import { DATI_LIM, estadisticas, LIMITE_PST, P_UMBRAL, percentil, TIPOS_RED, UMBRAL_FT, VDAT_LIM } from './reclamo.js';

export const COMPLETAR = '[completar]';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ORDINAL_FASE = { 1: 'U1', 2: 'U2', 3: 'U3' };

// Números con punto decimal, como en los informes
const n = (v, dec = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(dec));
const pct = (v, dec = 2) => `${n(v, dec)}%`;
// "a, b y c"
export const enumerar = arr => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} y ${arr[arr.length - 1]}`);

// "dd/mm/aaaa hh:mm:ss" → { d, m, a, hora }
function partesFecha(f) {
  const [fecha, hora = ''] = String(f || '').split(' ');
  const [d, m, a] = fecha.split('/').map(Number);
  return d && m && a ? { d, m, a, hora: hora.slice(0, 5) } : null;
}
// Periodo como en los títulos: "16 al 24 de julio del 2026" (o "28 de julio al 3 de agosto del 2026")
export function periodoTexto(inicio, fin) {
  const a = partesFecha(inicio); const b = partesFecha(fin);
  if (!a || !b) return COMPLETAR;
  if (a.a !== b.a) return `${a.d} de ${MESES[a.m - 1]} del ${a.a} al ${b.d} de ${MESES[b.m - 1]} del ${b.a}`;
  if (a.m === b.m && a.d === b.d) return `${a.d} de ${MESES[a.m - 1]} del ${a.a}`;
  if (a.m !== b.m) return `${a.d} de ${MESES[a.m - 1]} al ${b.d} de ${MESES[b.m - 1]} del ${b.a}`;
  return `${a.d} al ${b.d} de ${MESES[b.m - 1]} del ${b.a}`;
}
const fechaCorta = f => { const p = partesFecha(f); return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.a} ${p.hora}` : '—'; };
const fechaISO = iso => { const [a, m, d] = String(iso || '').split('-'); return a && m && d ? `${d}/${m}/${a}` : COMPLETAR; };

// "22290/240" → { texto, factor: 92.875, primario: 22290, secundario: 240 }
export function leerRelacion(txt) {
  const m = String(txt || '').replace(/\s/g, '').match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const primario = Number(m[1]); const secundario = Number(m[2]);
  return secundario > 0 ? { texto: `${m[1]}/${m[2]}`, factor: primario / secundario, primario, secundario } : null;
}

// Intervalo de registro en minutos (el más común entre registros seguidos)
export function intervaloMinutos(t) {
  const cuenta = {};
  for (let i = 1; i < t.length; i++) { const d = t[i] - t[i - 1]; if (d > 0) cuenta[d] = (cuenta[d] || 0) + 1; }
  const [mejor] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0] || [];
  return mejor ? Number(mejor) : null;
}

// Máximo y mínimo de una serie con la fecha en que ocurrieron
function extremos(v, fechas) {
  let iMax = -1; let iMin = -1;
  v.forEach((x, i) => {
    if (x === null || x === undefined) return;
    if (iMax < 0 || x > v[iMax]) iMax = i;
    if (iMin < 0 || x < v[iMin]) iMin = i;
  });
  return iMax < 0 ? null : { max: v[iMax], fMax: fechas[iMax], min: v[iMin], fMin: fechas[iMin] };
}

// ── Corrientes: desbalance y ciclo diario ──
// Desbalance por intervalo: mayor desviación respecto al promedio de las fases ÷ promedio (solo con corriente).
export function analizarCorrientes(d, fases) {
  const series = fases.map(p => d.I[p]?.v).filter(Boolean);
  if (series.length < 1) return null;
  const porFase = Object.fromEntries(fases.filter(p => d.I[p]).map(p => [p, { ...estadisticas(d.I[p].v), ...extremos(d.I[p].v, d.fechas) }]));
  const desb = [];
  if (series.length > 1) {
    for (let i = 0; i < d.n; i++) {
      const vs = series.map(s => s[i]);
      if (vs.some(x => x === null || x === undefined)) continue;
      const prom = vs.reduce((a, b) => a + b, 0) / vs.length;
      if (prom > 0) desb.push((Math.max(...vs.map(x => Math.abs(x - prom))) / prom) * 100);
    }
  }
  // Promedio de la corriente total por hora del día
  const horas = Array.from({ length: 24 }, () => ({ s: 0, c: 0 }));
  for (let i = 0; i < d.n; i++) {
    const vs = series.map(s => s[i]);
    if (vs.some(x => x === null || x === undefined)) continue;
    const h = partesFecha(d.fechas[i]); if (!h) continue;
    const hh = Number(h.hora.slice(0, 2));
    horas[hh].s += vs.reduce((a, b) => a + b, 0); horas[hh].c++;
  }
  const perfil = horas.map((x, h) => ({ h, prom: x.c ? x.s / x.c : null })).filter(x => x.prom !== null);
  const pico = perfil.reduce((a, b) => (!a || b.prom > a.prom ? b : a), null);
  const valle = perfil.reduce((a, b) => (!a || b.prom < a.prom ? b : a), null);
  const orden = Object.entries(porFase).filter(([, e]) => e.max !== null).sort((a, b) => b[1].max - a[1].max);
  return {
    porFase,
    mayor: orden[0] ? { fase: orden[0][0], max: orden[0][1].max } : null,
    menor: orden.length > 1 ? { fase: orden[orden.length - 1][0], max: orden[orden.length - 1][1].max } : null,
    desbalance: desb.length ? { prom: desb.reduce((a, b) => a + b, 0) / desb.length, p95: percentil(desb, 0.95), max: Math.max(...desb) } : null,
    pico, valle,
  };
}

// "3 fases" o "F1 y F3"
const fasesNo = lista => (lista.length === 3 ? '3 fases' : enumerar(lista.map(f => 'F' + f)));

// "la Fase 1 y la Fase 3" o "las tres fases"
const enFases = (lista, total) => (lista.length === total && total > 1 ? (total === 3 ? 'las tres fases' : 'las dos fases') : enumerar(lista.map(f => 'la Fase ' + f)));
// Agrupa por orden: "H5 (F1 40.00%, F2 50.00%)"
const porOrden = lista => [...new Set(lista.map(o => o.nombre))].map(nom => `${nom} (${lista.filter(o => o.nombre === nom).map(o => `F${o.fase} ${pct(o.p95)}`).join(', ')})`);

// Armónicos que no cumplen (orden individual) de una lista del análisis: [{ orden, fase, p95, limite }]
function ordenesFuera(lista, fases) {
  const out = [];
  lista.slice(1).forEach(f => fases.forEach(p => { if (!f.fases[p].cumple) out.push({ nombre: f.nombre.split(' ')[0], fase: p, p95: f.fases[p].p95, limite: f.limite}); }));
  return out;
}

// ── Borrador completo ──
// datos: { exp, inst, params, d, t, arm, hoy }
export function borradorInforme({ exp = {}, inst = {}, params = {}, d = null, t = null, arm = null, hoy = '' }) {
  const B = [];
  const h = (texto, nivel = 1) => B.push({ t: 'h', texto, nivel });
  const p = texto => B.push({ t: 'p', texto });
  const vineta = texto => B.push({ t: 'vineta', texto });
  const tabla = (encabezado, filas, opts = {}) => B.push({ t: 'tabla', encabezado, filas, ...opts });
  const grafica = texto => B.push({ t: 'grafica', texto });
  const formula = texto => B.push({ t: 'formula', texto });

  const usuario = exp.nombre || params.usuario || COMPLETAR;
  const red = TIPOS_RED[params.red] || TIPOS_RED.urbano_mt;
  const enMT = /_mt$/.test(params.red || 'urbano_mt');
  const tol = red.tol; const tolTxt = `±${Math.round(tol * 100)}%`;
  const nominal = Number(params.nominal) || 0;
  const relV = leerRelacion(params.relV); const relI = leerRelacion(params.relI);
  const fases = t?.fases || arm?.fases || ['1', '2', '3'];
  const periodo = d ? periodoTexto(d.inicio, d.fin) : arm?.n ? periodoTexto(arm.inicio, arm.fin) : COMPLETAR;
  const punto = inst.reclamo?.punto || '';
  const conclusiones = []; const bullets = [];

  B.push({ t: 'titulo', texto: `INFORME DE RECLAMO ${exp.codigo || inst.caso || ''}`.trim(), sub: `${usuario}${exp.ct ? ' · ' + exp.ct : ''}` });
  B.push({ t: 'nota', texto: `Borrador generado por NetTracker${hoy ? ' el ' + fechaISO(hoy) : ''} con los datos del expediente y el análisis de los TXT${punto ? ` del punto ${punto}` : ''}. Revisar y completar lo marcado ${COMPLETAR} antes de entregar.` });

  // 1. Generalidades
  h('1. GENERALIDADES');
  tabla(['Característica', 'Detalle'], [
    ['Usuario', usuario],
    ['NC (ID de usuario)', exp.nc || COMPLETAR],
    ['Dirección', exp.direccion || COMPLETAR],
    ['Referencia eléctrica (CT)', exp.ct || COMPLETAR],
    ['Circuito / Subestación', COMPLETAR],
    ['Tensión nominal', nominal ? `${nominal} V` : COMPLETAR],
    ['Urbanidad y red', `${red.label} (${tolTxt})`],
    ['Código de reclamo / WO', [exp.codigo || inst.caso, exp.wo].filter(Boolean).join(' / ') || COMPLETAR],
    ['Tipo de reclamo', exp.motivo || COMPLETAR],
  ], { anchos: [35, 65] });

  // 2. Equipo de medición
  h('2. EQUIPO DE MEDICIÓN UTILIZADO');
  p(`La medición de calidad de energía se realizó mediante un analizador de red conectado en ${punto ? `el punto ${punto}` : 'el punto de entrega del usuario'}.`);
  const intT = d ? intervaloMinutos(d.t) : null; const intA = arm?.t ? intervaloMinutos(arm.t) : null;
  tabla(['Característica', 'Detalle'], [
    ['Analizador de redes', [inst.modelo, inst.serie].filter(Boolean).join(': ') || COMPLETAR],
    ['Puntos de conexión', punto || inst.lugar || COMPLETAR],
    ['Fecha de instalación', fechaISO(inst.fechaInstalacion)],
    ['Fecha de retiro', fechaISO(inst.fechaRetiroReal || inst.fechaRetiro)],
    ['Factor multiplicador', relV || relI ? [relV && `Voltaje= ${relV.texto}`, relI && `Corriente= ${relI.texto}`].filter(Boolean).join('   ') : COMPLETAR],
    ['Intervalo de regulación de tensión', intT ? `${intT} minutos` : COMPLETAR],
    ['Intervalo de armónicos / flicker', intA ? `${intA} minutos` : intT ? `${intT} minutos` : COMPLETAR],
    ['Total de registros', [d && `${d.n} registros (tensión)`, arm?.n && `${arm.n} registros (armónicos)`].filter(Boolean).join(' · ') || COMPLETAR],
  ], { anchos: [35, 65] });

  // 3. Inspección: no está en la app todavía
  h('3. INSPECCIÓN DE INSTALACIONES DEL USUARIO');
  p(`${COMPLETAR} Subestación, medidor de facturación, tablero, puesta a tierra y equipo dañado.`);

  // 4. Mediciones
  h(`4. MEDICIONES – ${usuario}`);
  p(`El usuario ${usuario}${exp.direccion ? `, ubicado en ${exp.direccion},` : ''} está asociado a la referencia eléctrica ${exp.ct || COMPLETAR}, alimentado desde el circuito ${COMPLETAR}.`);

  let sub4 = 0; const h4 = texto => h(`4.${++sub4}. ${texto}`, 2);
  if (d && t?.resumen) {
    const r = t.resumen;
    h4(`Resultados de calidad de energía en ${enMT ? 'media' : 'baja'} tensión – ${periodo}`);
    p(`Con base en la normativa SIGET de la Calidad de Servicio en Sistemas de Distribución (Calidad de Producto Técnico), Artículo 23, referido por el acuerdo 38-E-2015, se establecen los límites admisibles. Debido a que la medición fue tomada en ${enMT ? 'media' : 'baja'} tensión y el usuario está clasificado como ${red.label.split(' / ')[0]}, le corresponde un límite admisible de ${tolTxt}.`);
    p(`Para determinar si el nivel de tensión se encuentra dentro de los parámetros establecidos por la normativa, el artículo 22 del mismo documento indica que este se evaluará mediante la media de los valores eficaces RMS instantáneos medidos en el punto de entrega en un intervalo de tiempo. A continuación, se presenta la media de los valores eficaces medidos en intervalo de ${intT || COMPLETAR} minutos.`);
    grafica(`Perfil de tensión promedio con las bandas de ${tolTxt} (Excel de tensión, hoja "Tensión promedio")`);
    p(`Para la medición del usuario mostrada en el gráfico anterior, se obtuvo un total de ${r.total} registros, de los cuales se obtuvieron ${r.invalidos} ${r.invalidos === 1 ? 'registro inválido' : 'registros inválidos'} y ${r.ft} ${r.ft === 1 ? 'registro' : 'registros'} fuera de tolerancia, por lo tanto, el FEBNoPer queda de la siguiente manera:`);
    formula(`FEBNoPer = NtrgNoPer / NrgTOT = ${r.ft} / (${r.total} − ${r.invalidos}) × 100% = ${pct(r.febNoPer * 100)}`);
    p('La tabla mostrada a continuación corresponde al resumen estadístico de los registros que conforman el perfil de tensión mostrado en el gráfico:');
    const est = t.U.v;
    tabla(['Parámetro', ...fases.map(f => `U${f} [V]`)], [['Máx', 'max'], ['Prom', 'prom'], ['Mín', 'min']].map(([l, k]) => [l, ...fases.map(f => n(est[f]?.[k], 2))]), { anchos: [25, ...fases.map(() => 75 / fases.length)] });
    // Extremos respecto al nominal
    const ext = fases.map(f => ({ f, e: extremos(d.U[f].v, d.fechas) })).filter(x => x.e);
    if (ext.length && nominal) {
      const alto = ext.reduce((a, b) => (b.e.max > a.e.max ? b : a)); const bajo = ext.reduce((a, b) => (b.e.min < a.e.min ? b : a));
      const dev = v => `${v >= nominal ? '+' : '−'}${n(Math.abs(v / nominal - 1) * 100, 2)}% del nominal`;
      p(`La tensión promedio más alta fue de ${n(alto.e.max, 2)} V en la fase ${ORDINAL_FASE[alto.f]} (${fechaCorta(alto.e.fMax)}, ${dev(alto.e.max)}) y la más baja de ${n(bajo.e.min, 2)} V en la fase ${ORDINAL_FASE[bajo.f]} (${fechaCorta(bajo.e.fMin)}, ${dev(bajo.e.min)}). La banda admisible es de ${n(r.limInf, 2)} V a ${n(r.limSup, 2)} V.`);
    }
    const cumpleTension = r.febNoPer <= UMBRAL_FT && r.validos > 0;
    conclusiones.push([`Regulación de tensión (${enMT ? 'MT' : 'BT'})`, `${tolTxt} (Art. 22-23)`, `FEBNoPer ${pct(r.febNoPer * 100, 1)}`, cumpleTension ? 'CUMPLE' : 'NO CUMPLE']);
    bullets.push(`Regulación de tensión. En el punto de medición, ${cumpleTension
      ? `la tensión se mantuvo dentro de la banda de tolerancia de ${tolTxt} (Art. 22-23) respecto a la tensión nominal de ${nominal} V durante el período del ${periodo}, con ${r.ft} ${r.ft === 1 ? 'registro' : 'registros'} fuera de tolerancia (FEBNoPer ${pct(r.febNoPer * 100)}, por debajo del 5%). La tensión entregada cumple desde la óptica normativa.`
      : `${r.ft} de ${r.validos} registros válidos quedaron fuera de la banda de ${tolTxt} (Art. 22-23) respecto a la tensión nominal de ${nominal} V durante el período del ${periodo} (FEBNoPer ${pct(r.febNoPer * 100)}, mayor al 5%). La tensión entregada no cumple con la calidad de producto exigida.`}`);

    // Perfil secundario: la tensión de MT sin la relación del TP
    if (enMT && relV) {
      h4('Perfil de tensión secundario');
      p(`Se removió la relación de transformación aplicada en la medición (${relV.texto} = ${n(relV.factor, 3)}) a fin de obtener el valor equivalente de tensión en el lado secundario correspondiente al punto de entrega. ${COMPLETAR} Justificar si es representativo de la tensión en las instalaciones del usuario.`);
      const sec = Object.fromEntries(fases.map(f => [f, estadisticas(d.U[f].v.map(x => (x === null ? null : x / relV.factor)))]));
      const sup = relV.secundario * (1 + tol); const inf = relV.secundario * (1 - tol);
      const fuera = fases.map(f => d.U[f].v.filter(x => x !== null && (x / relV.factor > sup || x / relV.factor < inf)).length);
      grafica(`Perfil de tensión secundario equivalente con las bandas de ${tolTxt} sobre ${relV.secundario} V`);
      tabla(['Parámetro', ...fases.map(f => `U${f} [V]`)], [['Máx', 'max'], ['Prom', 'prom'], ['Mín', 'min']].map(([l, k]) => [l, ...fases.map(f => n(sec[f][k], 2))]), { anchos: [25, ...fases.map(() => 75 / fases.length)] });
      p(`Respecto a ${relV.secundario} V ${tolTxt} (${n(inf, 1)} V a ${n(sup, 1)} V), ${fuera.every(x => x === 0) ? 'ningún registro del secundario equivalente queda fuera de la banda' : `quedan fuera de la banda ${enumerar(fases.map((f, i) => `${fuera[i]} registros en ${ORDINAL_FASE[f]}`))}`}.`);
    }

    // Corrientes
    const ic = analizarCorrientes(d, fases);
    if (ic) {
      h4('Perfil de corriente medido');
      p(relI ? `Las corrientes se proyectan al primario mediante la RTC verificada (${relI.texto}).` : 'Corrientes promedio por fase en el punto de medición.');
      grafica('Perfil de corrientes promedio (Excel de tensión, hoja "Corriente promedio")');
      tabla(['Parámetro', ...fases.filter(f => ic.porFase[f]).map(f => `I${f} [A]`)], [['Máx', 'max'], ['Prom', 'prom'], ['Mín', 'min']].map(([l, k]) => [l, ...fases.filter(f => ic.porFase[f]).map(f => n(ic.porFase[f][k], 2))]), { anchos: [25, ...fases.map(() => 75 / fases.length)] });
      let txt = '';
      const hora = x => `${String(x % 24).padStart(2, '0')}:00`;
      if (ic.pico && ic.valle && ic.pico.prom > ic.valle.prom) txt += `En promedio, la mayor demanda se presenta entre las ${hora(ic.pico.h)} y las ${hora(ic.pico.h + 1)} horas (${n(ic.pico.prom, 1)} A sumando las fases) y la menor entre las ${hora(ic.valle.h)} y las ${hora(ic.valle.h + 1)} horas (${n(ic.valle.prom, 1)} A). `;
      if (ic.mayor && ic.menor && ic.mayor.max > ic.menor.max) txt += `La fase I${ic.mayor.fase} es la de mayor magnitud (máximo de ${n(ic.mayor.max, 2)} A) e I${ic.menor.fase} la de menor magnitud (máximo de ${n(ic.menor.max, 2)} A). `;
      if (ic.desbalance) txt += `El desbalance de corrientes (mayor desviación respecto al promedio de las fases) fue en promedio de ${pct(ic.desbalance.prom, 1)}, con un percentil 95 de ${pct(ic.desbalance.p95, 1)}.`;
      if (txt) p(txt.trim());
    }
  }

  // Flicker
  const pst = t ? fases.filter(f => d?.PST[f]) : [];
  if (pst.length) {
    const p95 = t.pstP95;
    const picos = Object.fromEntries(pst.map(f => [f, d.PST[f].filter(x => x !== null && x > LIMITE_PST).length]));
    const cumple = pst.every(f => p95[f] !== null && p95[f] <= LIMITE_PST);
    const valores = enumerar(pst.map(f => n(p95[f], 4)));
    h4('Perfil de distorsión por efecto parpadeo flicker');
    p('La distorsión flicker debe ser medida por el índice de severidad de efecto de parpadeo a corto plazo (Pst), según el Artículo 41 de la normativa de Calidad del Servicio de los Sistemas de Distribución vigente, y no debe superar el límite unitario. Para este cálculo se han tomado en cuenta el percentil 95% de los registros de Pst medidos.');
    grafica('Perfil de distorsión por efecto parpadeo con el límite Pst = 1 (Excel de tensión, hoja "PST")');
    const totalPicos = pst.reduce((a, f) => a + picos[f], 0);
    const fasesTxt = enumerar(pst.map(f => ORDINAL_FASE[f]));
    p(`El índice Pst, evaluado por percentil 95, resultó en ${valores} para ${pst.length > 1 ? 'las fases' : 'la fase'} ${fasesTxt} respectivamente, ${cumple ? 'dentro del' : 'por encima del'} límite unitario establecido (Art. 41).${totalPicos ? ` Se ${totalPicos === 1 ? 'observa 1 registro puntual que supera' : `observan ${totalPicos} registros puntuales que superan`} el límite de referencia (${enumerar(pst.filter(f => picos[f]).map(f => `${picos[f]} en ${ORDINAL_FASE[f]}`))}); ${cumple ? 'sin embargo, dado que el criterio normativo de evaluación se basa en el percentil 95 y no en el valor máximo instantáneo, el indicador cumple.' : 'el indicador no cumple.'}` : ''}`);
    conclusiones.push(['Flicker Pst', 'P95 ≤ 1.00 (Art. 41)', pst.map(f => n(p95[f], 3)).join(' / '), cumple ? 'CUMPLE' : 'NO CUMPLE']);
    bullets.push(`Flicker. El índice Pst, evaluado por percentil 95, resultó en ${valores} para ${pst.length > 1 ? 'las fases' : 'la fase'} ${fasesTxt}, ${cumple ? 'dentro del límite unitario establecido (Art. 41). El indicador cumple.' : 'por encima del límite unitario establecido (Art. 41). El indicador no cumple.'}`);
  }

  // 5. Armónicos
  if (arm?.n) {
    const af = arm.fases;
    h(`5. ANÁLISIS DE ARMÓNICOS – ${usuario}`);
    // Tensión
    const vdat = arm.tension[0];
    const vdatCumple = af.filter(f => vdat.fases[f].cumple);
    const fueraV = ordenesFuera(arm.tension, af);
    h('5.1. Perfil de espectro armónico de voltaje', 2);
    grafica('Espectro armónico de voltaje, TDI percentil 95 con el límite SIGET (Excel de armónicos, hoja "Graficos")');
    let tv = `El VDAT total, evaluado por su percentil 95, ${vdatCumple.length === af.length ? `cumple en ${af.length > 1 ? enFases(af, af.length) : 'la fase'}` : `no cumple en ${enFases(af.filter(f => !vdat.fases[f].cumple), af.length)}`} (${enumerar(af.map(f => pct(vdat.fases[f].p95)))} frente al límite de ${VDAT_LIM}%).`;
    const ordenesV = [...new Set(fueraV.map(o => o.nombre))];
    if (fueraV.length) tv += ` ${vdatCumple.length === af.length ? 'No obstante, ' : 'Además, '}${enumerar(ordenesV.map(nom => { const l = fueraV.filter(o => o.nombre === nom); return `el armónico individual ${nom} incumple su límite propio (${pct(l[0].limite)}) en ${enFases(l.map(o => o.fase), af.length)}, con ${l.length === 1 ? 'un valor' : 'valores'} de ${enumerar(l.map(o => pct(o.p95)))}`; }))}.`;
    else tv += ' Ningún armónico individual supera su límite de la Tabla 4.';
    p(tv);
    // Corriente
    const dati = arm.corriente[0];
    const fueraI = ordenesFuera(arm.corriente, af);
    const sinCarga = af.filter(f => !arm.cargados[f]);
    h('5.2. Perfil de espectro armónico de corriente', 2);
    grafica('Espectro armónico de corriente, DAII percentil 95 con el límite SIGET (Excel de armónicos, hoja "Graficos")');
    let ti = `El DATI, evaluado por su percentil 95 en los intervalos con potencia mayor o igual a ${P_UMBRAL} kW (Art. 49a), resultó en ${enumerar(af.map(f => pct(dati.fases[f].p95)))} frente al límite de ${DATI_LIM}%, por lo que ${af.every(f => dati.fases[f].cumple) ? 'cumple' : `no cumple en ${enFases(af.filter(f => !dati.fases[f].cumple), af.length)}`}.`;
    if (af.every(f => arm.cargados[f] === arm.n)) ti += ` Todos los intervalos tuvieron una potencia mayor o igual a ${P_UMBRAL} kW.`;
    else ti += ` Hubo ${enumerar(af.map(f => `${arm.cargados[f]} de ${arm.n} intervalos con carga en la Fase ${f}`))}; en los intervalos por debajo de ${P_UMBRAL} kW cada armónico se evalúa en amperios (Tabla 5).`;
    if (sinCarga.length) ti += ` En ${enumerar(sinCarga.map(f => 'la Fase ' + f))} no hubo intervalos con carga, por lo que el porcentaje no es representativo y la evaluación es en amperios.`;
    if (fueraI.length) ti += ` Incumplen su límite individual ${enumerar(porOrden(fueraI))}.`;
    // Órdenes con mayor contenido de corriente (promedio de las fases del P95)
    const dominantes = arm.espectro.map(e => ({ n: e.n, v: af.reduce((s, f) => s + (e.daii[f] || 0), 0) / af.length })).sort((a, b) => b.v - a.v).slice(0, 3).filter(x => x.v > 0);
    if (dominantes.length) ti += ` Los órdenes con mayor contenido armónico de corriente son ${enumerar(dominantes.map(x => `H${x.n} (${pct(x.v)})`))}.`;
    p(ti);
    tabla(['Indicador', 'Límite', ...af.map(f => `P95 F${f}`), 'Veredicto'], [
      [vdat.nombre, vdat.limTxt, ...af.map(f => pct(vdat.fases[f].p95)), af.every(f => vdat.fases[f].cumple) ? 'CUMPLE' : 'NO CUMPLE'],
      ...[...new Set(fueraV.map(o => o.nombre))].map(nom => { const f = arm.tension.find(x => x.nombre.startsWith(nom + ' ')); return [f.nombre, f.limTxt, ...af.map(x => pct(f.fases[x].p95)), 'NO CUMPLE']; }),
      [dati.nombre, dati.limTxt, ...af.map(f => pct(dati.fases[f].p95)), af.every(f => dati.fases[f].cumple) ? 'CUMPLE' : 'NO CUMPLE'],
      ...[...new Set(fueraI.map(o => o.nombre))].map(nom => { const f = arm.corriente.find(x => x.nombre.startsWith(nom + ' ')); return [f.nombre, f.limTxt, ...af.map(x => pct(f.fases[x].p95)), 'NO CUMPLE']; }),
    ], { veredicto: true });

    conclusiones.push(['Armónicos de tensión (VDAT)', `${VDAT_LIM}% (Art. 45/Tabla 4)`, af.map(f => pct(vdat.fases[f].p95)).join(' / '),
      vdatCumple.length === af.length ? 'CUMPLE (VDAT total)' : `NO CUMPLE (${fasesNo(af.filter(f => !vdat.fases[f].cumple))})`]);
    if (fueraV.length) conclusiones.push(['Armónicos individuales de tensión', 'Tabla 4 (Art. 45)', porOrden(fueraV).join(' / '), 'NO CUMPLE']);
    const datiNo = af.filter(f => !dati.fases[f].cumple);
    conclusiones.push(['Armónicos de corriente (DATI)', `${DATI_LIM}% (Art. 49-51/Tabla 5)`, af.map(f => pct(dati.fases[f].p95)).join(' / '),
      datiNo.length ? `NO CUMPLE (${fasesNo(datiNo)})` : 'CUMPLE']);
    if (fueraI.length) conclusiones.push(['Armónicos individuales de corriente', 'Tabla 5 (Art. 49-51)', [...new Set(fueraI.map(o => o.nombre))].join(', '), 'NO CUMPLE']);
    bullets.push(`Armónicos de tensión. ${tv}`);
    bullets.push(`Armónicos de corriente. El DATI, evaluado por su percentil 95, ${datiNo.length ? `no cumple en ${enFases(datiNo, af.length)}` : 'cumple en todas las fases'} (${enumerar(af.map(f => pct(dati.fases[f].p95)))} frente al límite de ${DATI_LIM}%).${fueraI.length ? ` Incumplen su límite individual ${enumerar([...new Set(fueraI.map(o => o.nombre))])}.` : ''}${datiNo.length || fueraI.length ? ' La distorsión armónica de corriente le compete al usuario.' : ''}`);
  }

  // 6 y 7: datos que la app no tiene
  h('6. ANÁLISIS DE CALIDAD DEL SERVICIO');
  p(`${COMPLETAR} Interrupciones momentáneas y sostenidas del año y SAIFI/SAIDI frente a los límites.`);
  h('7. ANÁLISIS DEL EVENTO REPORTADO POR EL USUARIO');
  p(`${COMPLETAR} Contraste con la bitácora de operaciones.`);

  // 8. Conclusiones
  h('8. CONCLUSIONES');
  conclusiones.push(['Continuidad (SAIFI/SAIDI)', '8 / 16 h', COMPLETAR, COMPLETAR]);
  tabla(['Parámetro', 'Límite SIGET', 'Resultado', 'Veredicto'], conclusiones, { veredicto: true, anchos: [30, 24, 26, 20] });
  bullets.forEach(vineta);

  h('9. RECOMENDACIONES');
  p(COMPLETAR);
  return B;
}
