// Multiplicadores: editar el de cada caso, usar el histórico del usuario y exportar la hoja
import { db, ref, set } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { ordenarCasos } from '../domain/listados.js';
import { filasMultiplicadores, historicoDe } from '../domain/multiplicadores.js';
import { hoyLocal, MESES } from '../domain/trabajo.js';
import { render } from '../views/render.js';

export const CAMPOS_MULT = ['estado', 'configuracion', 'tap', 'tensionTap', 'tensionBT', 'xMedidor', 'testblock', 'vab', 'vbc', 'vac', 'notas'];
const caso = () => state.campanas?.[state.multEdit?.clave]?.casos?.[state.multEdit?.id];

export function abrirMultiplicador(clave, id) {
  const c = state.campanas?.[clave]?.casos?.[id];
  if (!c) return;
  state.multEdit = { clave, id };
  state.multForm = Object.fromEntries(CAMPOS_MULT.map(k => [k, c.mult?.[k] ?? '']));
  render();
}
export function cerrarMultiplicador() { state.multEdit = null; state.multForm = {}; render(); }

// Copia la configuración de la última campaña del mismo usuario
export function usarHistorico() {
  const c = caso();
  const h = c && historicoDe(c.nc, state.campanas, state.multEdit.clave);
  if (!h) return;
  ['configuracion', 'tap', 'tensionTap', 'tensionBT', 'xMedidor', 'testblock'].forEach(k => { if (h.mult[k] !== undefined) state.multForm[k] = h.mult[k]; });
  state.multForm.estado = 'Validado con histórico';
  state.multForm.historico = { clave: h.clave, codigo: h.codigo };
  render();
}

export function guardarMultiplicador() {
  const { clave, id } = state.multEdit || {};
  if (!caso()) return cerrarMultiplicador();
  const datos = {};
  for (const k of CAMPOS_MULT) {
    const v = String(state.multForm[k] ?? '').trim();
    if (!v) continue;
    if (['tensionTap', 'tensionBT', 'xMedidor', 'vab', 'vbc', 'vac'].includes(k)) {
      const n = Number(v.replace(',', '.'));
      if (Number.isNaN(n)) return showToast('Revisa los valores numéricos');
      datos[k] = n;
    } else datos[k] = v;
  }
  if (state.multForm.historico && datos.estado === 'Validado con histórico') datos.historico = state.multForm.historico;
  datos.editadoPor = state.sesionUsuario?.nombre || '';
  datos.fecha = hoyLocal();
  set(ref(db, `campanas/${clave}/casos/${id}/mult`), datos).then(() => showToast('Multiplicador guardado'));
  cerrarMultiplicador();
}

export function exportarMultiplicadores(clave) {
  const g = state.campanas?.[clave];
  const casos = ordenarCasos(Object.values(g?.casos || {}));
  if (!casos.length) return;
  const ws = XLSX.utils.aoa_to_sheet(filasMultiplicadores(casos));
  ws['!cols'] = Array(24).fill({ wch: 16 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Multiplicadores');
  XLSX.writeFile(wb, `Multiplicadores_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}.xlsx`);
  showToast('Multiplicadores exportados');
}
