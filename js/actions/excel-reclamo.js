// Excel del análisis de un reclamo, con las hojas y gráficas que generan las macros del equipo:
// - Tensión (GraficarTension3): una hoja por gráfica con los datos, sus límites, el resumen y la gráfica.
// - Armónicos (Armonicos_SIGET10): Detalle_V, Detalle_I, Resumen_Armonicos, Resumen_Compacto y Graficos.
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { ARMONICAS, CARGA_ALERTA, DATI_LIM, LIMITE_PST, PERC_MAX, TIPOS_RED, VDAT_LIM } from '../domain/reclamo.js';
import { descargarXlsx, escribirConGraficas, rango } from '../excel-graficas.js';
import { analisisActivo, calculoReclamo } from '../views/analisis-reclamo.js';

// Colores de fase de los informes CPT (los de las macros)
const COLOR_FASE = { 1: 'FFC000', 2: '0070C0', 3: 'FF0000' };
const COLOR_FASE_ARM = { 1: 'FFC000', 2: '0070C0', 3: 'C00000' };
const FUENTE = 'Century Gothic';
const borde = { style: 'thin', color: { rgb: 'BFBFBF' } };
const BORDES = { top: borde, bottom: borde, left: borde, right: borde };
const st = (fondo, { color = 'FFFFFF', negrita = true, sz = 9, centro = true, fmt = null, borde: b = true, italica = false } = {}) => ({
  font: { name: FUENTE, sz, bold: negrita, italic: italica, color: { rgb: color } },
  ...(fondo ? { fill: { patternType: 'solid', fgColor: { rgb: fondo } } } : {}),
  alignment: { horizontal: centro ? 'center' : 'left', vertical: 'center', wrapText: true },
  ...(b ? { border: BORDES } : {}),
  ...(fmt ? { numFmt: fmt } : {}),
});
const NORMAL = st(null, { color: '000000', negrita: false });

// Escribe una celda (col y fila desde 0)
function celda(ws, c, r, v, s = NORMAL) {
  const ref = XLSX.utils.encode_cell({ c, r });
  ws[ref] = typeof v === 'number' ? { t: 'n', v, s } : { t: 's', v: v ?? '', s };
  if (s?.numFmt) ws[ref].z = s.numFmt;
}
function cerrarHoja(ws, cols, filas) {
  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: cols - 1, r: filas - 1 } });
}

// "dd/mm/aaaa hh:mm:ss" → "d/m/aaaa hh:mm" (como la escribe la macro)
function fechaMacro(f) {
  const [fecha, hora = ''] = String(f).split(' ');
  const [d, m, a] = fecha.split('/');
  return `${Number(d)}/${Number(m)}/${a} ${hora.slice(0, 5)}`;
}
const intervaloMin = t => (t.length > 1 && t[1] > t[0] ? t[1] - t[0] : 15);
const saltoEtiquetas = t => Math.min(48, Math.max(1, Math.round(240 / intervaloMin(t)))); // etiqueta cada ~4 horas

const AZUL_TABLA = '4472C4';

// Tabla Máx / Prom / Mín por fase (desde la fila r0, columna c0)
function tablaEstadistica(ws, c0, r0, titulos, est) {
  celda(ws, c0, r0, 'Parámetros', st(AZUL_TABLA));
  titulos.forEach((t, i) => celda(ws, c0 + 1 + i, r0, t.nombre, st(AZUL_TABLA)));
  [['Máx', 'max'], ['Prom', 'prom'], ['Mín', 'min']].forEach(([l, k], j) => {
    celda(ws, c0, r0 + 1 + j, l, st('D9E1F2', { color: '000000' }));
    titulos.forEach((t, i) => celda(ws, c0 + 1 + i, r0 + 1 + j, est[t.clave]?.[k] === null || est[t.clave]?.[k] === undefined ? '' : Math.round(est[t.clave][k] * 1000) / 1000, st(null, { color: '000000', negrita: false, fmt: '0.000' })));
  });
}

