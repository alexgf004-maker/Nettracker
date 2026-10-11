// Lógica de inventario: equipos, préstamos, condición, importación
import { isAdmin } from '../config.js';
import { db, equiposRef, push, ref, remove, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { emptyEF, today } from '../utils.js';
import { render } from '../views/render.js';

// ── SAVE EQUIPO ──
export function handleSaveEq() {
  if (!state.equipoForm.serie.trim()) return showToast('Ingresa el número de serie');
  if (!state.equipoForm.modelo.trim()) return showToast('Ingresa el modelo / marca');
  if (!state.equipoForm.area) return showToast('Elige el área dueña (CPT MT o CPT BT)');
  // Check for duplicate serie
  const serieTrim = state.equipoForm.serie.trim().toUpperCase();
  const duplicate = state.equipos.find(e => e.serie.trim().toUpperCase() === serieTrim && e.id !== state.editEqId);
  if (duplicate) return showToast('Ya existe un equipo con ese número de serie');
  const usuario = state.sesionUsuario?.nombre || 'Desconocido';
  const data = { ...state.equipoForm, serie: serieTrim };
  if (state.editEqId) {
    // Al editar se conservan la fecha de registro y quién lo creó
    const id = state.editEqId;
    state.equipoForm = emptyEF(); state.view = 'equipo_detalle';
    update(ref(db, `equipos/${id}`), { ...data, editadoPor: usuario, fechaEdicion: today() }).then(() => showToast('Equipo actualizado'));
  } else {
    state.equipoForm = emptyEF(); state.view = 'lista';
    push(equiposRef, { ...data, fechaRegistro: today(), creadoPor: usuario }).then(() => showToast('Equipo agregado'));
  }
}

export function openCondicionModal(id) {
  const eq = state.equipos.find(x => x.id === id);
  if (!eq) return;
  state.condicionEqId = id;
  state.condicionForm = { condicion: eq.condicion || 'bueno', nota: '' };
  state.showCondicionModal = true;
  render();
}

export function confirmCondicion() {
  const eq = state.equipos.find(x => x.id === state.condicionEqId);
  if (!eq) return;
  const cambio = { fecha: today(), condicionAnterior: eq.condicion || 'bueno', condicionNueva: state.condicionForm.condicion, nota: state.condicionForm.nota, registradoPor: state.sesionUsuario?.nombre || 'Desconocido' };
  const historialCondicion = [...(eq.historialCondicion || []), cambio];
  const id = state.condicionEqId;
  state.showCondicionModal = false; state.condicionEqId = null;
  update(ref(db, `equipos/${id}`), { condicion: state.condicionForm.condicion, historialCondicion }).then(() => showToast('Condición actualizada'));
}

export function procesarExcelInventario(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: true });
      if (rows.length === 0) return showToast('El archivo está vacío');

      state.importData = rows.map(row => {
        const findCol = keys => {
          const rk = Object.keys(row);
          for (const k of keys) {
            const f = rk.find(r => r.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''));
            if (f !== undefined && row[f] !== undefined && row[f] !== '') return row[f];
          }
          return '';
        };
        const serie = findCol(['NO_SERIE','no_serie','serie','Serie','NO SERIE']).toString().trim().toUpperCase();
        const modelo = [findCol(['MODELO','modelo','Modelo']),findCol(['MARCA','marca','Marca'])].filter(Boolean).join(' ').trim();
        const vineta = findCol(['VIÑETA','VINETA','vineta','viñeta','Viñeta']).toString().trim();
        const estadoRaw = findCol(['ESTADO','estado','Estado']).toString().trim().toUpperCase();
        const condicion = estadoRaw === 'NO DISPONIBLE' ? 'detalles' : 'bueno';
        const ubicRaw = findCol(['UBICACION','UBICACIÓN','ubicacion','ubicación']).toString().trim().toUpperCase();
        const sede = ubicRaw.includes('CUCUMACAYAN') || ubicRaw.includes('CUCUMACAYÁN') ? 'Subestación Cucumacayán' : 'Plantel Central';
        const notas = findCol(['OBSERVACION','OBSERVACIÓN','observacion','observación']).toString().trim();

        const existe = state.equipos.find(eq => eq.serie.trim().toUpperCase() === serie);
        const status = !serie ? 'error' : existe ? 'duplicado' : 'ok';
        const problema = !serie ? 'Sin número de serie' : existe ? 'Ya existe en inventario' : '';

        return { serie, modelo, vineta, condicion, sede, notas, status, problema };
      }).filter(r => r.serie); // remove empty rows

      state.showImportModal = true;
      render();
    } catch(err) {
      showToast('Error: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

export function confirmarImportInventario() {
  const nuevos = state.importData.filter(r => r.status === 'ok');
  if (nuevos.length === 0) return showToast('No hay equipos nuevos para importar');
  nuevos.forEach(r => {
    push(equiposRef, { serie: r.serie, modelo: r.modelo, vineta: r.vineta, condicion: r.condicion, sede: r.sede, notas: r.notas, fechaRegistro: today() });
  });
  showToast('' + nuevos.length + ' equipos importados');
  state.showImportModal = false; state.importData = [];
  render();
}

export function eliminarMovimientoFn(eqId, movIdx) {
  if (!isAdmin()) return showToast('Solo el administrador puede eliminar movimientos');
  const eq = state.equipos.find(x => x.id === eqId);
  if (!eq || !eq.movimientos) return;
  if (!confirm('¿Eliminar este movimiento del historial?')) return;
  const movimientos = eq.movimientos.filter((_, i) => i !== movIdx);
  // If deleted movimiento was the last one and was prestamo, reset prestado
  const deleted = eq.movimientos[movIdx];
  const lastAfter = movimientos[movimientos.length - 1];
  const updates = { movimientos };
  if (deleted && deleted.tipo === 'prestamo' && (!lastAfter || lastAfter.tipo === 'devolucion')) {
    updates.prestado = false;
    updates.prestadoFecha = null;
    // Deshacer el préstamo: vuelve a donde estaba (lo despachado a Campos y Servicios sale de la Cucumacayán)
    updates.sede = deleted.de === 'CPT BT' || deleted.a === 'Campos y Servicios' ? 'Subestación Cucumacayán' : 'Plantel Central';
  }
  update(ref(db, 'equipos/' + eqId), updates).then(() => showToast('Movimiento eliminado'));
}

export function handleDelEq(id) {
  if (!isAdmin()) return showToast('Solo el administrador puede eliminar equipos');
  if (state.records.find(r => r.equipoId === id && !r.retirado)) return showToast('Equipo instalado actualmente');
  if (!confirm('¿Eliminar del inventario?')) return;
  state.view = 'lista';
  remove(ref(db, `equipos/${id}`)).then(() => showToast('Eliminado'));
}
