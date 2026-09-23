// Sincronización en tiempo real con Firebase
import { equiposRef, historialAccesoriosRef, historialCargasRef, installsRef, mantenimientoRef, onValue, validacionesRef } from '../firebase.js';
import { state } from '../state.js';
import { render } from '../views/render.js';

// Cada listener actualiza su arreglo en el estado y vuelve a renderizar
export function iniciarSync() {
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

  onValue(validacionesRef, snap => {
    state.validaciones = [];
    snap.forEach(x => {
      const v = x.val();
      state.validaciones.push({ id: x.key, ...v });
    });
    state.validaciones.reverse();
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