// Hoja de una gráfica de la macro de tensión
function hojaPerfil({ fechas, t, series, limites = [], titulo, usuario, escalaY = null, tablas }) {
  const ws = {};
  const n = fechas.length;
  celda(ws, 0, 0, 'Fecha/Hora', st('0E7490'));
  series.forEach((s, i) => celda(ws, 1 + i, 0, s.nombre, st('0E7490')));
  limites.forEach((l, i) => celda(ws, 1 + series.length + i, 0, l.nombre, st('0E7490')));
  const sinBorde = st(null, { color: '000000', negrita: false, borde: false, centro: false });
  const num = st(null, { color: '000000', negrita: false, borde: false, fmt: '0.000' });
  for (let i = 0; i < n; i++) {
    celda(ws, 0, i + 1, fechaMacro(fechas[i]), sinBorde);
    series.forEach((s, k) => { const v = s.v[i]; if (v !== null && v !== undefined) celda(ws, 1 + k, i + 1, v, num); });
    limites.forEach((l, k) => celda(ws, 1 + series.length + k, i + 1, Math.round(l.valor * 1000) / 1000, num));
  }
  let ultFila = n + 1;
  ultFila = Math.max(ultFila, tablas(ws) + 1);
  cerrarHoja(ws, 14, ultFila);
  ws['!cols'] = [{ wch: 16 }, ...Array(5).fill({ wch: 13 }), { wch: 3 }, { wch: 18 }, ...Array(5).fill({ wch: 14 })];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  const grafica = hoja => ({
    titulo: `${titulo}${usuario ? ' - ' + usuario.toUpperCase() : ''}`,
    categorias: rango(hoja, 1, 2, n + 1),
    series: [
      ...series.map((s, k) => ({ nombre: s.nombre, ref: rango(hoja, 2 + k, 2, n + 1), color: s.color, ancho: 1.5 })),
      ...limites.map((l, k) => ({ nombre: l.nombre, ref: rango(hoja, 2 + series.length + k, 2, n + 1), color: l.color, guion: l.guion !== false, ancho: 2 })),
    ],
    y: escalaY || undefined, saltoEtiquetas: saltoEtiquetas(t), rotarEtiquetas: true,
  });
  return { ws, grafica };
}

