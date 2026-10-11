// Sincronización en tiempo real con Firebase
import { campanasRef, reclamosRef, configCartasRef, seguimientoDesdeRef, equiposRef, historialAccesoriosRef, historialCargasRef, installsRef, mantenimientoRef, onValue as onValueFb, validacionesRef, db, ref } from '../firebase.js';
import { state } from '../state.js';
import { render as renderAhora } from '../views/render.js';

// Los datos que llegan se dibujan en la siguiente vuelta (una sola vez aunque lleguen varios nodos juntos).
// Así, si al salir de un campo se guarda y llega el dato, el foco ya pasó al campo siguiente y render() lo conserva.
let pendiente = false;
function render() {
  if (pendiente) return;
  pendiente = true;
  setTimeout(() => { pendiente = false; renderAhora(); }, 0);
}

// Cada listener actualiza su arreglo en el estado y vuelve a renderizar.
// Se inicia al entrar (las reglas de la base no dejan leer sin sesión) y se detiene al cerrar sesión.
let activos = null;
export function detenerSync() { (activos || []).forEach(off => off()); activos = null; }
export function iniciarSync() {
  if (activos) return;
  activos = [];
  const onValue = (r, cb) => activos.push(onValueFb(r, cb));
  onValue(installsRef, snap => {
    state.records = [];
    snap.forEach(child => {
      state.records.push({ id: child.key, ...child.val() });
    });
    state.records.sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
    render();
  });

  onValue(historialCargasRef, snap => {
    state.historialCargas = [];
    snap.forEach(c => {
      const v = c.val();
      // Only load metadata - NOT memo HTML (too heavy for listener)
      state.historialCargas.push({ id: c.key, fecha: v.fecha, hora: v.hora, areaOrigen: v.areaOrigen, total: v.total, realizadoPor: v.realizadoPor });
    });
    state.historialCargas.sort((a, b) => ((b.fecha||'')+' '+(b.hora||'')).localeCompare((a.fecha||'')+' '+(a.hora||'')));
    render();
  });

  onValue(historialAccesoriosRef, snap => {
    state.historialAccesorios = [];
    snap.forEach(x => { const v = x.val(); state.historialAccesorios.push({ id: x.key, ...v }); });
    state.historialAccesorios.reverse();
    render();
  });

  onValue(mantenimientoRef, snap => {
    state.modoMantenimiento = snap.exists() ? snap.val() === true : false;
    render();
  });

  onValue(campanasRef, snap => {
    state.campanas = snap.exists() ? snap.val() : {};
    render();
  });

  onValue(reclamosRef, snap => {
    state.reclamos = snap.exists() ? snap.val() : {};
    render();
  });

  onValue(seguimientoDesdeRef, snap => {
    state.seguimientoDesde = snap.exists() ? snap.val() : null;
    render();
  });

  onValue(configCartasRef, snap => {
    state.configCartas = snap.exists() ? snap.val() : null;
    render();
  });

  onValue(validacionesRef, snap => {
    state.validaciones = [];
    snap.forEach(x => {
      const v = x.val();
      state.validaciones.push({ id: x.key, ...v });
    });
    state.validaciones.reverse();
    render();
  });

  // Memos de préstamo/devolución guardados (para reimprimirlos), del más reciente al más antiguo
  onValue(ref(db, 'memosEquipos'), snap => {
    state.memosEquipos = [];
    snap.forEach(x => { state.memosEquipos.push({ id: x.key, ...x.val() }); });
    state.memosEquipos.sort((a, b) => ((b.fecha || '') + (b.hora || '')).localeCompare((a.fecha || '') + (a.hora || '')));
    render();
  });

  onValue(equiposRef, snap => {
    state.equipos = [];
    snap.forEach(child => {
      state.equipos.push({ id: child.key, ...child.val() });
    });
    state.equipos.sort((a, b) => (a.serie || '').localeCompare(b.serie || ''));
    render();
  });
}
