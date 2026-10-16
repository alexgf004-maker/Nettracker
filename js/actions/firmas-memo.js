// Firmas en pantalla de los memos (como en la inspección de los reclamos): préstamo y devolución de equipos,
// despacho a Campos y Servicios y equipo dañado en campo. Se firman después de generar el memo, cada quien cuando le
// toca, desde el botón "Firmas"; se guardan en {memo}/firmas/{rol} = { img, nombre, fecha, por } y salen en el PDF.
// Las que falten quedan con la línea para firmar a mano.
import { CAMPOS } from '../domain/inventario.js';
import { db, ref, remove } from '../firebase.js';
import { state } from '../state.js';
import { render } from '../views/render.js';
import { reimprimirMemoDanio } from './danio.js';
import { reimprimirMemoEquipos } from './memos-equipos.js';

// Datos de cada tipo de memo: dónde se guarda, sus firmas y cómo se abre
const TIPOS = {
  equipos: {
    memo: id => state.memosEquipos.find(m => m.id === id),
    ruta: id => `memosEquipos/${id}`,
    titulo: m => `${m.tipo === 'prestamo' ? 'Préstamo' : 'Devolución'} · ${m.de} → ${m.a}`,
    roles: m => [{ k: 'entrega', eti: 'Entrega', de: m.de }, { k: 'recibe', eti: 'Recibe', de: m.a }],
    abrir: id => reimprimirMemoEquipos(id),
  },
  despacho: {
    memo: id => state.historialCargas.find(c => c.id === id),
    ruta: id => `historialCargas/${id}`,
    titulo: c => `Despacho a ${CAMPOS} · ${c.total || 0} equipos`,
    roles: c => [{ k: 'entrega', eti: 'Entrega', de: c.areaOrigen }, { k: 'recibe', eti: 'Recibe', de: CAMPOS }],
    abrir: id => window.verMemo?.(id),
  },
  danio: {
    memo: id => state.records.find(r => r.id === id)?.memoDanio,
    ruta: id => `analizadores/${id}/memoDanio`,
    titulo: m => `Equipo dañado · ${m.serie || ''}`,
    roles: m => [{ k: 'cpt', eti: m.areaGenera || 'CPT MT', de: 'CPT INNOVA' }, { k: 'cucumacayan', eti: 'Subestación Cucumacayán', de: 'Recibe el equipo' }, { k: 'campos', eti: CAMPOS, de: 'Contratista' }],
    abrir: id => reimprimirMemoDanio(id),
  },
};

// Lo que muestra la ventana de firmas (o null si el memo ya no existe)
export function firmasDeMemo(tipo, id) {
  const t = TIPOS[tipo]; const m = t?.memo(id); if (!m) return null;
  return { titulo: t.titulo(m), roles: t.roles(m).map(r => ({ ...r, firma: m.firmas?.[r.k] || null })) };
}
// Cuántas firmas lleva un memo, para el botón: "Firmas 1/2"
export function cuentaFirmas(tipo, memo) {
  const roles = TIPOS[tipo].roles(memo);
  return { hechas: roles.filter(r => memo.firmas?.[r.k]?.img).length, total: roles.length };
}

export function abrirFirmasMemo(tipo, id) { state.firmasMemo = { tipo, id }; render(); }
export function cerrarFirmasMemo() { state.firmasMemo = null; state.firmaInsp = null; render(); }
export function verMemoFirmado() { const f = state.firmasMemo; if (f) TIPOS[f.tipo].abrir(f.id); }

// Abre el recuadro para firmar (el de la inspección); el nombre de quien firma se escribe ahí
export function firmarMemo(rol) {
  const f = state.firmasMemo; if (!f) return;
  const r = firmasDeMemo(f.tipo, f.id)?.roles.find(x => x.k === rol); if (!r) return;
  state.firmaInsp = { id: 'memo', rol, trazos: [], memo: { base: `${TIPOS[f.tipo].ruta(f.id)}/firmas/${rol}`, sub: `${r.eti} · ${r.de || ''}`, nombre: r.firma?.nombre || '' } };
  render();
}
export function quitarFirmaMemo(rol) {
  const f = state.firmasMemo; if (!f) return;
  if (!confirm('¿Quitar esta firma? En el memo quedará la línea para firmar a mano.')) return;
  remove(ref(db, `${TIPOS[f.tipo].ruta(f.id)}/firmas/${rol}`));
}