export function exportarTensionReclamo() {
  const a = analisisActivo(); const c = calculoReclamo(a);
  if (!c?.d) return showToast('Sube el TXT de tensión');
  const { d, t, tol } = c; const p = a.params; const fases = t.fases;
  const nominal = Number(p.nominal) || 0; const usuario = p.usuario || '';
  const libro = XLSX.utils.book_new(); const graficas = {};
  const agregar = (nombre, h, ancla) => {
    XLSX.utils.book_append_sheet(libro, h.ws, nombre);
    graficas[nombre] = [{ desde: ancla[0], hasta: ancla[1], grafica: h.grafica(nombre) }];
  };
  const pct = Math.round(tol * 100);
  const limTension = nominal > 0 ? [
    { nombre: `SOBRE+${pct}%`, valor: nominal * (1 + tol), color: '404040' },
    { nombre: `SUB-${pct}%`, valor: nominal * (1 - tol), color: '404040' },
  ] : [];
  const serieFases = (grupo, campo, sufijo, unidad) => fases.filter(x => grupo[x]?.[campo]).map(x => ({ nombre: `${sufijo}${x}${campo === 'v' ? '' : campo === 'max' ? 'Max' : 'Min'} [${unidad}]`, v: grupo[x][campo], color: COLOR_FASE[x], clave: x }));
  const ANCLA_ABAJO = [[7, 15], [21, 39]];
  const ANCLA = [[7, 7], [21, 31]];

  // Tensión promedio: resumen de la medición (FebNoPer) y tabla estadística
  const sProm = serieFases(d.U, 'v', 'U', 'V');
  const escala = nominal > 0 ? { min: Math.floor((nominal * (1 - tol) * 0.97) / 100) * 100, max: Math.ceil((nominal * (1 + tol) * 1.03) / 100) * 100 } : null;
  agregar('Tensión promedio', hojaPerfil({
    fechas: d.fechas, t: d.t, series: sProm, limites: limTension, titulo: 'PERFIL DE TENSIÓN PROMEDIO', usuario, escalaY: escala,
    tablas: ws => {
      const r = t.resumen;
      celda(ws, 7, 1, 'RESUMEN DE MEDICIÓN', st('0B2E3B', { sz: 10 }));
      ['Registros Totales', 'Registros Inválidos', 'Registros Válidos', 'Registros FT', 'FebNoPer', 'Estado'].forEach((h, i) => celda(ws, 7 + i, 2, h, st(AZUL_TABLA)));
      if (r) {
        [r.total, r.invalidos, r.validos, r.ft].forEach((v, i) => celda(ws, 7 + i, 3, v, st(null, { color: '000000' })));
        celda(ws, 11, 3, r.febNoPer, st(null, { color: '000000', fmt: '0.00%' }));
        const fuera = r.estado !== 'DENTRO DE TOLERANCIA';
        celda(ws, 12, 3, r.estado, st(fuera ? 'FFC7CE' : 'C6EFCE', { color: fuera ? '9C0006' : '006100' }));
      } else celda(ws, 7, 3, 'Falta la tensión nominal', st(null, { color: '9C0006' }));
      [['Usuario', usuario], ['Nivel de tensión (V)', nominal || ''], ['Urbanidad / red', `${TIPOS_RED[p.red]?.label || ''} (±${pct}%)`], ['Tipo de instalación', ['', 'Monofásico', 'Bifásico', 'Trifásico'][p.fases]]]
        .forEach(([l, v], i) => { celda(ws, 7, 5 + i, l, st('D9E1F2', { color: '000000' })); celda(ws, 8, 5 + i, v, st(null, { color: '000000', negrita: false, centro: false })); });
      tablaEstadistica(ws, 7, 9, sProm, t.U.v);
      // FebNoPer por fase: dato de análisis (el estado sale del FebNoPer general)
      if (r?.porFase && Object.keys(r.porFase).length > 1) {
        ['FebNoPer por fase', 'Registros FT', 'FebNoPer'].forEach((h, i) => celda(ws, 10 + i, 4, h, st(AZUL_TABLA)));
        Object.entries(r.porFase).forEach(([p, x], j) => {
          celda(ws, 10, 5 + j, `U${p}`, st('D9E1F2', { color: '000000' }));
          celda(ws, 11, 5 + j, x.ft, st(null, { color: '000000', negrita: false }));
          celda(ws, 12, 5 + j, x.febNoPer, st(null, { color: '000000', negrita: false, fmt: '0.00%' }));
        });
      }
      return 13;
    },
  }), ANCLA_ABAJO);

  const perfil = (nombre, titulo, series, est, limites = [], extra = {}) => {
    if (!series.length) return;
    agregar(nombre, hojaPerfil({ fechas: d.fechas, t: d.t, series, limites, titulo, usuario, tablas: ws => { tablaEstadistica(ws, 7, 1, series, est); return 5; }, ...extra }), ANCLA);
  };
  perfil('Tensión máxima', 'PERFIL DE TENSIÓN MÁXIMOS', serieFases(d.U, 'max', 'U', 'V'), t.U.max, limTension);
  perfil('Tensión mínima', 'PERFIL DE TENSIÓN MÍNIMOS', serieFases(d.U, 'min', 'U', 'V'), t.U.min, limTension);
  perfil('Corriente promedio', 'PERFIL DE CORRIENTES PROMEDIO', serieFases(d.I, 'v', 'I', 'A'), t.I.v);
  perfil('Corriente máxima', 'PERFIL DE CORRIENTES MÁXIMAS', serieFases(d.I, 'max', 'I', 'A'), t.I.max,
    t.iMaxTrafo ? [{ nombre: `I Max Trafo (${Math.round(t.iMaxTrafo * 100) / 100} A)`, valor: t.iMaxTrafo, color: 'FF0000' }] : []);

  // PST: límite 1 y percentil 95 por fase
  const sPST = fases.filter(x => d.PST[x]).map(x => ({ nombre: `PST${x} [p.u]`, v: d.PST[x], color: COLOR_FASE[x], clave: x }));
  if (sPST.length) {
    agregar('PST', hojaPerfil({
      fechas: d.fechas, t: d.t, series: sPST, limites: [{ nombre: 'Límite PST = 1', valor: LIMITE_PST, color: 'C00000' }], titulo: 'PERFIL DE DISTORSIÓN POR EFECTO PARPADEO', usuario,
      tablas: ws => {
        celda(ws, 7, 1, 'Parámetros', st(AZUL_TABLA));
        sPST.forEach((s, i) => celda(ws, 8 + i, 1, `U${s.clave} [PST]`, st(AZUL_TABLA)));
        celda(ws, 7, 2, 'Percentil 95%', st('D9E1F2', { color: '000000' }));
        sPST.forEach((s, i) => celda(ws, 8 + i, 2, Math.round(t.pstP95[s.clave] * 10000) / 10000, st(null, { color: t.pstP95[s.clave] > LIMITE_PST ? '9C0006' : '000000', fmt: '0.0000' })));
        return 3;
      },
    }), ANCLA);
  }

  // Cargabilidad: STOTAL (kVA) contra la capacidad del trafo y su 85 %
  const kva = Number(p.kva) || 0;
  if (t.S && kva) {
    const sS = [{ nombre: 'STOTAL [KVA]', v: t.S, color: '0070C0', clave: 's' }];
    agregar('Cargabilidad', hojaPerfil({
      fechas: d.fechas, t: d.t, series: sS, titulo: 'PERFIL DE CARGABILIDAD', usuario,
      limites: [{ nombre: `Capacidad (${kva} KVA)`, valor: kva, color: 'FF0000', guion: false }, { nombre: `85% Capacidad (${Math.round(kva * CARGA_ALERTA * 100) / 100} KVA)`, valor: kva * CARGA_ALERTA, color: 'FFC000' }],
      tablas: ws => {
        tablaEstadistica(ws, 7, 1, sS, { s: t.carga });
        // Cargabilidad en % de la capacidad del trafo
        celda(ws, 9, 1, '% Capacidad', st(AZUL_TABLA));
        ['max', 'prom', 'min'].forEach((k, j) => celda(ws, 9, 2 + j, t.carga[k] === null ? '' : t.carga[k] / kva, st(null, { color: t.carga[k] / kva > 1 ? '9C0006' : '000000', negrita: false, fmt: '0.0%' })));
        return 5;
      },
    }), ANCLA);
  }

  descargarXlsx(escribirConGraficas(libro, graficas), `${a.tension.nombre}_Graficas.xlsx`);
  showToast('Excel de tensión descargado');
}

