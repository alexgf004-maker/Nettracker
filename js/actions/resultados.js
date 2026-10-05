// Resultados de la campaña: anotar el de cada caso y exportar el cuadro resumen
import { db, get, ref, set, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { analizarMedicion, filasResumenAnalisis, resultadoDeAnalisis } from '../domain/analisis.js';
import { corteSubida, cuadroResumen, ESTADOS_CUADRO } from '../domain/resultados.js';
import { CR_OBLIGATORIOS_MT } from '../domain/multiplicadores.js';
import { hojaConEstilo } from '../excel.js';
import { extraerSeries, fechaDePunto } from '../domain/series.js';
import { agruparCampanas, hoyLocal, MESES } from '../domain/trabajo.js';
import { filasResultados } from '../views/resultados.js';
import { render } from '../views/render.js';

export function abrirResultado(clave, id) {
  const c = state.campanas?.[clave]?.casos?.[id];
  if (!c) return;
  state.resultadoEdit = { clave, id };
  const r = c.resultado || {};
  state.resultadoForm = { medicion: r.medicion || '', tolerancia: r.tolerancia || '', febNoPer: r.febNoPer ?? '', nota: r.nota || '' };
  render();
}
export function cerrarResultado() { state.resultadoEdit = null; render(); }

export function guardarResultado() {
  const { clave, id } = state.resultadoEdit || {};
  const f = state.resultadoForm;
  if (!f.medicion) return showToast('Elige si la medición fue válida, fallida o no se midió');
  const datos = { medicion: f.medicion };
  if (f.medicion === 'valida') {
    if (f.tolerancia) datos.tolerancia = f.tolerancia;
    const v = String(f.febNoPer ?? '').trim().replace(',', '.');
    if (v) {
      if (Number.isNaN(Number(v))) return showToast('FebNoPer debe ser un número');
      datos.febNoPer = Number(v);
    }
  }
  if (String(f.nota || '').trim()) datos.nota = f.nota.trim();
  datos.por = state.sesionUsuario?.nombre || '';
  datos.fecha = hoyLocal();
  set(ref(db, `campanas/${clave}/casos/${id}/resultado`), datos).then(() => showToast('Resultado guardado'));
  state.resultadoEdit = null;
  render();
}

// Cuadro resumen con el formato que entrega el equipo: CR a la izquierda (CASO, ESTADO, COMENTARIO), DA/DF a la
// derecha, conteos con fórmulas y, en MT, el caso hasta el que se cargan las 38 mediciones.
export function exportarCuadroResumen(clave) {
  const c = agruparCampanas(state.records, hoyLocal(), state.campanas).find(x => x.clave === clave);
  if (!c) return;
  const filas = filasResultados(c);
  const { cr, otros } = cuadroResumen(filas);
  const esMT = c.area === 'CPT MT';
  const corte = esMT ? corteSubida(filas, CR_OBLIGATORIOS_MT) : null;
  const ws = {};
  const AZUL = '002060';
  const fin = Math.max(2, cr.length + 1); // última fila de CR
  const rango = col => `${col}2:${col}${fin}`;
  const borde = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  const pon = (ref, v, s = {}, f = null) => {
    ws[ref] = { t: typeof v === 'number' ? 'n' : 's', v: v ?? '', s: { font: { sz: 11, ...(s.font || {}) }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true, ...(s.alignment || {}) }, ...s } };
    if (s.font) ws[ref].s.font = { sz: 11, ...s.font };
    if (f) ws[ref].f = f;
  };
  const titulo = { fill: { patternType: 'solid', fgColor: { rgb: AZUL } }, font: { bold: true, color: { rgb: 'FFFFFF' } } };
  const colorEstado = e => {
    const x = ESTADOS_CUADRO[e] || {};
    return { border: borde, ...(x.fill ? { fill: { patternType: 'solid', fgColor: { rgb: x.fill } } } : {}), ...(x.font ? { font: { color: { rgb: x.font } } } : {}) };
  };
  // Encabezados
  ['A', 'H'].forEach(col => {
    const [c1, c2, c3] = col === 'A' ? ['A', 'B', 'C'] : ['H', 'I', 'J'];
    pon(c1 + '1', 'CASO', titulo); pon(c2 + '1', 'ESTADO', titulo); pon(c3 + '1', 'COMENTARIO', titulo);
  });
  // CR, con la columna K que acumula las válidas (DT o FT) para encontrar el caso 38
  let acumulado = 0;
  cr.forEach((x, i) => {
    const r = i + 2;
    pon('A' + r, x.codigo, { border: borde, font: { bold: true } });
    pon('B' + r, x.estado, colorEstado(x.estado));
    pon('C' + r, x.comentario, { border: borde });
    if (x.estado === 'DT' || x.estado === 'FT') acumulado++;
    pon('K' + r, acumulado, {}, r === 2 ? 'IF(OR(B2="DT",B2="FT"),1,0)' : `IF(OR(B${r}="DT",B${r}="FT"),1,0)+K${r - 1}`);
  });
  const n = e => cr.filter(x => x.estado === e).length;
  pon('E2', 'DT', colorEstado('DT')); pon('F2', n('DT'), { font: { color: { rgb: AZUL } } }, `COUNTIFS(${rango('B')},"DT")`);
  pon('E3', 'FT', colorEstado('FT')); pon('F3', n('FT'), { font: { color: { rgb: AZUL } } }, `COUNTIFS(${rango('B')},"FT")`);
  pon('E4', 'VÁLIDAS', { ...titulo, border: borde, font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } } }); pon('F4', n('DT') + n('FT'), { ...titulo, font: { bold: true, sz: 12, color: { rgb: 'FFFF00' } } }, 'SUM(F2:F3)');
  pon('E6', 'Fallida', colorEstado('Fallida')); pon('F6', n('Fallida'), { font: { color: { rgb: AZUL } } }, `COUNTIFS(${rango('B')},"Fallida")`);
  pon('E7', 'No instalada', { ...colorEstado('No instalada'), font: { bold: true, color: { rgb: 'FF0000' } } }); pon('F7', n('No instalada'), { font: { color: { rgb: AZUL } } }, `COUNTIFS(${rango('B')},"No instalada")`);
  pon('E8', 'NO VÁLIDAS', { ...titulo, border: borde, font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } } }); pon('F8', n('Fallida') + n('No instalada'), { ...titulo, font: { bold: true, sz: 12, color: { rgb: 'FF4747' } } }, 'SUM(F6:F7)');
  const merges = [];
  if (esMT) {
    pon('E11', 'Número de mediciones a subir', titulo); merges.push({ s: { r: 10, c: 4 }, e: { r: 10, c: 5 } });
    pon('G11', CR_OBLIGATORIOS_MT, { fill: { patternType: 'solid', fgColor: { rgb: '00B050' } }, font: { bold: true, color: { rgb: 'FFFF00' } } });
    pon('E12', 'Número de caso hasta que se cargará', { fill: { patternType: 'solid', fgColor: { rgb: '8497B0' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } }); merges.push({ s: { r: 11, c: 4 }, e: { r: 12, c: 4 } });
    pon('F12', corte.codigo || `Faltan ${corte.faltan}`, { fill: { patternType: 'solid', fgColor: { rgb: '000000' } }, font: { bold: true, sz: 14, color: { rgb: 'FFFF00' } } },
      `IFERROR(INDEX(${rango('A')},MATCH(G11,${rango('K')},0)),"Faltan "&(G11-MAX(${rango('K')})))`);
    merges.push({ s: { r: 11, c: 5 }, e: { r: 12, c: 6 } });
  }
  // DA y DF
  otros.forEach((x, i) => {
    const r = i + 2;
    pon('H' + r, x.codigo, { border: borde, font: { bold: true } });
    pon('I' + r, x.estado, colorEstado(x.estado));
    pon('J' + r, x.comentario, { border: borde });
  });
  if (otros.length) {
    const finO = otros.length + 1; const rO = `I2:I${finO}`;
    const base = Math.max(9, finO + 2);
    const m = e => otros.filter(x => x.estado === e).length;
    const lineas = [['Válidas', '00B050', 'FFFFFF', '00B050'], ['Fallida', 'FFC000', '000000', 'FFC000'], ['No instalada', 'FF0000', '000000', 'C00000']];
    lineas.forEach(([e, fondo, letra, num], i) => {
      pon('I' + (base + i), e, { border: borde, fill: { patternType: 'solid', fgColor: { rgb: fondo } }, font: { bold: true, color: { rgb: letra } } });
      pon('J' + (base + i), m(e === 'Válidas' ? 'Válida' : e), { font: { bold: true, color: { rgb: num } } }, `COUNTIFS(${rO},"${e === 'Válidas' ? 'Válida' : e}")`);
    });
    pon('I' + (base + 3), 'TOTAL', { ...titulo, border: borde, font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } } });
    pon('J' + (base + 3), m('Válida') + m('Fallida') + m('No instalada'), { ...titulo, font: { bold: true, sz: 12, color: { rgb: 'FFFF00' } } }, `SUM(J${base}:J${base + 2})`);
  }
  const ultima = Math.max(fin, otros.length + 1, otros.length ? Math.max(9, otros.length + 3) + 3 : 0, esMT ? 13 : 8);
  ws['!ref'] = `A1:K${ultima}`;
  ws['!merges'] = merges;
  ws['!cols'] = [17.3, 15.7, 44.6, 11.9, 28.4, 19.9, 11.4, 17.4, 15, 30.7, 11.7].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cuadro resumen');
  XLSX.writeFile(wb, `Cuadro_resumen_${MESES[c.mes - 1]}_${c.anio}_${c.area.replace(/\s+/g, '_')}.xlsx`);
  showToast('Cuadro resumen exportado');
}

