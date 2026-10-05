// Multiplicadores: editar el de cada caso, usar el histórico del usuario y exportar la hoja
import { db, ref, set, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { ordenarCasos } from '../domain/listados.js';
import { filasMultiplicadores, historicoDe, leerMultiplicadoresExcel, planificarMultiplicadores } from '../domain/multiplicadores.js';
import { leerArchivo } from './campanas.js';
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

// ── IMPORTAR UN EXCEL DE MULTIPLICADORES YA HECHO (también trae las fechas y el equipo de cada caso) ──

export async function importarMultiplicadores(files) {
  if (!files?.length) return;
  try {
    procesarMultiplicadores(await leerArchivo(files[0]));
  } catch (err) {
    showToast('No se pudo leer el archivo: ' + err.message);
  }
}

// archivo: { nombre, hojas, orden }. Busca la hoja "Multiplicadores" (o la primera que tenga sus columnas).
export function procesarMultiplicadores(archivo) {
  const orden = [...archivo.orden].sort((a, b) => (/multiplicador/i.test(b) ? 1 : 0) - (/multiplicador/i.test(a) ? 1 : 0));
  let leido = null;
  for (const n of orden) { const r = leerMultiplicadoresExcel(archivo.hojas[n]); if (!r.error) { leido = r; break; } }
  if (!leido) return showToast('No se encontró la hoja de multiplicadores (columnas "ESTADO" y "Código SIGET")');
  state.importMult = { nombre: archivo.nombre, estadosRaros: leido.estadosRaros, ...planificarMultiplicadores(leido.filas, state.campanas) };
  render();
}
export function cerrarImportMultiplicadores() { state.importMult = null; render(); }

export function guardarImportMultiplicadores() {
  const imp = state.importMult;
  if (!imp?.planes.length) return;
  const firma = { editadoPor: state.sesionUsuario?.nombre || '', fecha: hoyLocal(), origen: 'excel' };
  imp.planes.forEach(p => {
    const datos = {};
    p.dias.forEach(d => {
      datos[`fechas/${d.n}/instalacion`] = d.instalacion;
      if (d.retiro) datos[`fechas/${d.n}/retiro`] = d.retiro;
    });
    p.asignaciones.forEach(a => {
      if (Object.keys(a.mult).length) datos[`casos/${a.id}/mult`] = { ...a.mult, ...(a.notas ? { notas: a.notas } : {}), ...firma };
      if (a.fecha) datos[`casos/${a.id}/programa/fecha`] = a.fecha;
      if (a.equipo) datos[`casos/${a.id}/programa/equipo`] = a.equipo;
      if (a.codigoNuevo) datos[`casos/${a.id}/codigo`] = a.codigoNuevo;
    });
    update(ref(db, 'campanas/' + p.clave), datos);
  });
  const total = imp.planes.reduce((n, p) => n + p.asignaciones.length, 0);
  showToast(`Multiplicadores importados · ${total} casos`);
  state.importMult = null;
  render();
}