// ── Armónicos ──

const AZUL_ARM = '003366';
const VERDE_ARM = '005000';

function hojaDetalle(fechas, columnas, colorEnc) {
  const ws = {};
  const enc = st(colorEnc);
  celda(ws, 0, 0, 'Fecha y Hora', enc);
  columnas.forEach((c, i) => celda(ws, 1 + i, 0, c.nombre, enc));
  const sinBorde = st(null, { color: '000000', negrita: false, borde: false, centro: false });
  const rojo = st('FFC7CE', { color: '9C0006', borde: false, fmt: '0.000' });
  const num = st(null, { color: '000000', negrita: false, borde: false, fmt: '0.000' });
  for (let i = 0; i < fechas.length; i++) {
    celda(ws, 0, i + 1, fechas[i], sinBorde);
    columnas.forEach((c, k) => celda(ws, 1 + k, i + 1, Math.round(c.v[i] * 1000) / 1000, c.limite !== undefined && c.v[i] > c.limite ? rojo : num));
  }
  cerrarHoja(ws, columnas.length + 1, fechas.length + 1);
  ws['!cols'] = [{ wch: 19 }, ...columnas.map(() => ({ wch: 11 }))];
  ws['!rows'] = [{ hpt: 30 }];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };
  return ws;
}

function filaResumen(ws, r, f, nf, sombra) {
  const fondo = sombra ? 'F2F2F2' : null;
  celda(ws, 0, r, f.nombre, st(fondo, { color: '000000', negrita: f.nombre.includes('Total'), centro: false }));
  celda(ws, 1, r, f.limTxt, st(fondo, { color: '000000', negrita: false }));
  ['1', '2', '3'].forEach((p, i) => {
    const x = f.fases[p];
    if (!x || Number(p) > nf) {
      [2, 5, 8].forEach(c => celda(ws, c + i, r, 'N/A', st(fondo, { color: '646464', negrita: false })));
      celda(ws, 11 + i, r, 'N/A', st('C8C8C8', { color: '646464', negrita: false }));
      return;
    }
    celda(ws, 2 + i, r, Math.round(x.p95 * 1000) / 1000, st(fondo, { color: x.p95 > f.limite ? 'B40000' : '000000', negrita: x.p95 > f.limite, fmt: '0.000' }));
    celda(ws, 5 + i, r, x.exc, st(fondo, { color: '000000', negrita: false }));
    celda(ws, 8 + i, r, Math.round(x.pct * 100) / 100, st(fondo, { color: '000000', negrita: false, fmt: '0.00' }));
    celda(ws, 11 + i, r, x.cumple ? 'CUMPLE' : 'NO CUMPLE', x.cumple ? st('50C850', { color: '003C00' }) : st('FF5050', { color: '640000' }));
  });
}

