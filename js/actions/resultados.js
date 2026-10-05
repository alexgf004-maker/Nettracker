// Resultados de la campaña: anotar el de cada caso y exportar el cuadro resumen
import { db, ref, set, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { analizarMedicion, filasResumenAnalisis, resultadoDeAnalisis } from '../domain/analisis.js';
import { filasCuadroResumen } from '../domain/resultados.js';
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
  const ws = XLSX.utils.aoa_to_sheet(filasCuadroResumen(filasResultados(c)));
  ws['!cols'] = [18, 12, 40, 28, 12, 24, 12, 40].map(wch => ({ wch }));
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
  const ws = XLSX.utils.aoa_to_sheet(filasResumenAnalisis(analisis));
  ws['!cols'] = [22, 14, 12, 14, 16, 12, 10, 12, 14, 60, 18, 18].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
  XLSX.writeFile(wb, `Analisis_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}.xlsx`);
  showToast('Análisis exportado');
}
