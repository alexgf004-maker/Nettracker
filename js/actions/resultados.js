// Resultados de la campaña: anotar el de cada caso y exportar el cuadro resumen
import { db, ref, set } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
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