function hojaResumen(arm, nombreArchivo, tipoTxt) {
  const ws = {}; const merges = [];
  const titulo = (r, texto, sz = 10) => { celda(ws, 0, r, texto, st(AZUL_ARM, { sz })); for (let c = 1; c < 14; c++) celda(ws, c, r, '', st(AZUL_ARM)); merges.push({ s: { r, c: 0 }, e: { r, c: 13 } }); };
  const encabezado = r => ['Parametro', 'Limite', 'P95 F1', 'P95 F2', 'P95 F3', '# Exc. F1', '# Exc. F2', '# Exc. F3', '% Tpo F1', '% Tpo F2', '% Tpo F3', 'Estado F1', 'Estado F2', 'Estado F3']
    .forEach((h, c) => celda(ws, c, r, h, st(AZUL_ARM)));
  titulo(0, `ANALISIS DE ARMONICOS - Norma SIGET Acuerdo 38-E-2015  |  ${tipoTxt}`, 13);
  celda(ws, 0, 1, `Archivo: ${nombreArchivo}  |  Intervalos: ${arm.n} (10 min c/u)  |  Umbral: >${PERC_MAX}% del periodo (Arts.45 y 51)`, st(null, { color: '505050', negrita: false, italica: true, centro: false, borde: false, sz: 8 }));
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 13 } });
  titulo(3, 'ARMONICOS DE VOLTAJE - Tabla 4 (Art.45)  |  VDAT = 8%  |  TDI = Un/U1 x 100');
  encabezado(4);
  let r = 5;
  arm.tension.forEach((f, i) => filaResumen(ws, r++, f, arm.nf, i % 2 === 1));
  r++;
  titulo(r++, 'ARMONICOS DE CORRIENTE - Tabla 5 (Arts.49-51)  |  DATI = 20%  |  P>=3.5kW -> DAII (%)  |  P<3.5kW -> Ii (A)');
  encabezado(r++);
  arm.corriente.forEach((f, i) => filaResumen(ws, r++, f, arm.nf, i % 2 === 1));
  r++;
  celda(ws, 0, r++, 'LEYENDA', st(null, { color: '000000', borde: false, centro: false }));
  [['NO CUMPLE', 'FF5050', '640000', `% de intervalos fuera de limite > ${PERC_MAX}% del periodo`],
    ['CUMPLE', '50C850', '003C00', `% de intervalos fuera de limite <= ${PERC_MAX}% del periodo`],
    ['N/A', 'C8C8C8', '505050', `Fase no activa segun tipo de instalacion seleccionado (${tipoTxt})`]]
    .forEach(([l, f, c, tx]) => { celda(ws, 0, r, l, st(f, { color: c })); celda(ws, 1, r, tx, st(null, { color: '000000', negrita: false, borde: false, centro: false })); r++; });
  cerrarHoja(ws, 14, r);
  ws['!merges'] = merges;
  ws['!cols'] = [18, 16, 9, 9, 9, 8, 8, 8, 8, 8, 8, 11, 11, 11].map(wch => ({ wch }));
  return ws;
}

