// Checklist de inspección del reclamo (reclamos/{id}/inspeccion): se guarda campo por campo al salir de cada uno.
// Tableros y equipos dañados son listas con claves de push.
import { db, push, ref, remove, update } from '../firebase.js';
import { showToast } from '../ui.js';

const NUMERICOS = /(^|\/)(cantidad|kva|tierra|vmin|vmax|monto)$/;

// ruta: 'fecha', 'subestacion/tap', 'tableros/{clave}/tierra'…
export function guardarInspeccion(id, ruta, valor) {
  let v = String(valor ?? '').trim();
  if (v && NUMERICOS.test(ruta)) {
    v = v.replace(',', '.').replace(/^\$/, '');
    if (Number.isNaN(Number(v))) return showToast('Escribe solo el número');
  }
  update(ref(db, `reclamos/${id}/inspeccion`), { [ruta]: v === '' ? null : v });
}

export function agregarItemInspeccion(id, lista) {
  push(ref(db, `reclamos/${id}/inspeccion/${lista}`), { orden: Date.now() });
}

export function quitarItemInspeccion(id, lista, clave) {
  if (!confirm(`¿Quitar este ${lista === 'tableros' ? 'tablero' : 'equipo'} de la inspección?`)) return;
  remove(ref(db, `reclamos/${id}/inspeccion/${lista}/${clave}`));
}