// ── ANÁLISIS DE LOS TXT (macro CalidadEnergia integrada) ──

// Los TXT se guardan solo en memoria mientras la app está abierta, para poder recalcular
// después de corregir un dato del caso sin volver a subirlos (no se suben a la base de datos).
const txtEnMemoria = {};

const leerTexto = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve(e.target.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsText(file);
});

// archivos: [{ nombre, texto }] (separado de la lectura para poder probarlo sin archivos)
export function analizarArchivos(clave, archivos) {
  const g = state.campanas?.[clave];
  if (!g) return;
  const casos = Object.entries(g.casos || {});
  const filas = []; const sinCaso = [];
  for (const a of archivos) {
    const codigo = a.nombre.replace(/\.[^.]*$/, '').trim().toUpperCase();
    const hit = casos.find(([, c]) => (c.codigo || '').toUpperCase() === codigo || (c.codigoEnte || '').toUpperCase() === codigo);
    if (!hit) { sinCaso.push(a.nombre); continue; }
    const [id, caso] = hit;
    (txtEnMemoria[clave] ??= {})[id] = a;
    const analisis = analizarMedicion(a.nombre, a.texto, { configuracion: caso.mult?.configuracion, alimentador: caso.alimentador, urbanidad: caso.urbanidad });
    filas.push({ id, codigo: caso.codigo || caso.codigoEnte, analisis, resultado: resultadoDeAnalisis(analisis), manual: !!caso.resultado && caso.resultado.origen !== 'txt', series: extraerSeries(a.texto) });
  }
  filas.sort((x, y) => x.codigo.localeCompare(y.codigo));
  state.analisisTXT = { clave, filas, sinCaso };
  render();
}

