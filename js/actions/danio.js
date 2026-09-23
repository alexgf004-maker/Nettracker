// Memo de equipo dañado en campo por Campos y Servicios (contratista que saca los
// equipos de la Cucumacayán, los instala y los regresa). Lo firman CPT, la
// Cucumacayán y Campos y Servicios. Deja el equipo con su nueva condición.
import { CONDICIONES, FALLAS_GRAVES, SEDE_CUCUMACAYAN, userArea } from '../config.js';
import { db, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { today } from '../utils.js';
import { render } from '../views/render.js';
import { generateMemoDanio } from '../pdf/memos.js';

// Condiciones que se pueden asignar al equipo dañado
export const CONDICIONES_DANIO = CONDICIONES.filter(c => c.key === 'fuera' || c.key === 'detalles');

export function openDanioModal(id) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;
  const fallas = r.fallas || [];
  state.danioId = id;
  state.danioForm = {
    fechaDanio: r.fechaRetiroReal || today(),
    descripcion: [fallas.join(', '), r.descripcionFalla].filter(Boolean).join('. '),
    condicion: fallas.some(f => FALLAS_GRAVES.includes(f)) ? 'fuera' : 'detalles',
    tecnicoCampos: '',
  };
  state.showDanioModal = true;
  render();
}

export function closeDanioModal() {
  state.showDanioModal = false; state.danioId = null;
  render();
}

export function confirmDanio() {
  const r = state.records.find(x => x.id === state.danioId);
  if (!r) return;
  const f = state.danioForm;
  if (!f.descripcion.trim()) return showToast('Describe qué le pasó al equipo');
  if (!f.fechaDanio) return showToast('Indica la fecha del daño');

  const eq = state.equipos.find(x => x.id === r.equipoId);
  const usuario = state.sesionUsuario?.nombre || 'Desconocido';
  const memo = {
    fecha: today(),
    hora: new Date().toTimeString().slice(0, 5),
    fechaDanio: f.fechaDanio,
    descripcion: f.descripcion.trim(),
    condicion: f.condicion,
    tecnicoCampos: f.tecnicoCampos.trim(),
    generadoPor: usuario,
    areaGenera: userArea() || 'CPT MT',
    // Datos de la instalación y del equipo tal como estaban al generar el memo
    serie: r.serie || eq?.serie || '',
    modelo: r.modelo || eq?.modelo || '',
    vineta: eq?.vineta || '',
    caso: r.caso || '',
    lugar: r.lugar || '',
    fechaInstalacion: r.fechaInstalacion || '',
    fechaRetiro: r.fechaRetiroReal || r.fechaRetiro || '',
    areaBeneficiaria: r.areaBeneficiaria || '',
  };

  state.showDanioModal = false; state.danioId = null;
  render();
  generateMemoDanio(memo);

  update(ref(db, 'analizadores/' + r.id), { memoDanio: memo });
  if (eq) {
    const cond = CONDICIONES.find(c => c.key === memo.condicion);
    const eqUpdates = { sede: SEDE_CUCUMACAYAN, condicion: memo.condicion };
    if ((eq.condicion || 'bueno') !== memo.condicion) {
      eqUpdates.historialCondicion = [...(eq.historialCondicion || []), {
        fecha: memo.fecha, condicionAnterior: eq.condicion || 'bueno', condicionNueva: memo.condicion,
        nota: 'Dañado en campo por Campos y Servicios (caso ' + memo.caso + '): ' + memo.descripcion, registradoPor: usuario,
      }];
    }
    update(ref(db, 'equipos/' + eq.id), eqUpdates)
      .then(() => showToast('📝 Memo generado · Equipo ' + (cond ? cond.label : memo.condicion)));
  } else {
    showToast('📝 Memo generado');
  }
}

export function reimprimirMemoDanio(id) {
  const memo = state.records.find(x => x.id === id)?.memoDanio;
  if (memo) generateMemoDanio(memo);
}
