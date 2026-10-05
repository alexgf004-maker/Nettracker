// Seguimiento del trabajo: entrega de campañas, informes de reclamos y requerimientos.
// Guarda quién y cuándo marcó cada entrega.
import { db, ref, remove, set, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { hoyLocal } from '../domain/trabajo.js';

const firma = () => ({ fecha: hoyLocal(), por: state.sesionUsuario?.nombre || '' });

// Campaña cargada en el sistema CPT DELSUR (la carga se hace fuera de la app)
export function marcarCampanaEntregada(clave) {
  if (!confirm('¿Marcar la campaña como cargada en el sistema CPT DELSUR?')) return;
  set(ref(db, 'campanas/' + clave + '/entrega'), firma()).then(() => showToast('Campaña marcada como entregada'));
}
export function desmarcarCampanaEntregada(clave) {
  if (!confirm('¿Quitar la marca de entregada?')) return;
  remove(ref(db, 'campanas/' + clave + '/entrega')).then(() => showToast('Marca de entrega quitada'));
}

// Informe de reclamo (8 días calendario desde el retiro)
export function marcarInformeEntregado(id) {
  if (!confirm('¿Marcar el informe del reclamo como entregado?')) return;
  update(ref(db, 'analizadores/' + id), { informeEntregado: firma() }).then(() => showToast('Informe marcado como entregado'));
}
export function desmarcarInformeEntregado(id) {
  if (!confirm('¿Quitar la marca de informe entregado?')) return;
  update(ref(db, 'analizadores/' + id), { informeEntregado: null }).then(() => showToast('Marca de entrega quitada'));
}

// Requerimientos: la fecha límite la pone quien lo solicita, así que se anota a mano
export function setEntregaLimite(id, fecha) {
  update(ref(db, 'analizadores/' + id), { entregaLimite: fecha || null }).then(() => showToast(fecha ? 'Fecha de entrega guardada' : 'Fecha de entrega quitada'));
}
export function marcarRequerimientoEntregado(id) {
  if (!confirm('¿Marcar el requerimiento como entregado?')) return;
  update(ref(db, 'analizadores/' + id), { entregaRealizada: firma() }).then(() => showToast('Requerimiento marcado como entregado'));
}
export function desmarcarRequerimientoEntregado(id) {
  if (!confirm('¿Quitar la marca de entregado?')) return;
  update(ref(db, 'analizadores/' + id), { entregaRealizada: null }).then(() => showToast('Marca de entrega quitada'));
}