export async function analizarTXT(clave, files) {
  if (!files?.length) return;
  try {
    const archivos = await Promise.all([...files].map(async f => ({ nombre: f.name, texto: await leerTexto(f) })));
    analizarArchivos(clave, archivos);
  } catch (err) {
    showToast('No se pudieron leer los TXT: ' + err.message);
  }
}

// Vuelve a analizar los TXT ya subidos con los datos actuales de los casos
export function recalcularTXT(clave) {
  const archivos = Object.values(txtEnMemoria[clave] || {});
  if (!archivos.length) return showToast('Primero sube los TXT');
  analizarArchivos(clave, archivos);
}
export const hayTXTEnMemoria = clave => Object.keys(txtEnMemoria[clave] || {}).length > 0;

export function cerrarAnalisis() { state.analisisTXT = null; render(); }

export function guardarAnalisis() {
  const imp = state.analisisTXT;
  if (!imp?.filas.length) return;
  const datos = {};
  const firma = { por: state.sesionUsuario?.nombre || '', fecha: hoyLocal() };
  imp.filas.forEach(f => {
    datos[`casos/${f.id}/resultado`] = { ...f.resultado, analisis: f.analisis, origen: 'txt', ...firma, ...(f.series ? { graficas: true } : {}) };
  });
  // Las series van aparte (series/{campaña}/{caso}) para no cargarlas con la campaña; se leen al abrir las gráficas
  const series = {};
  imp.filas.forEach(f => { if (f.series) series[f.id] = { ...f.series, nominal: f.analisis.nominal ?? null, tolerancia: f.analisis.tolerancia ?? null, codigo: f.codigo }; });
  if (Object.keys(series).length) update(ref(db, 'series/' + imp.clave), series);
  update(ref(db, 'campanas/' + imp.clave), datos).then(() => showToast(`${imp.filas.length} mediciones analizadas`));
  state.analisisTXT = null;
  render();
}