function hojaCompacta(arm, tipoTxt) {
  const ws = {}; const merges = [];
  const banda = (r, texto, color, sz = 9) => { celda(ws, 0, r, texto, st(color, { sz })); for (let c = 1; c < 5; c++) celda(ws, c, r, '', st(color)); merges.push({ s: { r, c: 0 }, e: { r, c: 4 } }); };
  banda(0, `RESUMEN DE ARMONICOS  |  Norma SIGET 38-E-2015  |  ${tipoTxt}`, AZUL_ARM, 11);
  ['Parametro', 'Limite', 'Fase 1', 'Fase 2', 'Fase 3'].forEach((h, c) => celda(ws, c, 1, h, st('17375E')));
  const fila = (r, f, total) => {
    celda(ws, 0, r, f.nombre.replace(' - ', '  -  '), st(total ? 'F2F2F2' : null, { color: '000000', negrita: total, centro: false }));
    celda(ws, 1, r, f.limTxt.split(' / ')[0], st(total ? 'F2F2F2' : null, { color: '000000', negrita: false }));
    ['1', '2', '3'].forEach((p, i) => {
      const x = f.fases[p];
      if (!x || Number(p) > arm.nf) return celda(ws, 2 + i, r, 'N/A', st('D2D2D2', { color: '787878', negrita: false }));
      celda(ws, 2 + i, r, `${x.p95.toFixed(3)} %`, x.cumple ? st('50C878', { color: '003C0A' }) : st('FF5050', { color: '780000' }));
    });
  };
  banda(2, 'ARMONICOS DE VOLTAJE  —  Tabla 4 (Art.45)  |  TDI = Un/U1 x 100  |  Limite VDAT = 8%', '00467F');
  let r = 3;
  arm.tension.forEach((f, i) => fila(r++, f, i === 0));
  r++;
  banda(r++, 'ARMONICOS DE CORRIENTE  —  Tabla 5 (Arts.49-51)  |  DAII = In/I1 x 100  |  Estado por intervalo: P>=3.5kW vs % / P<3.5kW vs A', '00467F');
  arm.corriente.forEach((f, i) => fila(r++, f, i === 0));
  r++;
  const nota = st(null, { color: '505050', negrita: false, italica: true, borde: false, centro: false, sz: 8 });
  celda(ws, 0, r++, 'P95 = Percentil 95 (IEC 61000-4-7). En corriente: P95 de DAII% sobre intervalos con P>=3.5kW', nota);
  celda(ws, 0, r++, `Estado: CUMPLE si % tiempo fuera de limite <= ${PERC_MAX}% (Art.45/51)`, nota);
  cerrarHoja(ws, 5, r);
  ws['!merges'] = merges;
  ws['!cols'] = [16, 10, 13, 13, 13].map(wch => ({ wch }));
  return ws;
}

