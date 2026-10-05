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
  state.danioEditando = false;
  state.danioForm = {
    fechaDanio: r.fechaRetiroReal || today(),
    descripcion: [fallas.join(', '), r.descripcionFalla].filter(Boolean).join('. '),
    condicion: fallas.some(f => FALLAS_GRAVES.includes(f)) ? 'fuera' : 'detalles',
    tecnicoCampos: '',
  };
  state.showDanioModal = true;
  render();
}

// Abre el formulario con los datos del memo ya generado para corregirlos
export function editarDanio(id) {
  const m = state.records.find(x => x.id === id)?.memoDanio;
  if (!m) return;
  state.danioId = id;
  state.danioEditando = true;
  state.danioForm = { fechaDanio: m.fechaDanio || '', descripcion: m.descripcion || '', condicion: m.condicion || 'detalles', tecnicoCampos: m.tecnicoCampos || '' };
  state.showDanioModal = true;
  render();
}

export function closeDanioModal() {
  state.showDanioModal = false; state.danioId = null; state.danioEditando = false;
  render();
}

// Guarda la corrección del memo. Si cambió la condición, también la del equipo.
function guardarEdicionDanio(r) {
  const f = state.danioForm;
  const usuario = state.sesionUsuario?.nombre || 'Desconocido';
  const anterior = r.memoDanio;
  const memo = {
    ...anterior,
    fechaDanio: f.fechaDanio,
    descripcion: f.descripcion.trim(),
    condicion: f.condicion,
    tecnicoCampos: f.tecnicoCampos.trim(),
    fechaRetiro: r.fechaRetiro || anterior.fechaRetiro || '',
    // La firma de CPT es de quien genera esta versión del memo
    creadoPor: anterior.creadoPor || anterior.generadoPor,
    generadoPor: usuario,
    areaGenera: userArea() || anterior.areaGenera || 'CPT MT',
    editadoPor: usuario,
    fechaEdicion: today(),
  };
  state.showDanioModal = false; state.danioId = null; state.danioEditando = false;
  render();
  generateMemoDanio(memo);
  update(ref(db, 'analizadores/' + r.id), { memoDanio: memo });

  const eq = state.equipos.find(x => x.id === r.equipoId);
  if (eq && memo.condicion !== anterior.condicion && (eq.condicion || 'bueno') !== memo.condicion) {
    update(ref(db, 'equipos/' + eq.id), {
      condicion: memo.condicion,
      historialCondicion: [...(eq.historialCondicion || []), {
        fecha: today(), condicionAnterior: eq.condicion || 'bueno', condicionNueva: memo.condicion,
        nota: 'Corrección del memo de equipo dañado (caso ' + memo.caso + ')', registradoPor: usuario,
      }],
    });
  }
  showToast('✏️ Memo actualizado');
}

export function confirmDanio() {
  const r = state.records.find(x => x.id === state.danioId);
  if (!r) return;
  const f = state.danioForm;
  if (!f.descripcion.trim()) return showToast('Describe qué le pasó al equipo');
  if (!f.fechaDanio) return showToast('Indica la fecha del daño');
  if (state.danioEditando && r.memoDanio) return guardarEdicionDanio(r);

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
    fechaRetiro: r.fechaRetiro || '', // retiro programado
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
  const r = state.records.find(x => x.id === id);
  // fechaRetiro siempre es la programada (memos anteriores guardaban la real)
  if (r?.memoDanio) generateMemoDanio({ ...r.memoDanio, fechaRetiro: r.fechaRetiro || r.memoDanio.fechaRetiro });
}
