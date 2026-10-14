// Descargas en bloque: registrar la descarga de varios equipos a la vez (p. ej. todos los de una Fecha de campaña).
// Cada equipo queda igual que con la descarga de uno en uno (instalaciones.js): se agrega a sus descargas y deja de
// estar pendiente. El técnico y las notas son para todos; si una medición tuvo fallo se marca en su fila.
import { db, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { calcSt, today } from '../utils.js';
import { TECNICOS } from '../config.js';
import { casosDeFecha } from '../domain/fechas.js';
import { instalacionDeCaso } from '../domain/resultados.js';
import { render } from '../views/render.js';

export const FALLAS_MEDICION = ['Pocas mediciones (incompleta)', 'Valores repetidos / pegados', 'No midio (archivo vacio)', 'Archivo demasiado pesado', 'Archivo demasiado liviano'];

// Se pueden descargar los equipos ya instalados (no programados a futuro) y los retirados con la descarga pendiente
export const descargable = r => !!r && (r.retirado ? !!r.descargaPendiente : calcSt(r) !== 'PROGRAMADO');

function abrir(titulo, registros) {
  const lista = registros.filter(descargable);
  if (!lista.length) return showToast('No hay equipos por descargar');
  const yo = state.sesionUsuario?.nombre;
  state.descargaBloque = {
    titulo, ids: lista.map(r => r.id), sel: Object.fromEntries(lista.map(r => [r.id, true])),
    fallo: {}, tecnico: TECNICOS.includes(yo) ? yo : '', notas: '',
  };
  render();
}

// Los equipos de una Fecha de campaña (por el caso de cada instalación)
export function abrirDescargaFecha(clave, n) {
  const g = state.campanas?.[clave]; if (!g) return;
  const casos = casosDeFecha(Object.entries(g.casos || {}).map(([id, c]) => ({ id, ...c })), n);
  const regs = casos.map(c => instalacionDeCaso(c, state.records)).filter(Boolean);
  abrir(`Fecha ${n}`, regs);
}
// Los equipos de la lista de Instalaciones que se está viendo
// (la vista guarda en state.instDescargables los de la pestaña y el filtro que se ven)
export function abrirDescargaInstalaciones(ids = state.instDescargables || []) { abrir('Instalaciones', ids.map(id => state.records.find(r => r.id === id))); }

export function cerrarDescargaBloque() { state.descargaBloque = null; render(); }
export function toggleDescargaBloque(id) { const b = state.descargaBloque; b.sel[id] = !b.sel[id]; render(); }
export function todosDescargaBloque(si) { const b = state.descargaBloque; b.ids.forEach(id => { b.sel[id] = si; }); render(); }
// fallo: '' (medición correcta) o el tipo de fallo
export function falloDescargaBloque(id, fallo) { const b = state.descargaBloque; if (fallo) b.fallo[id] = fallo; else delete b.fallo[id]; render(); }
export function datoDescargaBloque(campo, valor) { state.descargaBloque[campo] = valor; if (campo === 'tecnico') render(); }

export function guardarDescargaBloque() {
  const b = state.descargaBloque; if (!b) return;
  if (!b.tecnico) return showToast('Elige quién hizo la descarga');
  const ids = b.ids.filter(id => b.sel[id]);
  if (!ids.length) return showToast('Marca al menos un equipo');
  const por = state.sesionUsuario?.nombre || 'Desconocido';
  let conFallo = 0;
  ids.forEach(id => {
    const rec = state.records.find(r => r.id === id); if (!rec) return;
    const fallo = b.fallo[id];
    if (fallo) conFallo++;
    const nueva = { fecha: today(), tecnico: b.tecnico, notas: b.notas || '', registradoPor: por, medicionOk: !fallo, fallasMedicion: fallo ? [fallo] : [], descripcionFalla: '', enBloque: true };
    update(ref(db, 'analizadores/' + id), { descargas: [...(rec.descargas || []), nueva], descargaPendiente: false });
  });
  state.descargaBloque = null;
  showToast(`${ids.length} ${ids.length === 1 ? 'descarga registrada' : 'descargas registradas'}${conFallo ? ` · ${conFallo} con fallo` : ''}`);
  render();
}
