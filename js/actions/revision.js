// Envío de un equipo a revisión en la Subestación Cucumacayán (primer filtro
// cuando un equipo asignado falla). Genera el memo y deja la trazabilidad.
import { db, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { today } from '../utils.js';
import { render } from '../views/render.js';
import { generateMemoRevision } from '../pdf/memos.js';

export const SEDE_REVISION = 'Subestación Cucumacayán';
const MOTIVO_DEFAULT = 'Revisión y diagnóstico del equipo por falla reportada';

// Propone "qué le pasó" y "cuándo" a partir de lo más reciente registrado:
// fallas marcadas al retirarlo de campo o la última nota de cambio de condición.
export function antecedentesRevision(eq) {
  const eventos = [];
  state.records
    .filter(r => r.equipoId === eq.id && r.retirado && (r.fallas?.length || r.descripcionFalla))
    .forEach(r => eventos.push({
      fecha: r.fechaRetiroReal || r.fechaRetiro || '',
      texto: [(r.fallas || []).join(', '), r.descripcionFalla].filter(Boolean).join('. '),
      origen: 'Detectado al retirar de campo' + (r.caso ? ' (caso ' + r.caso + (r.lugar ? ', ' + r.lugar : '') + ')' : ''),
    }));
  (eq.historialCondicion || [])
    .filter(h => h.nota && !String(h.nota).startsWith('Enviado a revisión'))
    .forEach(h => eventos.push({ fecha: h.fecha || '', texto: h.nota, origen: 'Cambio de condición' + (h.registradoPor ? ' · ' + h.registradoPor : '') }));
  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function openRevisionModal(id) {
  const eq = state.equipos.find(x => x.id === id);
  if (!eq) return;
  const ultimo = antecedentesRevision(eq)[0];
  state.revisionEqId = id;
  state.revisionForm = {
    motivo: MOTIVO_DEFAULT,
    descripcion: ultimo ? ultimo.texto + (ultimo.origen ? ' — ' + ultimo.origen + '.' : '') : '',
    fechaIncidente: ultimo?.fecha || today(),
  };
  state.showRevisionModal = true;
  render();
}

export function closeRevisionModal() {
  state.showRevisionModal = false; state.revisionEqId = null;
  render();
}

export function confirmRevision() {
  const eq = state.equipos.find(x => x.id === state.revisionEqId);
  if (!eq) return;
  const f = state.revisionForm;
  if (!f.descripcion.trim()) return showToast('Describe qué le pasó al equipo');
  if (!f.fechaIncidente) return showToast('Indica la fecha del incidente');

  const usuario = state.sesionUsuario?.nombre || 'Desconocido';
  const envio = {
    fecha: today(),
    hora: new Date().toTimeString().slice(0, 5),
    fechaIncidente: f.fechaIncidente,
    motivo: f.motivo.trim() || MOTIVO_DEFAULT,
    descripcion: f.descripcion.trim(),
    sedeOrigen: eq.sede || 'Plantel Central',
    condicionAnterior: eq.condicion || 'bueno',
    entregadoPor: usuario,
    antecedentes: antecedentesRevision(eq).slice(0, 5), // queda fijo en el memo aunque cambie el historial
  };
  const updates = {
    sede: SEDE_REVISION,
    condicion: 'mantenimiento',
    historialMantenimiento: [...(eq.historialMantenimiento || []), {
      descripcion: envio.descripcion,
      accion: 'Enviado a revisión a ' + SEDE_REVISION,
      resultado: 'pendiente',
      fechaInicio: envio.fecha,
      fechaResolucion: '',
      observaciones: envio.motivo,
      registradoPor: usuario,
      fecha: envio.fecha,
      envioRevision: envio,
    }],
  };
  if (envio.condicionAnterior !== 'mantenimiento') {
    updates.historialCondicion = [...(eq.historialCondicion || []), {
      fecha: envio.fecha, condicionAnterior: envio.condicionAnterior, condicionNueva: 'mantenimiento',
      nota: 'Enviado a revisión a ' + SEDE_REVISION + ': ' + envio.descripcion, registradoPor: usuario,
    }];
  }

  state.showRevisionModal = false; state.revisionEqId = null;
  render();
  generateMemoRevision(eq, envio);
  update(ref(db, 'equipos/' + eq.id), updates).then(() => showToast('📤 Enviado a revisión · Memo generado'));
}

// Vuelve a generar el memo de un envío ya registrado (desde su ficha de mantenimiento)
export function reimprimirMemoRevision(eqId, fichaIdx) {
  const eq = state.equipos.find(x => x.id === eqId);
  const envio = eq?.historialMantenimiento?.[fichaIdx]?.envioRevision;
  if (envio) generateMemoRevision(eq, envio);
}