// Excel con las columnas de la hoja Resumen de la macro (para comparar)
export function exportarAnalisis(clave) {
  const g = state.campanas?.[clave];
  const analisis = Object.values(g?.casos || {}).map(c => c.resultado?.origen === 'txt' ? c.resultado.analisis : null).filter(Boolean)
    .sort((a, b) => a.archivo.localeCompare(b.archivo));
  if (!analisis.length) return showToast('Todavía no hay mediciones analizadas');
  const ws = hojaConEstilo(filasResumenAnalisis(analisis), { anchos: [22, 14, 12, 14, 16, 12, 10, 12, 14, 60, 18, 18] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  XLSX.writeFile(wb, `Analisis_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}.xlsx`);
  showToast('Análisis exportado');
}

// ── GRÁFICAS DE VOLTAJE Y CORRIENTE ──

export async function verGraficas(clave, id) {
  state.graficas = { clave, id, cargando: true };
  render();
  try {
    const snap = await get(ref(db, `series/${clave}/${id}`));
    if (state.graficas?.id !== id) return;
    state.graficas = { clave, id, datos: snap.exists() ? snap.val() : null };
  } catch (err) {
    state.graficas = { clave, id, error: err.message };
  }
  render();
}
export function cerrarGraficas() { state.graficas = null; render(); }

// Datos de las gráficas en Excel (tabla con fecha y valores por fase)
export function exportarSeries(clave, id) {
  const d = state.graficas?.datos; if (!d) return;
  const n = d.t.length;
  const fU = Object.keys(d.U || {}); const fI = Object.keys(d.I || {});
  const filas = [['Fecha y hora', ...fU.map(p => `U${p} [V]`), ...fI.map(p => `I${p} [A]`)]];
  for (let i = 0; i < n; i++) filas.push([fechaDePunto(d.inicio, d.t[i] ?? 0), ...fU.map(p => d.U[p].v?.[i] ?? ''), ...fI.map(p => d.I[p].v?.[i] ?? '')]);
  const ws = hojaConEstilo(filas, { anchos: [16, ...Array(fU.length + fI.length).fill(12)] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `Graficas_${d.codigo || id}.xlsx`);
}
