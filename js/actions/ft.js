// Seguimiento FT: aviso a DELSUR, ruta de solución, bitácora, compensación informada y remedición
import { db, ref, remove, set, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { hoyLocal } from '../domain/trabajo.js';
import { render } from '../views/render.js';

const ruta = (clave, id) => `campanas/${clave}/casos/${id}/ft`;
const firma = () => ({ fecha: hoyLocal(), por: state.sesionUsuario?.nombre || '' });

export function abrirFT(clave, id) { state.ftEdit = { clave, id }; state.ftNota = ''; render(); }
export function cerrarFT() { state.ftEdit = null; render(); }

export function marcarAvisoFT(clave, id) {
  set(ref(db, ruta(clave, id) + '/aviso'), firma()).then(() => showToast('Aviso a DELSUR registrado'));
}
export function quitarAvisoFT(clave, id) {
  if (!confirm('¿Quitar el registro del aviso?')) return;
  remove(ref(db, ruta(clave, id) + '/aviso'));
}
export function setRutaFT(clave, id, valor) { update(ref(db, ruta(clave, id)), { ruta: valor || null }); }
export function setCompensacionFT(clave, id, valor) {
  const v = String(valor || '').trim().replace(',', '.');
  if (v && Number.isNaN(Number(v))) return showToast('La compensación debe ser un número');
  update(ref(db, ruta(clave, id)), { compensacionDiaria: v ? Number(v) : null });
}

export function agregarNotaFT(clave, id) {
  const texto = String(state.ftNota || '').trim();
  if (!texto) return;
  const caso = state.campanas?.[clave]?.casos?.[id];
  const notas = [...(caso?.ft?.notas || []), { ...firma(), texto }];
  update(ref(db, ruta(clave, id)), { notas }).then(() => showToast('Nota agregada'));
  state.ftNota = '';
  render();
}

// Resultado de la remedición: solo "normalizado" cierra el caso
export function setRemedicionFT(clave, id, campo, valor) {
  update(ref(db, ruta(clave, id) + '/remedicion'), { [campo]: valor === '' ? null : valor, ...(campo === 'normalizado' ? { registradoPor: state.sesionUsuario?.nombre || '' } : {}) });
}