export function exportarArmonicosReclamo() {
  const a = analisisActivo(); const c = calculoReclamo(a);
  const arm = c?.arm;
  if (!arm?.n) return showToast('Sube el TXT de armónicos');
  const { fases, nf } = arm;
  const tipoTxt = ['', 'Monofásico (F1)', 'Bifásico (F1, F2)', 'Trifásico (F1, F2, F3)'][nf];
  const libro = XLSX.utils.book_new();
  // Detalle_V: VDAT y TDI por armónica y fase
  const colV = [...fases.map(p => ({ nombre: `VDAT F${p} (%)`, v: arm.VDAT[p], limite: VDAT_LIM })),
    ...ARMONICAS.flatMap(n => fases.map(p => ({ nombre: `TDI H${n} F${p} (%)`, v: arm.TDI[n][p] })))];
  XLSX.utils.book_append_sheet(libro, hojaDetalle(arm.fechas, colV, AZUL_ARM), 'Detalle_V');
  // Detalle_I: P, DATI y DAII por armónica y fase
  const colI = [...fases.map(p => ({ nombre: `P F${p} (kW)`, v: arm.P[p] })),
    ...fases.map(p => ({ nombre: `DATI F${p} (%)`, v: arm.DATI[p], limite: DATI_LIM })),
    ...ARMONICAS.flatMap(n => fases.map(p => ({ nombre: `DAII/Ii H${n} F${p}`, v: arm.DAII[n][p] })))];
  XLSX.utils.book_append_sheet(libro, hojaDetalle(arm.fechas, colI, VERDE_ARM), 'Detalle_I');
  XLSX.utils.book_append_sheet(libro, hojaResumen(arm, a.armonicos.nombre, tipoTxt), 'Resumen_Armonicos');
  XLSX.utils.book_append_sheet(libro, hojaCompacta(arm, tipoTxt), 'Resumen_Compacto');

  // Graficos: tabla del espectro (P95 de todos los intervalos, como la hoja de la macro) y 4 gráficas
  const ws = {};
  const enc = st(AZUL_ARM);
  const cab = ['Armonico', 'Lim.TDI(%)', ...fases.map(p => `TDI P95 F${p}(%)`), 'Lim.DAII(%)', ...fases.map(p => `DAII P95 F${p}`)];
  cab.forEach((h, i) => celda(ws, i, 0, h, enc));
  const num = st(null, { color: '000000', negrita: false, fmt: '0.000' });
  arm.espectro.forEach((e, i) => {
    const r = i + 1;
    celda(ws, 0, r, `H${e.n}`, st(null, { color: '000000' }));
    celda(ws, 1, r, Math.round(e.limTDI * 1000) / 1000, num);
    fases.forEach((p, k) => celda(ws, 2 + k, r, Math.round(e.tdi[p] * 1000) / 1000, num));
    celda(ws, 2 + nf, r, Math.round(e.limDAII * 1000) / 1000, num);
    fases.forEach((p, k) => celda(ws, 3 + nf + k, r, Math.round(e.daii[p] * 1000) / 1000, num));
  });
  celda(ws, 0, 25, `Archivo: ${a.armonicos.nombre}  |  ${tipoTxt}`, st(null, { color: '000000', negrita: false, italica: true, borde: false, centro: false }));
  cerrarHoja(ws, 3 + 2 * nf, 26);
  ws['!cols'] = cab.map(() => ({ wch: 13 }));
  XLSX.utils.book_append_sheet(libro, ws, 'Graficos');

  const n = arm.n; const G = 'Graficos';
  const salto = n > 144 ? Math.floor(n / 12) : undefined;
  const espectro = (titulo, ejeY, colLim, col0, color, prefijo) => ({
    titulo: `${titulo} (${tipoTxt})`, colorTitulo: color, categorias: rango(G, 1, 2, 25), tituloX: 'Armonico', tituloY: ejeY,
    series: [...fases.map((p, k) => ({ nombre: `${prefijo} F${p}${prefijo.includes('TDI') ? ' (%)' : ''}`, ref: rango(G, col0 + k, 2, 25), color: COLOR_FASE_ARM[p], tipo: 'barra' })),
      { nombre: 'Limite SIGET', ref: rango(G, colLim, 2, 25), color: '404040', guion: true, ancho: 2.5 }],
  });
  const tendencia = (hoja, titulo, ejeY, col0, lim, limNombre, prefijo, color) => ({
    titulo, colorTitulo: color, categorias: rango(hoja, 1, 2, n + 1), tituloX: 'Fecha / Hora', tituloY: ejeY, saltoEtiquetas: salto, y: { min: 0 },
    series: [...fases.map((p, k) => ({ nombre: `${prefijo} F${p} (%)`, ref: rango(hoja, col0 + k, 2, n + 1), color: COLOR_FASE_ARM[p], ancho: 2 })),
      { nombre: limNombre, valores: Array(n).fill(lim), color: '404040', guion: true, ancho: 2.5 }],
  });
  const graficas = {
    [G]: [
      { desde: [0, 27], hasta: [9, 49], grafica: espectro('Espectro Armonico de Voltaje - TDI Percentil 95 vs Limite Tabla 4', 'TDI P95 (%)', 2, 3, AZUL_ARM, 'P95 TDI') },
      { desde: [10, 27], hasta: [19, 49], grafica: espectro('Espectro Armonico de Corriente - DAII Percentil 95 vs Limite Tabla 5', 'DAII P95 (%)', 3 + nf, 4 + nf, '006100', 'P95 DAII') },
      { desde: [0, 50], hasta: [9, 72], grafica: tendencia('Detalle_V', 'Tendencia VDAT en el Tiempo', 'VDAT (%)', 2, VDAT_LIM, 'Lim. SIGET 8%', 'VDAT', AZUL_ARM) },
      { desde: [10, 50], hasta: [19, 72], grafica: tendencia('Detalle_I', 'Tendencia DATI en el Tiempo', 'DATI (%)', 2 + nf, DATI_LIM, 'Lim. SIGET 20%', 'DATI', '006100') },
    ],
  };
  descargarXlsx(escribirConGraficas(libro, graficas), `${a.armonicos.nombre}_Armonicos.xlsx`);
  showToast('Excel de armónicos descargado');
}
