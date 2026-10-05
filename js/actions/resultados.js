// Resultados de la campaña: anotar el de cada caso y exportar el cuadro resumen
import { db, ref, set, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { analizarMedicion, filasResumenAnalisis, resultadoDeAnalisis } from '../domain/analisis.js';
import { corteSubida, cuadroResumen, ESTADOS_CUADRO } from '../domain/resultados.js';
import { CR_OBLIGATORIOS_MT } from '../domain/multiplicadores.js';
import { BORDES, COLOR, ESTILO_ENCABEZADO, hojaConEstilo } from '../excel.js';
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

export function exportarCuadroResumen(clave) {
  const c = agruparCampanas(state.records, hoyLocal(), state.campanas).find(x => x.clave === clave);
  if (!c) return;
  const filas = filasResultados(c);
  const COLUMNAS = 6;
  const { grilla, cuenta } = cuadroResumen(filas, COLUMNAS);
  const corte = c.area === 'CPT MT' ? corteSubida(filas, CR_OBLIGATORIOS_MT) : null;
  const aoa = [[`Cuadro resumen · ${MESES[c.mes - 1]} ${c.anio} · ${c.area}`]];
  aoa.push([corte ? (corte.codigo ? `Se sube al sistema hasta ${corte.codigo} (${CR_OBLIGATORIOS_MT} CR con medición válida)` : `Faltan ${corte.faltan} CR con medición válida para llegar a ${CR_OBLIGATORIOS_MT} (van ${corte.contados})`) : '']);
  aoa.push([]);
  const inicio = aoa.length;
  grilla.forEach(fila => aoa.push(fila.map(x => x.codigo)));
  aoa.push([]);
  const inicioLeyenda = aoa.length;
  aoa.push(['Leyenda', 'Casos']);
  Object.entries(ESTADOS_CUADRO).forEach(([k, e]) => aoa.push([e.texto, cuenta[k]]));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = Array(COLUMNAS).fill({ wch: 19 });
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLUMNAS - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: COLUMNAS - 1 } }];
  const pinta = (r, col, color, extra = {}) => {
    const celda = ws[XLSX.utils.encode_cell({ r, c: col })] || (ws[XLSX.utils.encode_cell({ r, c: col })] = { t: 's', v: '' });
    celda.s = {
      font: { bold: true, sz: 10, color: { rgb: color ? 'FFFFFF' : COLOR.texto } },
      fill: color ? { patternType: 'solid', fgColor: { rgb: color } } : undefined,
      alignment: { horizontal: 'center', vertical: 'center' }, border: BORDES, ...extra,
    };
  };
  ws.A1.s = { font: { bold: true, sz: 14, color: { rgb: COLOR.oscuro } } };
  if (ws.A2) ws.A2.s = { font: { bold: true, sz: 11, color: { rgb: corte?.codigo ? COLOR.petroleo : 'B45309' } } };
  const gruesa = { style: 'medium', color: { rgb: COLOR.oscuro } };
  grilla.forEach((fila, i) => fila.forEach((x, j) => {
    const esCorte = corte?.codigo && x.codigo === corte.codigo;
    pinta(inicio + i, j, ESTADOS_CUADRO[x.estado].color, esCorte ? { border: { top: gruesa, bottom: gruesa, left: gruesa, right: gruesa } } : {});
  }));
  ws['!rows'] = aoa.map((_, r) => (r >= inicio && r < inicio + grilla.length ? { hpt: 22 } : null));
  ws[XLSX.utils.encode_cell({ r: inicioLeyenda, c: 0 })].s = ESTILO_ENCABEZADO;
  ws[XLSX.utils.encode_cell({ r: inicioLeyenda, c: 1 })].s = ESTILO_ENCABEZADO;
  Object.values(ESTADOS_CUADRO).forEach((e, i) => {
    pinta(inicioLeyenda + 1 + i, 0, e.color);
    pinta(inicioLeyenda + 1 + i, 1, null);
  });
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
    filas.push({ id, codigo: caso.codigo || caso.codigoEnte, analisis, resultado: resultadoDeAnalisis(analisis), manual: !!caso.resultado && caso.resultado.origen !== 'txt' });
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
    datos[`casos/${f.id}/resultado`] = { ...f.resultado, analisis: f.analisis, origen: 'txt', ...firma };
  });
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
